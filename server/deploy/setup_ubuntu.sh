#!/usr/bin/env bash
# ==============================================================================
# MailMind AI — Ubuntu 22.04 / 24.04 Setup Script for Oracle Cloud Always Free VM
# ==============================================================================
set -euo pipefail

echo "========================================================"
echo " MailMind AI: Setting up Oracle Cloud Ubuntu VM"
echo "========================================================"

# 1. Update system packages
echo "--> Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git build-essential ufw nginx certbot python3-certbot-nginx sqlite3 iptables-persistent netfilter-persistent

# 2. Open firewall ports (Oracle Cloud Ubuntu specific iptables fix)
echo "--> Configuring firewall rules for HTTP (80) & HTTPS (443)..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# 3. Install Node.js 22 LTS
echo "--> Installing Node.js 22 LTS..."
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "Node version: $(node -v)"
echo "NPM version:  $(npm -v)"

# 4. Install PM2 globally
echo "--> Installing PM2 Process Manager..."
sudo npm install -g pm2

# 5. Setup application directory
echo "--> Setting up application directory at /opt/mailmind..."
sudo mkdir -p /opt/mailmind
sudo chown -R "$USER":"$USER" /opt/mailmind

# 6. Ensure PM2 starts on system boot
echo "--> Configuring PM2 startup hook..."
pm2 startup systemd -u "$USER" --hp "$HOME" || true

echo "========================================================"
echo " Setup complete! Next steps:"
echo " 1. Clone repository to /opt/mailmind"
echo " 2. Copy production .env to /opt/mailmind/server/.env"
echo " 3. Run 'npm --prefix /opt/mailmind/server install --production'"
echo " 4. Start app: 'pm2 start /opt/mailmind/server/ecosystem.config.cjs'"
echo " 5. Configure Nginx and SSL (certbot)"
echo "========================================================"
