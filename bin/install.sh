#!/bin/bash
set -e

echo "==================================================="
echo "  Turnless Monopoly - Proxmox CT Auto Installer"
echo "==================================================="

# Pastikan script dijalankan sebagai root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: Silakan jalankan script ini sebagai root (contoh: sudo ./install.sh)"
  exit 1
fi

APP_DIR=$(pwd)
chmod +x "${APP_DIR}/backend-linux" || true

# CEK JIKA SUDAH PERNAH DIINSTALL
if [ -f "${APP_DIR}/.env" ]; then
  echo "♻️ Konfigurasi (.env) sudah ada! Menjalankan mode Update/Restart..."
  
  if systemctl list-unit-files | grep -q monopoly.service; then
    echo "🔄 Merestart service backend-linux..."
    systemctl daemon-reload
    systemctl restart monopoly
    echo "✅ Berhasil merestart backend!"
  else
    echo "⚠️ Service monopoly belum terdaftar, silakan hapus .env jika ingin instalasi ulang dari nol."
  fi
  
  if systemctl is-active --quiet nginx; then
    echo "🔄 Merestart service nginx..."
    systemctl reload nginx
  fi

  echo "==================================================="
  echo "✅ Update & Restart Selesai!"
  exit 0
fi

# JIKA BELUM PERNAH DIINSTALL (Instalasi Baru)
echo "🚀 Menjalankan Instalasi Baru..."

echo "[1/5] Memperbarui sistem dan menginstal MySQL Server & NGINX..."
apt-get update -y
apt-get install -y mysql-server openssl nginx

echo "[2/5] Mengamankan dan mengkonfigurasi Database..."
systemctl start mysql || service mysql start

# Membuat password acak yang aman (16 karakter)
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 16)
DB_USER="monopoly_app"
DB_NAME="monopoly_admin"

mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};"
mysql -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';"
mysql -e "CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "[3/5] Membuat file konfigurasi (.env) rahasia..."
# Backend akan berjalan di port internal 3000
cat <<EOF > "${APP_DIR}/.env"
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=${DB_USER}
MYSQL_PASSWORD=${DB_PASSWORD}
MYSQL_DATABASE=${DB_NAME}
PORT=3000
EOF

chmod 600 "${APP_DIR}/.env"

echo "[4/5] Mengkonfigurasi NGINX Reverse Proxy..."
DOMAIN="monopoly.politeknikindonusa.ac.id"

# Membuat konfigurasi NGINX yang meneruskan port 80 ke port 3000 beserta WebSocket headers
cat <<EOF > /etc/nginx/sites-available/monopoly
server {
    listen 80;
    server_name ${DOMAIN} _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        
        # Konfigurasi wajib untuk WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Teruskan IP asli
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Hapus default nginx dan aktifkan konfigurasi monopoly
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/monopoly /etc/nginx/sites-enabled/monopoly

systemctl restart nginx
systemctl enable nginx

echo "[5/5] Mendaftarkan aplikasi sebagai Systemd Service (berjalan di background)..."
cat <<EOF > /etc/systemd/system/monopoly.service
[Unit]
Description=Turnless Monopoly Server
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=${APP_DIR}
ExecStart=${APP_DIR}/backend-linux
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable monopoly
systemctl restart monopoly

echo "==================================================="
echo "✅ Instalasi Berhasil!"
echo "✅ MySQL dan NGINX telah terkonfigurasi dengan sempurna."
echo "✅ NGINX otomatis bertindak sebagai reverse proxy (Port 80 -> Port 3000) dan mendukung WebSocket."
echo "✅ Aplikasi Monopoly telah aktif."
echo ""
echo "ℹ️ Jika di masa depan Anda mengganti file 'backend-linux' lalu menjalankan ulang './install.sh',"
echo "    sistem HANYA akan merestart aplikasinya tanpa menghapus database/konfigurasi."
echo "==================================================="
