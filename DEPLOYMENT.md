# NDC Production Deployment Guide

This document outlines the final system-level configurations required to safely and performantly run the NDC application in a production environment.

## 1. Caddy Performance & Limits Optimization

Caddy handles modern security and performance out of the box. To handle large geographic uploads and cache static assets effectively, create a `Caddyfile` (usually located at `/etc/caddy/Caddyfile`):

```caddyfile
# Your domain
yourdomain.com {
    encode zstd gzip

    # 1. Reverse proxy to Django (e.g., Gunicorn running on port 8000)
    handle_path /* {
        reverse_proxy localhost:8000
    }

    # 2. Optimize Static Asset Delivery
    handle_path /static/* {
        root * /root/CascadeProjects/ndc/backend/static_collected
        file_server
        header Cache-Control "public, max-age=2592000"
    }

    handle_path /media/* {
        root * /root/CascadeProjects/ndc/backend/media
        file_server
        header Cache-Control "public, max-age=2592000"
    }
}
```

> [!TIP]
> After modifying your Caddyfile, reload the configuration using `caddy reload --config /etc/caddy/Caddyfile`.

---

## 2. Log Rotation (`logrotate`)

To prevent your logs from exhausting the server's disk space, create a new logrotate configuration.

Create the file `/etc/logrotate.d/ndc`:
```bash
/root/CascadeProjects/ndc/backend/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
}
```

> [!NOTE]
> This configuration will compress and retain logs for 14 days, rotating them on a daily basis.

---

## 3. Scheduled Backups (Crontab)

We have implemented a CAELUS-style deduplicating backup script in `backend/scripts/backup.sh`. It must be scheduled to run daily during off-peak hours.

Edit your crontab using `crontab -e` and append the following line to run the backup every day at 3:00 AM:

```bash
0 3 * * * /root/CascadeProjects/ndc/backend/scripts/backup.sh >> /var/log/ndc_backup.log 2>&1
```

> [!IMPORTANT]
> The Syncthing service in `docker-compose.yml` will automatically replicate the resulting snapshots in the `backups/` directory off-site.

---

## 4. Initializing Database Caching

Before starting the production server, you must create the caching table in the PostgreSQL database. This allows Django to persist cache data across all Gunicorn/Uvicorn/Daphne worker processes.

Navigate to your backend directory and run:

```bash
cd /root/CascadeProjects/ndc/backend
source venv/bin/activate  # Or whichever environment manager you use
python manage.py createcachetable
```
