# MySQL Admin Setup

## Tujuan

Backend admin sekarang tidak lagi memakai user dan audit log hardcoded. Data admin disimpan di MySQL.

## Dependency

Backend memakai:

- `mysql2`
- `dotenv`

## Environment

Salin [backend/.env.example](/home/akhyar/Dokumen/Code/NODE_JS/monopoly/backend/.env.example) menjadi `.env` di folder `backend`.

Variabel yang dipakai:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

## Database

Buat database MySQL lebih dulu:

```sql
CREATE DATABASE monopoly_admin;
```

Saat backend start, server akan otomatis membuat tabel berikut jika belum ada:

- `admin_users`
- `admin_sessions`
- `admin_audit_logs`
- `game_config`
- `board_versions`

## Seed Default Admin

Jika tabel `admin_users` belum berisi username default, backend akan otomatis menambahkan:

- `admin / admin123`
- `ops / ops123`
- `support / support123`
- `analyst / analyst123`

Password tidak disimpan plaintext. Backend menyimpan hash berbasis `scrypt`.

## Menjalankan

Masuk ke folder backend lalu jalankan:

```bash
npm install
npm run dev
```

Jika koneksi MySQL salah atau database belum ada, backend akan gagal start dan menampilkan error.

## Cakupan Persistensi Saat Ini

Sudah memakai MySQL:

- admin users
- admin sessions
- admin audit logs
- game config
- board versions

Masih in-memory:

- room live state
- board live state
- player live state saat game sedang berjalan

Kalau ingin full persistence berikutnya, langkah lanjutan yang paling tepat adalah memindahkan:

1. `game_config`
2. `board_versions`
3. `room snapshots / match history`
