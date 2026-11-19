"""Robot RTF sanitization and isolated LibreOffice -> PDF -> PNG conversion."""
import logging
import os
import re
import shutil
import tempfile
import uuid

from utils.libreoffice import convert_to_pdf

logger = logging.getLogger(__name__)


def sanitize_assemblage_rtf(rtf_text: str) -> str:
    """
    Sanitize Autodesk Robot Structural Analysis RTF output:
    1. Fix Greek & mathematical symbols that use Symbol font (which render as
       broken symbols, plus signs, or missing glyphs in LibreOffice headless).
       Convert them to standard Unicode with Arial/sans-serif font.
    2. Fix corrupted table cell widths (e.g., cellx480 on Gauche, Section, Soudures,
       and the 3-cell conclusion box cellx480/cellx960/cellx1440) that cause LibreOffice
       to render narrow 8.5mm columns with vertically wrapped text on an extra page.
    """
    symbol_font_ids = set(re.findall(r"\\f(\d+)[^}]*?Symbol;", rtf_text, flags=re.IGNORECASE))
    if not symbol_font_ids:
        symbol_font_ids = set(re.findall(r"\\f(\d+)[^}]*?\\fcharset2", rtf_text, flags=re.IGNORECASE))
    if not symbol_font_ids:
        symbol_font_ids = {'3'}

    symbol_map = {
        'g': r'\u947?',   # γ (gamma)
        'b': r'\u946?',   # β (beta)
        'p': r'\u960?',   # π (pi)
        's': r'\u963?',   # σ (sigma)
        't': r'\u964?',   # τ (tau)
        'a': r'\u945?',   # α (alpha)
        'd': r'\u948?',   # δ (delta)
        'e': r'\u949?',   # ε (epsilon)
        'h': r'\u951?',   # η (eta)
        'q': r'\u952?',   # θ (theta)
        'l': r'\u955?',   # λ (lambda)
        'm': r'\u956?',   # μ (mu)
        'r': r'\u961?',   # ρ (rho)
        'f': r'\u966?',   # φ (phi)
        'w': r'\u969?',   # ω (omega)
        'D': r'\u916?',   # Δ (Delta)
        'S': r'\u931?',   # Σ (Sigma)
        'W': r'\u937?',   # Ω (Omega)
        '^': r'\u8869?',  # ⊥ (perpendicular / up tack)
    }

    for fid in symbol_font_ids:
        rtf_text = re.sub(
            rf"\\f{fid}((?:\\(?:fs\d+|insrsid\d+|b|i|sub|super|cf\d+))*)\s*(?:\\u214\\'d6|\\'d6)",
            r"\\f1\1 \\u8730?",
            rtf_text,
        )

        def make_repl(f_id):
            def repl_char(m):
                flags = m.group(1) or ""
                char = m.group(2)
                repl = symbol_map.get(char, char)
                return rf"\f1{flags} {repl}"
            return repl_char

        chars_class = "".join(re.escape(c) for c in symbol_map.keys())
        pattern = rf"\\f{fid}((?:\\(?:fs\d+|insrsid\d+|b|i|sub|super|cf\d+))*)\s+([{chars_class}])"
        rtf_text = re.sub(pattern, make_repl(fid), rtf_text)

    pattern_3cell = r"(\\cellx)480((?:(?!\\cellx).)*?\\cellx)960((?:(?!\\cellx).)*?\\cellx)1440"
    rtf_text = re.sub(
        pattern_3cell,
        lambda m: m.group(1) + "7000" + m.group(2) + "8200" + m.group(3) + "9360",
        rtf_text,
        flags=re.DOTALL,
    )

    pattern_2cell = r"(\\cellx)480((?:(?!\\cellx).)*?\\cellx)960"
    rtf_text = re.sub(
        pattern_2cell,
        lambda m: m.group(1) + "8200" + m.group(2) + "9360",
        rtf_text,
        flags=re.DOTALL,
    )

    rtf_text = rtf_text.replace(r"\cellx480", r"\cellx9360")
    return rtf_text


def _extract_images_from_pdf(pdf_path, convert_dir, prefix, unique_run_id):
    """Renders pages of a PDF to tightly cropped PNG images."""
    import pymupdf as fitz
    from PIL import Image, ImageChops

    images = []
    if not pdf_path or not os.path.exists(pdf_path):
        return images

    os.makedirs(convert_dir, exist_ok=True)
    try:
        with fitz.open(pdf_path) as doc:
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                zoom = 2.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)

                mode = "RGBA" if pix.alpha else "RGB"
                img = Image.frombytes(mode, [pix.width, pix.height], pix.samples)

                bg = Image.new(
                    img.mode,
                    img.size,
                    (255, 255, 255) if not pix.alpha else (255, 255, 255, 255),
                )
                diff = ImageChops.difference(img, bg)
                diff = ImageChops.add(diff, diff, 2.0, -100)
                bbox = diff.getbbox()

                if bbox:
                    pad = 20
                    bbox = (
                        max(0, bbox[0] - pad),
                        max(0, bbox[1] - pad),
                        min(img.width, bbox[2] + pad),
                        min(img.height, bbox[3] + pad),
                    )
                    img = img.crop(bbox)

                img_path = os.path.join(convert_dir, f"{prefix}_{unique_run_id}_page_{page_num+1}.png")
                img.save(img_path)
                images.append(img_path)
    except Exception as img_err:
        logger.warning("Error rendering PDF pages to images (%s): %s", pdf_path, img_err)

    return images


