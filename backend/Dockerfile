FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies required for GeoDjango, PostGIS, WeasyPrint, and headless LibreOffice
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
    libreoffice-writer-nogui \
    fonts-dejavu-core \
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

# Single async ASGI worker keeps InMemoryChannelLayer WebSockets reliable without Redis,
# while heavy CPU/blocking tasks run in the separate `qcluster` container.
CMD ["gunicorn", "asgi:application", "-k", "uvicorn_worker.UvicornWorker", "--workers", "1", "--timeout", "180", "--graceful-timeout", "30", "--bind", "0.0.0.0:8000"]
