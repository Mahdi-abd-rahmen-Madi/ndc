import os
import subprocess
from django.conf import settings
from django.core.files import File
from .models import CalculationJob

def assemble_ndc_document(calculation_id):
    """
    Assembles the final Note de Calcul document locally on the Django backend
    based on raw artifacts (RTF notes, reactions, screenshots) from the Unified Robot Worker.
    """
    try:
        job = CalculationJob.objects.get(id=calculation_id)
    except CalculationJob.DoesNotExist:
        print(f"assemble_ndc_document: Job {calculation_id} not found.")
        return

    if job.calculation_type == "rrh":
        _assemble_rrh(job)
    else:
        _assemble_antenna(job)

def _assemble_rrh(job):
    """
    Assembles the RRH Note de Calcul document from templates/rrh/ and converts to PDF.
    """
    template_path = os.path.join(settings.BASE_DIR, "templates", "rrh", "NDC RRH-1.docx")
    if not os.path.exists(template_path):
        print(f"assemble_ndc_document: Template not found at {template_path}")
        return

    output_dir = os.path.join(settings.MEDIA_ROOT, "ndc")
    os.makedirs(output_dir, exist_ok=True)

    try:
        from docx import Document
        doc = Document(template_path)

        # Fill document placeholders if needed
        # Save compiled DOCX
        output_docx = os.path.join(output_dir, f"ndc_rrh_{job.id}.docx")
        doc.save(output_docx)

        with open(output_docx, "rb") as f:
            job.compiled_docx.save(f"ndc_rrh_{job.id}.docx", File(f), save=False)

        # Convert to PDF via LibreOffice headless if available
        try:
            cmd = ["libreoffice", "--headless", "--convert-to", "pdf", output_docx, "--outdir", output_dir]
            subprocess.run(cmd, check=True, timeout=30, capture_output=True)
            output_pdf = os.path.join(output_dir, f"ndc_rrh_{job.id}.pdf")
            if os.path.exists(output_pdf):
                with open(output_pdf, "rb") as f:
                    job.compiled_pdf.save(f"ndc_rrh_{job.id}.pdf", File(f), save=False)
        except Exception as conv_err:
            print(f"LibreOffice PDF conversion note: {conv_err}")

        job.save()
        print(f"assemble_ndc_document: Successfully compiled RRH NDC for Job {job.id}.")

    except Exception as e:
        print(f"assemble_ndc_document error for RRH Job {job.id}: {e}")

def _assemble_antenna(job):
    """
    Triggers the existing antenna NDC generation pipeline via geodata.ndc_generator.
    """
    try:
        from geodata.ndc_generator import generate_ndc_pdf_task
        photo_url = (job.input_data or {}).get("site_image_url", "")
        pdf_url = generate_ndc_pdf_task(job.id, photo_url)
        print(f"assemble_ndc_document: Successfully compiled Antenna NDC for Job {job.id}: {pdf_url}")
    except Exception as e:
        print(f"assemble_ndc_document error for Antenna Job {job.id}: {e}")

