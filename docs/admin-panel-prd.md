# PRD Admin Panel - Turnless Monopoly

## 1. Tujuan

Admin panel dipakai untuk mengoperasikan game secara live, memantau room aktif, menangani pemain bermasalah, mengatur ekonomi permainan, dan melihat audit perubahan. Fokus utamanya adalah kontrol operasional real-time, bukan sekadar dashboard statistik.

## 2. Persona

- `super_admin`: akses penuh ke konfigurasi, board, audit, dan intervensi game.
- `game_master`: memantau room, mengirim broadcast, mengakhiri game, menangani player state.
- `support`: lihat room dan player, aksi terbatas seperti kick atau reconnect handling.
- `analyst`: akses read-only untuk metrik dan audit log.

## 3. Outcome MVP

- Admin bisa login.
- Admin bisa melihat room aktif dan status game secara real-time.
- Admin bisa membuka detail room dan melihat state papan, pemain, event log, trade, debt, dan auction.
- Admin bisa melihat detail pemain dan melakukan intervensi dasar.
- Semua aksi admin tercatat di audit log.

## 4. Informasi Yang Harus Tersedia

### Dashboard

- Total room aktif
- Total pemain online
- Match sedang berjalan
- Match selesai hari ini
- Jumlah pemain `in_debt`
- Jumlah trade aktif
- Jumlah auction aktif
- Rata-rata durasi game

### Room Monitor

- `roomCode`
- status `waiting / playing / ended / frozen`
- host
- jumlah pemain
- waktu mulai
- daftar pemain dan status
- event log live
- trade offers aktif
- auction aktif
- debt timer pemain

### Player Detail

- `playerId` / socket id
- nama
- avatar
- room saat ini
- balance
- properties
- status
- cooldown
- debt deadline
- riwayat intervensi admin

## 5. Navigasi Panel

- Dashboard
- Rooms
- Players
- Economy
- Board Editor
- Audit Log
- Analytics

## 6. Halaman dan Fitur

### 6.1 Dashboard

Tujuan: memberi ringkasan cepat kondisi sistem.

Komponen:

- KPI cards
- grafik room aktif per waktu
- daftar room paling ramai
- daftar event kritis terbaru

### 6.2 Rooms

Tujuan: memantau semua room dan melakukan intervensi per room.

Daftar room:

- kode room
- status
- host
- jumlah pemain
- created at
- started at

Aksi:

- buka detail
- end game
- freeze room
- broadcast ke room

Detail room:

- state pemain
- kepemilikan tile
- trade offer aktif
- auction state
- pemain dengan status `in_debt`, `jailed`, `bankrupt`
- event log live

### 6.3 Players

Tujuan: melihat dan menangani pemain individual.

Daftar:

- nama
- socket id
- room
- balance
- status
- connected / disconnected

Aksi:

- kick dari room
- set balance
- set position
- release from jail
- reset cooldown
- set bankrupt

### 6.4 Economy

Tujuan: mengatur parameter game global.

Field konfigurasi:

- initial balance
- pass GO reward
- cooldown roll
- buy timeout
- debt timeout
- trade expiry
- jail fee

Toggle fitur:

- enable auction
- enable trade
- enable mortgage
- enable houses/hotels

### 6.5 Board Editor

Tujuan: mengubah isi papan tanpa edit kode langsung.

Field per tile:

- name
- type
- colorGroup
- price
- rent
- houseCost
- taxAmount

Fitur:

- draft board version
- preview
- publish
- rollback

### 6.6 Audit Log

Tujuan: semua aksi admin dapat ditelusuri.

Kolom:

- timestamp
- admin
- role
- action
- target type
- target id
- before
- after

### 6.7 Analytics

Tujuan: analisis ekonomi dan perilaku permainan.

Metrik:

- properti paling sering dibeli
- properti paling mahal total rent yang dihasilkan
- rata-rata trade per game
- rata-rata mortgage per game
- persentase bangkrut
- win rate per durasi game

## 7. Aturan Intervensi Admin

- Semua intervensi harus menghasilkan audit log.
- Intervensi yang mengubah game state hanya boleh oleh `super_admin` dan `game_master`.
- Intervensi ke room `playing` harus mem-broadcast perubahan state ke semua pemain di room itu.
- Aksi destruktif seperti `end game`, `set bankrupt`, atau `reset board` harus ada konfirmasi.

## 8. Real-time Requirements

- Dashboard refresh via websocket atau polling singkat.
- Room detail harus real-time.
- Player status harus ter-update saat koneksi putus/masuk kembali.
- Event log admin dan game tidak boleh tercampur tanpa label.

## 9. Desain UI

### Layout

- sidebar kiri untuk navigasi
- topbar untuk search, filter, dan environment badge
- main content untuk tabel dan detail
- right drawer untuk detail cepat

### Visual Direction

- gunakan gaya operasional: kontras jelas, padat informasi, bukan landing page marketing
- warna status:
  - hijau untuk healthy
  - kuning untuk warning
  - merah untuk critical
  - biru untuk informational

### Komponen Kunci

- table dengan filter dan search
- live event feed
- sticky action bar untuk aksi admin
- modal konfirmasi untuk aksi kritis

## 10. Model Data Tambahan

### admin_users

- id
- email
- password_hash
- role
- created_at
- last_login_at

### admin_audit_logs

- id
- admin_user_id
- action
- target_type
- target_id
- before_json
- after_json
- created_at

### game_config

- key
- value_json
- updated_by
- updated_at

### board_versions

- id
- name
- board_json
- published_at
- created_by

## 11. API Rancangan

### Auth

- `POST /admin/auth/login`
- `POST /admin/auth/logout`
- `GET /admin/auth/me`

### Dashboard

- `GET /admin/dashboard/summary`

### Rooms

- `GET /admin/rooms`
- `GET /admin/rooms/:code`
- `POST /admin/rooms/:code/end`
- `POST /admin/rooms/:code/freeze`
- `POST /admin/rooms/:code/broadcast`

### Players

- `GET /admin/players`
- `GET /admin/players/:id`
- `POST /admin/players/:id/balance`
- `POST /admin/players/:id/position`
- `POST /admin/players/:id/status`

### Config

- `GET /admin/config`
- `PUT /admin/config`

### Board

- `GET /admin/board`
- `PUT /admin/board/:tileId`
- `POST /admin/board/publish`
- `GET /admin/board/versions`

### Audit

- `GET /admin/audit-logs`

## 12. Tahap Implementasi

### Phase 1 - Operational MVP

- auth admin
- dashboard summary
- rooms list
- room detail real-time
- player list/detail
- end game
- broadcast
- audit log dasar

### Phase 2 - Control Layer

- edit balance/player state
- freeze room
- config editor
- role permissions

### Phase 3 - System Editor

- board editor
- versioning
- analytics

## 13. Risiko Teknis

- admin intervensi ke room live bisa menyebabkan state race jika tidak lewat game engine
- perubahan config global perlu batasan apakah berlaku ke room baru saja atau juga room yang sedang berjalan
- board editor harus punya validasi agar tile config tidak merusak perhitungan rent/house/mortgage

## 14. Rekomendasi Arsitektur

- backend admin dipisah namespace route `/admin`
- gunakan middleware auth + role guard
- intervensi game wajib memanggil method `GameEngine`, jangan mutate `room` langsung
- tambahkan adapter `AdminService` untuk membaca room snapshot dan analytics
- frontend admin sebaiknya dibuat sebagai route terpisah di app yang sama: `/admin`
