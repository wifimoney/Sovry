<<<<<<< HEAD
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
=======
# Sovry: The Royalty-Aware DEX for Story Protocol

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Story Protocol](https://img.shields.io/badge/Story%20Protocol-Aeneid%20Testnet-purple.svg)
![Powered by Goldsky](https://img.shields.io/badge/Indexed%20by-Goldsky-blue.svg)
![Monitored by Tenderly](https://img.shields.io/badge/Monitored%20by-Tenderly-pink.svg)

Sovry adalah Automated Market Maker (AMM) berkinerja tinggi yang dibangun di atas **Story Protocol (Aeneid Testnet)**. Ini dirancang khusus untuk memfasilitasi perdagangan yang likuid dan transparan antara **Wrapped IP ($WIP)** dan **IP Royalty Tokens ($rIP)**.

**Fitur Unik (Killer Feature):** Sovry bukan sekadar DEX. Ini adalah *platform analisis pendapatan*. Kami mengintegrasikan data pendapatan royalti *on-chain* secara real-time langsung ke dalam antarmuka perdagangan, memungkinkan pedagang untuk membuat keputusan berdasarkan data fundamental (pendapatan aktual) selain spekulasi.

---

## 🚀 Masalah yang Dipecahkan

Di ekosistem IP yang baru, menilai $rIP (Token Royalti) murni bersifat spekulatif. Pedagang tidak memiliki cara mudah untuk memverifikasi apakah sebuah IP *benar-benar menghasilkan pendapatan*. Mereka membeli secara buta, berharap nilai IP tersebut akan naik.

## 💡 Solusi Sovry

Sovry menjembatani kesenjangan informasi ini. Kami adalah DEX pertama yang "sadar royalti".

Saat Anda melihat chart harga `WIP/rIP-ABC`, kami juga menyajikan **grafik batang pendapatan royalti on-chain** untuk IP-ABC tersebut, yang diambil langsung dari event `RoyaltyPaid` di Story Protocol.

**Untuk pertama kalinya, Anda dapat memperdagangkan aset IP sambil menganalisis arus kas fundamentalnya di satu layar.**

Ini mengubah $rIP dari aset spekulatif murni menjadi aset yang didukung oleh pendapatan yang dapat diverifikasi.

## ✨ Fitur Utama

*   **Swap Bebas Izin:** Swap instan antara $WIP dan $rIP apa pun yang terdaftar di Story Protocol.
*   **Penyediaan Likuiditas:** Dapatkan biaya perdagangan dengan menyediakan likuiditas ke pool $WIP/$rIP.
*   **Grafik Pendapatan Royalti:** Fitur khas kami. Menganalisis data `RoyaltyPaid` historis untuk $rIP apa pun.
*   **Klaim Pendapatan Terintegrasi:** Membeli $rIP? Gunakan dasbor kami untuk mengklaim pendapatan Anda yang terkumpul langsung dari `IPRoyaltyVault`.
*   **Integrasi Metadata IP Kaya:** Ini bukan sekadar DEX biasa. Kami mengambil dan menampilkan metadata IP penuh dari Story Protocol. Saat Anda memperdagangkan $rIP, Anda melihat **gambar sampul, deskripsi, dan detail lisensi** aset tersebut, langsung di antarmuka perdagangan.
*   **Konteks Perdagangan Total:** Alur UX unik kami menyajikan analisis aset (detail IP, grafik pendapatan) berdampingan dengan aksi perdagangan (widget swap, grafik harga).
*   **Aman & Profesional:**
    *   Kontrak router memberlakukan **`deadline`** untuk melindungi dari front-running.
    *   Kontrak pool menggunakan **`ReentrancyGuard`** OpenZeppelin.
    *   Kepemilikan pabrik (untuk `feeTo`) dikelola oleh **`Ownable`** OpenZeppelin.
*   **Siap untuk Masa Depan:** Termasuk mekanisme *protocol fee* (biaya protokol) yang dapat diaktifkan oleh tata kelola (DAO) di masa depan.

## 🖼️ Arsitektur Sistem

\+--------------------------+
|  Frontend (Next.js 14)   |
| - Tampilan Metadata IP   |
| - Grafik Pendapatan      |
| - Komponen Swap          |
| - Wallet (Dynamic.xyz)   |
\+-----------|--------------+
| (Calls API)
|
\+-----------v--------------+
|  Backend API (Node.js)   |
| - Vercel Serverless      |
| - /api/pools (Daftar)    |
| - /api/assets/:ipId/revenue (Grafik #1)
| - /api/pools/:addr/chart (Grafik #2)
| - /api/assets/:ipId/metadata (Data Aset IP)
\+-----------|--------------+
| (Query)
|
\+-----------v--------------+
|   Indexing (Goldsky)     |
| - Mengindeks Swaps       |
| - Mengindeks RoyaltyPaid |
| - Mengindeks IPRegistered (untuk metadataURI) 
\+--------------------------+


## 🛠️ Dibangun Dengan (Tech Stack)

*   **Smart Contracts:** Solidity, Hardhat, Ethers.js, OpenZeppelin (Ownable, ReentrancyGuard), Uniswap V2 (Core Logic).
*   **Blockchain:** Story Protocol (Aeneid Testnet).
*   **Wallet Onboarding:** **Dynamic.xyz** (Login, Hooks `useWriteContract`, Konteks Wagmi/Viem).
*   **Pengindeksan Data:** **Goldsky** (GraphQL API untuk semua event on-chain, termasuk `RoyaltyPaid` & `Swap`).
*   **Testing & Monitoring:** **Tenderly** (Forking Testnet untuk pengujian, Alerting 24/7 untuk produksi).
*   **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts.
*   **Backend:** Node.js, Express.js, TypeScript.
*   **Deployment:** Vercel (Frontend & Backend), Skrip Hardhat (Contracts).

## 📂 Struktur Proyek

Proyek ini dikelola sebagai monorepo (atau repo terpisah yang terhubung):

/sovry-protocol ├── /contracts # Kontrak inti Solidity, skrip deployment, dan tes Hardhat │ ├── contracts/ │ │ ├── SovryFactory.sol │ │ ├── SovryPool.sol │ │ └── SovryRouter.sol │ ├── test/ │ │ └── SovryDEX.test.ts │ └── scripts/ │ └── deploy.ts │ ├── /backend # API Gateway Node.js/Express │ ├── src/ │ │ ├── api/routes.ts │ │ ├── services/goldskyClient.ts │ │ └── index.ts │ └── vercel.json │ └── /frontend # Aplikasi Next.js 14 ├── src/app/ │ ├── page.tsx (Halaman utama/daftar pool) │ ├── pool/[address]/page.tsx (Halaman detail/swap) │ └── providers.tsx (Provider Dynamic.xyz) ├── components/ │ └── SwapInterface.tsx └── lib/ └── ...


## 🏁 Memulai (Pengembangan Lokal)

### 1. Prasyarat

*   Node.js (v18+)
*   Yarn atau PNPM (disarankan)
*   Akun [Goldsky](https://goldsky.com/)
*   Akun [Dynamic.xyz](https://www.dynamic.xyz/)
*   Akun [Tenderly](https://tenderly.co/)

### 2. Instalasi

```bash
git clone [URL_REPOSITORI_ANDA]
cd sovry-protocol

# Instal dependensi di setiap paket
cd contracts && pnpm install
cd ../backend && pnpm install
cd ../frontend && pnpm install
3. Konfigurasi Lingkungan (.env)
Buat file .env di root proyek (atau di dalam setiap sub-folder) berdasarkan .env.example.

Bash

# Kunci API untuk layanan mitra
GOLDSKY_API_KEY="your_goldsky_api_key"
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID="your_dynamic_env_id"
TENDERLY_RPC_URL="your_tenderly_fork_rpc_url" # Untuk pengujian

# Kunci pribadi & RPC
AENEID_RPC_URL="[https://aeneid.storyrpc.io](https://aeneid.storyrpc.io)"
NEXT_PUBLIC_AENEID_RPC_URL="[https://aeneid.storyrpc.io](https://aeneid.storyrpc.io)"
PRIVATE_KEY="your_deployer_private_key"
OWNER_ADDRESS="your_multisig_or_owner_address"

# URL API (setelah backend di-deploy)
NEXT_PUBLIC_API_URL="http://localhost:3001" # Lokal
# NEXT_PUBLIC_API_URL="https.your-backend-prod.vercel.app" # Produksi
4. Menjalankan Tes Kontrak (vs Tenderly Fork)
Ini adalah langkah penting untuk memvalidasi logika kontrak terhadap state Aeneid yang sebenarnya.

Bash

cd contracts

# Jalankan tes
npx hardhat test
5. Menjalankan Proyek (Lokal)
Bash

# Terminal 1: Jalankan Backend API
cd backend
pnpm run dev # Berjalan di http://localhost:3001

# Terminal 2: Jalankan Frontend
cd frontend
pnpm run dev # Berjalan di http://localhost:3000
Buka http://localhost:3000 di browser Anda.

🚀 Deployment
Deployment proyek ini melibatkan tiga langkah utama:

Deployment Kontrak (via Hardhat):

Bash

cd contracts
npx hardhat run scripts/deploy.ts --network aeneid
Skrip ini akan mendeploy SovryFactory dan SovryRouter, menyuntikkan alamat yang diperlukan, dan secara otomatis memverifikasi kontrak di block explorer.

Deployment Pengindeksan (via Goldsky): Kita menggunakan file goldsky.yaml dan goldsky.schema.graphql (dari Fase 2).

Bash

# (Setelah menginstal Goldsky CLI)
goldsky deploy [NAMA_SUBGRAPH_ANDA] --path .
Konfigurasi goldsky.yaml kami diatur untuk secara dinamis mendeteksi pool baru yang dibuat oleh SovryFactory dan mulai mengindeksnya secara otomatis.

Deployment Web (via Vercel): Hubungkan repositori Anda ke Vercel. Vercel akan secara otomatis mendeteksi:

Proyek Frontend (Next.js): Dideploy sebagai aplikasi Next.js standar.

Proyek Backend (Node.js): Dideploy sebagai serverless functions menggunakan vercel.json untuk rewrites.

Variabel Lingkungan: Pastikan untuk menambahkan semua variabel dari .env ke pengaturan proyek Vercel Anda.

🤝 Integrasi Mitra Buildathon
Kami sangat berterima kasih kepada mitra teknologi yang membuat proyek ini mungkin:

Story Protocol: Menyediakan infrastruktur inti. Kami melacak IPAssetRegistry, RoyaltyModule (untuk RoyaltyPaid), dan IPRoyaltyVault (untuk Claimed), serta menggunakan $WIP sebagai aset dasar kami.

Dynamic.xyz: Menangani seluruh alur kerja wallet onboarding. Kami menggunakan DynamicContextProvider untuk setup Aeneid, DynamicWidget untuk UI login, dan useWriteContract (dari hook Wagmi yang diekspor) untuk semua interaksi kontrak (Swap, Add/Remove Liquidity, Claim).

Goldsky: Menjadi tulang punggung data kami. Kami mengindeks semua event kontrak kami (PoolCreated, Swap, Mint, Burn) serta event Story Protocol (RoyaltyPaid). API GraphQL mereka yang cepat memberdayakan seluruh backend kami.

Tenderly: Penjaga keamanan dan keandalan kami. Kami menggunakan Tenderly Forks di hardhat.config.ts untuk menjalankan pengujian integrasi yang realistis. Di produksi, kami menggunakan Tenderly Alerts untuk memonitor kegagalan swap (Alert 2), aktivitas admin (Alert 1), dan penarikan likuiditas besar (Alert 3).

📄 Lisensi
Proyek ini dilisensikan di bawah MIT License.
>>>>>>> f5a802d (first)
