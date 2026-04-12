# QAQC4BI Deployment Guide

## Prerequisites

- Contabo VPS running Ubuntu 22.04 or 24.04
- A domain name pointed to your VPS IP address
- SSH access as root (or a user with sudo)

## Quick Start

### 1. Initial VPS Setup (run once)

SSH into your server and run:

```bash
# Upload the deploy folder to the server, then:
chmod +x deploy/setup-vps.sh
sudo ./deploy/setup-vps.sh
```

This installs Docker, Docker Compose, Nginx, Certbot, configures the firewall,
and creates the `/opt/qaqc4bi` directory with a systemd service.

### 2. Clone the Repository

```bash
sudo git clone https://github.com/kuntumseroja/QAQC.git /opt/qaqc4bi
```

### 3. Configure Environment

Create the environment file with your API key and settings:

```bash
sudo nano /opt/qaqc4bi/.env.local
```

Required variables:

```
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=anthropic
```

### 4. Deploy the Application

```bash
cd /opt/qaqc4bi
sudo bash deploy/deploy.sh
```

The script pulls the latest code, builds the Docker image, starts the container,
and verifies the health check.

### 5. Set Up SSL

Edit `deploy/nginx.conf` and replace `qaqc4bi.example.com` with your domain,
then run Certbot:

```bash
sudo certbot --nginx -d yourdomain.com
```

Certbot auto-renews certificates via a systemd timer.

## Ongoing Deployments

After pushing changes to the `main` branch on GitHub:

```bash
cd /opt/qaqc4bi && sudo bash deploy/deploy.sh
```

## Useful Commands

| Task                  | Command                                            |
|-----------------------|----------------------------------------------------|
| View logs             | `cd /opt/qaqc4bi && docker compose logs -f`        |
| Restart app           | `sudo systemctl restart qaqc4bi`                   |
| Stop app              | `sudo systemctl stop qaqc4bi`                      |
| Check status          | `docker compose ps`                                |
| Rebuild from scratch  | `docker compose build --no-cache && docker compose up -d` |
| Enter container shell | `docker compose exec qaqc4bi sh`                   |

## SQLite Database

The SQLite database is persisted in a Docker volume (`qaqc4bi-data`).
To back it up:

```bash
docker compose exec qaqc4bi cp /app/data/qaqc4bi.db /app/data/backup.db
docker cp qaqc4bi:/app/data/backup.db ./qaqc4bi-backup.db
```

## Architecture

```
Internet --> Nginx (80/443) --> Docker (localhost:3000) --> Next.js App
                                         |
                                   SQLite (volume)
```
