#!/usr/bin/env bash
# =============================================================================
# setup-vps.sh — One-time Contabo VPS setup for QAQC4BI
#
# Run as root (or with sudo) on a fresh Ubuntu server:
#   curl -sSL <url> | bash
#   — or —
#   chmod +x setup-vps.sh && sudo ./setup-vps.sh
# =============================================================================
set -euo pipefail

APP_DIR="/opt/qaqc4bi"
APP_USER="qaqc4bi"

echo "==> Updating system packages..."
apt-get update && apt-get upgrade -y

# -------------------------------------------------------------------------
# 1. Install Docker
# -------------------------------------------------------------------------
echo "==> Installing Docker..."
if ! command -v docker &>/dev/null; then
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
else
    echo "    Docker already installed, skipping."
fi

# -------------------------------------------------------------------------
# 2. Install Nginx and Certbot
# -------------------------------------------------------------------------
echo "==> Installing Nginx and Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx

# -------------------------------------------------------------------------
# 3. Create application directory and dedicated user
# -------------------------------------------------------------------------
echo "==> Setting up application directory at ${APP_DIR}..."
if ! id -u "${APP_USER}" &>/dev/null; then
    useradd --system --shell /usr/sbin/nologin --home-dir "${APP_DIR}" "${APP_USER}"
fi
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# -------------------------------------------------------------------------
# 4. Configure UFW firewall
# -------------------------------------------------------------------------
echo "==> Configuring UFW firewall..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
ufw --force enable
ufw status verbose

# -------------------------------------------------------------------------
# 5. Create systemd service
# -------------------------------------------------------------------------
echo "==> Creating systemd service..."
cat > /etc/systemd/system/qaqc4bi.service <<'EOF'
[Unit]
Description=QAQC4BI Next.js Application
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/qaqc4bi
ExecStart=/usr/bin/docker compose up -d --remove-orphans
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose up -d --build --remove-orphans
TimeoutStartSec=120
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable qaqc4bi.service

# -------------------------------------------------------------------------
# 6. Copy Nginx config (if present alongside this script)
# -------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/nginx.conf" ]; then
    echo "==> Installing Nginx site config..."
    cp "${SCRIPT_DIR}/nginx.conf" /etc/nginx/sites-available/qaqc4bi
    ln -sf /etc/nginx/sites-available/qaqc4bi /etc/nginx/sites-enabled/qaqc4bi
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
fi

echo ""
echo "============================================="
echo "  VPS setup complete!"
echo "============================================="
echo ""
echo "Next steps:"
echo "  1. Clone your repo into ${APP_DIR}:"
echo "     git clone https://github.com/kuntumseroja/QAQC.git ${APP_DIR}"
echo ""
echo "  2. Copy your .env.local into ${APP_DIR}/.env.local"
echo ""
echo "  3. Run the deploy script:"
echo "     cd ${APP_DIR} && bash deploy/deploy.sh"
echo ""
echo "  4. Set up SSL with Certbot:"
echo "     certbot --nginx -d qaqc4bi.example.com"
echo ""