def _batch_convert_rtf_files(specs, _allow_fallback=True):
    """
    Batches multiple RTF-to-image conversions in a SINGLE LibreOffice invocation
    via utils.libreoffice.convert_to_pdf (isolated profile, zero cross-job leakage).
    """
    results = {}
    valid_specs = []
    for s in specs:
        key = s.get('key', s['prefix'])
        results[key] = []
        if s.get('rtf_path') and os.path.exists(s['rtf_path']):
            valid_specs.append({**s, 'key': key})

    if not valid_specs:
        return results

    unique_run_id = uuid.uuid4().hex[:8]
    needs_conversion = []

    for s in valid_specs:
        if s['rtf_path'].lower().endswith('.pdf'):
            results[s['key']] = _extract_images_from_pdf(
                s['rtf_path'], s['convert_dir'], s['prefix'], unique_run_id
            )
        else:
            needs_conversion.append(s)

    if not needs_conversion:
        return results

    pdf_out_dir = tempfile.mkdtemp(prefix=f"lo_out_batch_{unique_run_id}_")
    work_dir = tempfile.mkdtemp(prefix=f"lo_work_batch_{unique_run_id}_")

    prepared_files = []
    for idx, s in enumerate(needs_conversion):
        unique_base = f"{s['prefix']}_{idx}_{unique_run_id}"
        dest_rtf = os.path.join(work_dir, f"{unique_base}.rtf")
        if s.get('is_assemblage'):
            try:
                with open(s['rtf_path'], 'r', encoding='latin1') as rf:
                    raw_rtf = rf.read()
                cleaned_rtf = sanitize_assemblage_rtf(raw_rtf)
                with open(dest_rtf, 'w', encoding='latin1') as wf:
                    wf.write(cleaned_rtf)
            except Exception as e:
                logger.warning("sanitize_assemblage_rtf failed in batch for %s: %s", s['rtf_path'], e)
                shutil.copy2(s['rtf_path'], dest_rtf)
        else:
            shutil.copy2(s['rtf_path'], dest_rtf)

        prepared_files.append((s, dest_rtf, unique_base))

    try:
        input_file_paths = [p[1] for p in prepared_files]
        convert_to_pdf(input_file_paths, pdf_out_dir, timeout=90)

        for s, _, unique_base in prepared_files:
            expected_pdf = os.path.join(pdf_out_dir, f"{unique_base}.pdf")
            if os.path.exists(expected_pdf):
                os.makedirs(s['convert_dir'], exist_ok=True)
                final_pdf = os.path.join(s['convert_dir'], f"{s['prefix']}_{unique_run_id}.pdf")
                shutil.copy2(expected_pdf, final_pdf)
                results[s['key']] = _extract_images_from_pdf(
                    final_pdf, s['convert_dir'], s['prefix'], unique_run_id
                )
            else:
                logger.warning("LibreOffice batch did not output expected PDF: %s", expected_pdf)
    except Exception as batch_err:
        if _allow_fallback and len(prepared_files) > 1:
            logger.warning(
                "LibreOffice batch conversion failed (%s). Falling back to individual conversions.",
                batch_err,
            )
            for s, _, _ in prepared_files:
                if not results[s['key']]:
                    results[s['key']] = _convert_rtf_file_to_images(
                        s['rtf_path'],
                        s['convert_dir'],
                        s['prefix'],
                        is_assemblage=s.get('is_assemblage', False),
                    )
        else:
            logger.error("LibreOffice RTF conversion failed: %s", batch_err)
    finally:
        shutil.rmtree(pdf_out_dir, ignore_errors=True)
        shutil.rmtree(work_dir, ignore_errors=True)

    return results


def _convert_rtf_file_to_images(rtf_path, convert_dir, prefix, is_assemblage=False):
    """
    Converts a single RTF file to cropped images.
    Uses _batch_convert_rtf_files internally with _allow_fallback=False to ensure
    strict profile isolation without mutual recursion on LibreOffice failure.
    """
    specs = [{
        'rtf_path': rtf_path,
        'convert_dir': convert_dir,
        'prefix': prefix,
        'is_assemblage': is_assemblage,
        'key': prefix,
    }]
    res = _batch_convert_rtf_files(specs, _allow_fallback=False)
    return res.get(prefix, [])

