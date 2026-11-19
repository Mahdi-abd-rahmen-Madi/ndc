"""Auto-cropping helpers for Robot screenshots (tableau des charges & verification)."""
import logging
import os
import uuid
import numpy as np
from PIL import Image
from django.conf import settings

logger = logging.getLogger(__name__)


def _crop_tableau_charges_image(img_path: str) -> str:
    """
    Crop trailing empty columns from a Robot tableau des charges screenshot.
    Writes to a unique filename so concurrent renders never race on the same path.
    """
    if not img_path or not os.path.exists(img_path):
        return img_path
    try:
        with Image.open(img_path) as src_img:
            gray = src_img.convert('L')
            arr = np.array(gray)
            h, w = arr.shape
            col_line_span = np.sum(arr[10:h - 10, :] < 180, axis=0)
            true_lines = np.where(col_line_span > (h - 20) * 0.85)[0]
            groups = []
            for c in true_lines:
                if not groups or c > groups[-1][-1] + 2:
                    groups.append([c])
                else:
                    groups[-1].append(c)
            centers = [int(np.mean(g)) for g in groups]
            if len(centers) >= 4:
                last_content_col = None
                for i in range(len(centers) - 2, -1, -1):
                    c1, c2 = centers[i], centers[i + 1]
                    col_width = c2 - c1 - 4
                    if col_width <= 0:
                        continue
                    cell_area = arr[25:h - 5, c1 + 2:c2 - 2]
                    row_dark_count = np.sum(cell_area < 180, axis=1)
                    grid_rows = row_dark_count > (col_width * 0.5)
                    text_rows = ~grid_rows
                    text_dark_pixels = np.sum(cell_area[text_rows] < 180)
                    if text_dark_pixels > 20:
                        last_content_col = i
                        break

                if last_content_col is not None and last_content_col < len(centers) - 2:
                    crop_x = min(w, centers[last_content_col + 1] + 1)
                    cropped_img = src_img.crop((0, 0, crop_x, h))
                    dir_name = os.path.dirname(img_path)
                    stem, ext = os.path.splitext(os.path.basename(img_path))
                    ext = ext or '.png'
                    cropped_path = os.path.join(dir_name, f"cropped_{stem}_{uuid.uuid4().hex[:8]}{ext}")
                    cropped_img.save(cropped_path)
                    return cropped_path
    except Exception as e:
        logger.warning("Could not crop tableau_charges (%s): %s", img_path, e)
    return img_path


def crop_verification_screenshot(orig_path: str) -> str:
    """Auto-crop whitespace around the Robot verification table screenshot."""
    if not orig_path or not os.path.exists(orig_path):
        return orig_path
    try:
        with Image.open(orig_path) as im:
            arr = np.array(im.convert('RGB'))
            h, w, _ = arr.shape
            dark = (arr[:, :, 0] < 80) & (arr[:, :, 1] < 80) & (arr[:, :, 2] < 80)

            vert_counts = dark[min(70, h - 20):max(h - 10, min(70, h - 20) + 1), :].sum(axis=0)
            vert_lines = np.where(vert_counts > 20)[0]
            table_vert_lines = vert_lines[vert_lines <= min(w, 880)]

            right = min(w, int(table_vert_lines[-1]) + 3) if (len(table_vert_lines) > 0 and w > 840) else w

            horiz_counts = dark[:, min(50, right - 10):max(50, right - 5)].sum(axis=1)
            min_span = max(10, (right - 55) * 0.4)
            horiz_lines = np.where(horiz_counts > min_span)[0]
            table_horiz = horiz_lines[horiz_lines > 60]

            bottom = min(h, int(table_horiz[-1]) + 3) if (len(table_horiz) > 0 and h > 160) else h

            if right < w - 20 or bottom < h - 15:
                cropped_im = im.crop((0, 0, right, bottom))
                convert_dir = os.path.join(settings.MEDIA_ROOT, 'screenshots', 'verification')
                os.makedirs(convert_dir, exist_ok=True)
                base_name = os.path.splitext(os.path.basename(orig_path))[0]
                cropped_path = os.path.join(convert_dir, f"{base_name}_cropped_{uuid.uuid4().hex[:8]}.png")
                cropped_im.save(cropped_path, "PNG")
                return cropped_path
    except Exception as e:
        logger.warning("Failed to auto-crop verification screenshot (%s): %s", orig_path, e)
    return orig_path

