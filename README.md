# Sovry

### **Fase 1: Smart Contract**

* **`SovryFactory`:**
    * **Tata Kelola:** Menggunakan **TimelockController** OpenZeppelin. Semua perubahan kritis (seperti `setFeeTo`) memiliki penundaan waktu (misal, 1 hari).
    * **Biaya Protokol:** Mengaktifkan kemampuan untuk mengumpulkan 1/6 dari biaya perdagangan untuk kas protokol.
* **`SovryPool`:**
    * **Perlindungan Flash Loan:** Menerapkan oracle **TWAP** (Time-Weighted Average Price), membuat manipulasi harga *flash loan* menjadi tidak mungkin secara ekonomis.
    * **Emergency Pause:** Memiliki "Circuit Breaker". `PAUSER_ROLE` dapat menghentikan `swap` dan `mint`, **tetapi `burn` (penarikan likuiditas) tetap aktif**. Dana pengguna tidak pernah terkunci.
* **`SovryRouter`:**
    * **Dukungan Token Khusus:** Dibangun untuk menangani **"Fee-on-Transfer"** token secara akurat.
    * **Perlindungan Pengguna:** Menerapkan `deadline` yang ketat pada semua fungsi.

---

### **Fase 2: Backend**

* **Arsitektur:** Node.js/Express yang siap-serverless (Vercel).
* **Ketahanan (Resilience):**
    * **Caching:** **Redis (Upstash)** untuk *persistent caching*.
    * **Circuit Breaker:** Menggunakan `opossum`. Jika Goldsky *down*, API beralih ke *cache* basi.
* **Pipeline Data (Goldsky):**
    * Skema GraphQL lengkap yang mengindeks event `IPRegistered`, `RoyaltyPaid`, `PoolCreated`, `Swap`, `Mint`, dan `Burn`.
* **Curation API (Fitur Unggulan):**
    * Endpoint `GET /api/assets/:ipId/metadata` yang mengambil, menyelesaikan (resolve) IPFS, dan menyajikan JSON metadata yang kaya (nama, gambar, deskripsi).

---

### **Fase 3: Frontend**

* **Stack:** Next.js 14, **Dynamic.xyz** (Wallet), Wagmi & SWR (Data).
* **Alur Pengguna Inti (Halaman Detail Pool):**
    * Desain dua kolom: **Analisis di Kiri, Aksi di Kanan**.
    * **Kolom Analisis Aset:** Menampilkan Gambar IP, Deskripsi, dan **Grafik Pendapatan Royalti** (dari `/api/revenue`).
    * **Kolom Aksi Perdagangan:** Widget **Swap** dan **Grafik Harga** (dari `/api/chart`).
* **Siklus Lengkap (Full Loop):**
    * Pengguna dapat **mengklaim pendapatan** royalti mereka langsung dari UI (memanggil `IPRoyaltyVault`).

---

### **Fase 4: DevOps & Produksi**

* **Deployment Kontrak:** Skrip Hardhat otomatis (`scripts/deploy.ts`) yang mendeploy dan **otomatis memverifikasi** kontrak di explorer.
* **Indexing Produksi:** Konfigurasi `goldsky.yaml` yang menggunakan **sumber data dinamis** untuk otomatis mengindeks setiap pool baru.
* **Hosting:** Frontend dan Backend di-deploy ke **Vercel**.
* **Monitoring 24/7 (Tenderly):**
    * **Alert Keamanan:** Notifikasi instan jika ada panggilan fungsi admin.
    * **Alert Kegagalan:** Notifikasi jika `swap` mulai gagal (revert).
    * **Alert "Rug Pull":** Notifikasi jika ada penarikan likuiditas dalam jumlah besar.

---
