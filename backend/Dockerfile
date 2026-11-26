FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

ARG INSTALL_LIBREOFFICE=false

# Install system dependencies required for GeoDjango, PostGIS, WeasyPrint, and optional LibreOffice fallback
RUN apt-get update && apt-get install -y --no-install-recommends \
    binutils \
    libproj-dev \
    gdal-bin \
    libgdal-dev \
    gcc \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-dejavu-core \
    && if [ "$INSTALL_LIBREOFFICE" = "true" ]; then apt-get install -y --no-install-recommends libreoffice-writer-nogui; fi \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install pinned Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project and create non-root runtime user
COPY . /app/
RUN useradd --create-home --shell /bin/bash appuser && \
    mkdir -p /app/media /app/staticfiles && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Multi-worker WSGI Gunicorn (--preload shares read-only code/data across workers),
# while WebSockets run in Go `ws-hub` and heavy PDF/Robot tasks run in `qcluster`.
CMD ["sh", "-c", "gunicorn wsgi:application --workers ${GUNICORN_WORKERS:-3} --threads ${GUNICORN_THREADS:-2} --preload --timeout 180 --graceful-timeout 30 --max-requests 1000 --max-requests-jitter 100 --bind 0.0.0.0:8000"]
