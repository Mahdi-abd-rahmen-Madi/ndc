#!/bin/bash

# NDC Daily Backup Script with Snapshot Deduplication
# Runs off-peak (e.g. 3:00 AM) and only saves new backups if data changed.
# Automatically synchronized off-site via Syncthing.

set -e

PROJECT_DIR="/root/CascadeProjects/ndc/backend"
BACKUP_DIR="${PROJECT_DIR}/backups/daily"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TMP_DIR=$(mktemp -d)

mkdir -p "$BACKUP_DIR"

cd "$PROJECT_DIR"

echo "[$(date)] Starting backup process..."

# 1. Dump database
echo "Dumping PostgreSQL database..."
docker compose exec -T db pg_dump -U ndc_user ndc_db | gzip > "${TMP_DIR}/db_backup.sql.gz"

# 2. Archive Local Volumes (media, static_collected)
echo "Archiving media and static directories..."
# Check if directories exist to prevent tar errors
DIRS_TO_BACKUP=""
if [ -d "media" ]; then DIRS_TO_BACKUP="media "; fi
if [ -d "static_collected" ]; then DIRS_TO_BACKUP="${DIRS_TO_BACKUP}static_collected"; fi

if [ -n "$DIRS_TO_BACKUP" ]; then
    tar czf "${TMP_DIR}/volumes_backup.tar.gz" -C "${PROJECT_DIR}" $DIRS_TO_BACKUP
else
    # Create empty tar if neither exists
    tar czf "${TMP_DIR}/volumes_backup.tar.gz" -T /dev/null
fi

# 3. Deduplication / Snapshot logic
echo "Computing snapshot fingerprint..."
# Generate a fingerprint of current state
# For DB: we extract the dump, strip lines with timestamps, and hash it
zcat "${TMP_DIR}/db_backup.sql.gz" | grep -v '^-- Dumped ' | md5sum | awk '{print $1}' > "${TMP_DIR}/fingerprint.txt"
# For volumes: we list the files with their sizes and hash that list
tar -tzvf "${TMP_DIR}/volumes_backup.tar.gz" | awk '{print $3, $6}' | md5sum | awk '{print $1}' >> "${TMP_DIR}/fingerprint.txt"
FINGERPRINT=$(md5sum "${TMP_DIR}/fingerprint.txt" | awk '{print $1}')

LAST_FINGERPRINT_FILE="${BACKUP_DIR}/last_fingerprint.txt"
if [ -f "$LAST_FINGERPRINT_FILE" ]; then
    LAST_FINGERPRINT=$(cat "$LAST_FINGERPRINT_FILE")
    if [ "$FINGERPRINT" == "$LAST_FINGERPRINT" ]; then
        echo "No data changes detected since last backup. Discarding new backup."
        rm -rf "$TMP_DIR"
        exit 0
    fi
fi

# Data changed (or first run). Move files to backup dir.
echo "Data changes detected. Saving new snapshot..."
mv "${TMP_DIR}/db_backup.sql.gz" "${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"
mv "${TMP_DIR}/volumes_backup.tar.gz" "${BACKUP_DIR}/volumes_backup_${TIMESTAMP}.tar.gz"
echo "$FINGERPRINT" > "$LAST_FINGERPRINT_FILE"

# 4. Retention Policy (Keep last 7 snapshots)
echo "Cleaning up old snapshots (keeping last 7)..."
cd "$BACKUP_DIR"
ls -tp db_backup_*.sql.gz | grep -v '/$' | tail -n +8 | xargs -I {} rm -- {} 2>/dev/null || true
ls -tp volumes_backup_*.tar.gz | grep -v '/$' | tail -n +8 | xargs -I {} rm -- {} 2>/dev/null || true

rm -rf "$TMP_DIR"
echo "[$(date)] Backup completed successfully."
