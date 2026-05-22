#!/bin/bash
set -e

echo "==================================================="
echo "  Turnless Monopoly - Proxmox CT Auto Installer"
echo "==================================================="

# 1. Pastikan script dijalankan sebagai root (karena Proxmox CT biasanya butuh akses ini)
if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: Silakan jalankan script ini sebagai root (contoh: sudo ./install.sh)"
  exit 1
fi

APP_DIR=$(pwd)

echo "[1/5] Memperbarui sistem dan menginstal MySQL Server..."
apt-get update -y
apt-get install -y mysql-server openssl

echo "[2/5] Mengamankan dan mengkonfigurasi Database..."
# Start MySQL jika belum berjalan
systemctl start mysql || service mysql start

# Membuat password acak yang sangat kuat (16 karakter) agar aman dari hacker
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 16)
DB_USER="monopoly_app"
DB_NAME="monopoly_admin"

# Mengeksekusi perintah MySQL untuk membuat DB dan User tanpa terekspos ke luar (hanya localhost)
mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};"
mysql -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';"
mysql -e "CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "[3/5] Membuat file konfigurasi (.env) rahasia..."
# Menyimpan kredensial ke .env, aplikasi menggunakan port 80 agar bisa diakses langsung via IP
cat <<EOF > "${APP_DIR}/.env"
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=${DB_USER}
MYSQL_PASSWORD=${DB_PASSWORD}
MYSQL_DATABASE=${DB_NAME}
PORT=80
EOF

# Mengamankan file .env agar hanya sistem yang bisa membacanya
chmod 600 "${APP_DIR}/.env"
chmod +x "${APP_DIR}/backend-linux"

echo "[4/5] Mendaftarkan aplikasi sebagai Systemd Service (berjalan di background)..."
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

# Reload dan jalankan service
systemctl daemon-reload
systemctl enable monopoly
systemctl restart monopoly

echo "[5/5] Selesai!"
echo "==================================================="
echo "✅ Instalasi Berhasil!"
echo "✅ MySQL telah diamankan. Password di-generate secara acak dan hanya diketahui oleh sistem."
echo "✅ Aplikasi Monopoly berjalan di background secara otomatis."
echo ""
echo "Akses game melalui browser menggunakan IP dari Proxmox Container ini."
echo "(Contoh: http://<IP_CT_PROXMOX>)"
echo "==================================================="
