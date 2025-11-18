`Prompt 1.1: Pengaturan Proyek Hardhat`

Initialize a new Hardhat project. Configure the 'hardhat.config.ts' file to connect to the Story Aeneid Testnet.
- network name: 'aeneid'
- chainId: 1315
- rpc url: 'https://aeneid.storyrpc.io'

Install dependencies:
- `@openzeppelin/contracts` (Latest version) for AccessControl, TimelockController, Pausable.
- `@uniswap/v2-core & @uniswap/v2-periphery` (Reference logic only).
- `solidity-coverage & hardhat-gas-reporter` (Dev tools).

Config:

Enable optimizer (runs: 200).

Set solidity version to 0.8.20+.

`Prompt 1.2 Skema Kontrak SovryFactory (Dengan Protocol Fee)`

Create 'contracts/SovryFactory.sol'.
This contract must implement `IUniswapV2Factory` and inherit `Ownable` (from OpenZeppelin).

Key Logic:
1.  State Variables: `address public feeTo`, `address public feeToSetter` (use `owner()` from Ownable logic usually, or keep separate if you want distinct roles).
2.  Constructor: Set `feeToSetter` to `msg.sender`.
3.  Function `createPool(address tokenA, address tokenB)`:
    -   Deploys `SovryPool` using `create2` (deterministic address).
    -   Sorts tokens.
    -   Emits `PoolCreated`.
4.  Function `setFeeTo(address)`: Owner only.
5. Inherit from TimelockController (OpenZeppelin).

Constructor:

minDelay: Set initial delay to 1 day (86400 seconds) -> Allows users to exit if malicious changes are queued.

proposers: Array of addresses (e.g., a Multi-Sig wallet address).

executors: Array of addresses (can be address(0) for anyone to execute after delay).

Role: This contract will hold the DEFAULT_ADMIN_ROLE in the Factory and Router.

`Prompt 1.3 Skema Kontrak SovryPool (Dengan Logic Fee-Splitting)`

Create 'contracts/SovryPool.sol'.
This is the core engine. Reference `UniswapV2Pair.sol` but replaces Ownable with AccessControl.

Key Logic:

Roles:

bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE"); (For emergency stop).

bytes32 public constant FEE_SETTER_ROLE = keccak256("FEE_SETTER_ROLE");

State: address public feeTo, address public feeToSetter.

Constructor: Setup DEFAULT_ADMIN_ROLE (initially deployer, then transferred to Timelock). Grant PAUSER_ROLE to a separate "Guardian" wallet.

Function createPool:

Deploys SovryPool.

CRITICAL: Pass the pauser address to the Pool's constructor so the pool knows who can pause it.

Function setFeeTo: Restricted to FEE_SETTER_ROLE.

Requirements:
1.  Inherit `ERC20`, `ReentrancyGuard` (OpenZeppelin).
2.  Implement `IUniswapV2Pair`.
3.  **Fee Logic (0.3% Total):**
    -   If `factory.feeTo()` is set: 1/6th of the 0.3% fee goes to `feeTo` (Protocol), 5/6th goes to LPs.
    -   Implement `_mintFee` logic exactly like Uniswap V2 (using `kLast`).
4.  **Functions:** `mint`, `burn`, `swap`, `skim`, `sync`.
5.  **Security:** Apply `nonReentrant` modifier to `mint`, `burn`, and `swap`.

`Prompt 1.4: Skema Kontrak SovryRouter`

Create 'contracts/SovryRouter.sol'. Inherits ERC20, ReentrancyGuard, and Pausable.
This is the user entry point. It MUST handle "Fee-on-Transfer" tokens (tokens that tax transfers) to prevent liquidity drains.

Key Requirements:

Emergency Stop (Circuit Breaker):

Add role management (or store a factory address and call back to check roles). Simpler: Store a pauser address immutable in constructor.

Apply whenNotPaused modifier to: mint, swap, skim, sync.

DO NOT apply whenNotPaused to burn. User funds must never be held hostage. Even in a hack, users should be able to withdraw liquidity.

TWAP Oracle Data (Flash Loan Protection):

Strictly implement price0CumulativeLast and price1CumulativeLast updates in the _update function exactly like Uniswap V2.

This enables external Oracle contracts to calculate Time-Weighted Average Price (TWAP), making flash loan price manipulation economically unfeasible.

Fee Logic: Keep the 0.3% fee splitting (Protocol/LP) as defined previously.

Requirements:
1.  **Deadline Check:** All functions must accept a `deadline` param and `require(block.timestamp <= deadline, "EXPIRED")`.
2.  **Standard Functions:** `addLiquidity`, `removeLiquidity`, `swapExactTokensForTokens`.
3.  **Fee-on-Transfer Support (CRITICAL):**
    -   Implement `swapExactTokensForTokensSupportingFeeOnTransferTokens`.
    -   Logic: Instead of assuming amounts, verify the *actual* balance increase in the pair contract after the transfer.
    -   `uint balanceBefore = IERC20(token).balanceOf(address(pair));`
    -   `transferFrom(...)`
    -   `uint balanceAfter = IERC20(token).balanceOf(address(pair));`
    -   `uint amountReceived = balanceAfter - balanceBefore;`

```Prompt 1.5 Pengujian Kontrak (Integrasi Tenderly & Kasus Uji Profesional)```

Create a new test file 'test/SovryDEX.test.ts' using Hardhat and Ethers.js.

I need a test suite that simulates our entire use case on a Tenderly fork of Aeneid.
1.  **Setup:** (Sama seperti sebelumnya).
2.  **Deploy:** (Sama seperti sebelumnya).
3.  **Mocking:** (Sama seperti sebelumnya).
4.  **Test Flow (Happy Path):** (Sama seperti sebelumnya - addLiquidity, swap, verify balances).
5.  **Test Flow (Keamanan & Kegagalan - BARU):**
    -   `it('should fail swap if deadline expires')`: Lakukan swap tetapi *setelah* memanipulasi waktu blok (`evm_increaseTime`) agar melewati `deadline`. Harapkan transaksi `revert` dengan pesan 'SovryRouter: EXPIRED'.
    -   `it('should fail to set feeTo if called by non-owner')`: Coba panggil `factory.connect(nonOwnerSigner).setFeeTo(..)` dan harapkan `revert` dengan pesan `Ownable: caller is not the owner`.
    -   `it('should correctly route protocol fees when feeTo is set')`:
        -   Ambil saldo LP `feeTo` (awal = 0).
        -   Panggil `factory.connect(owner).setFeeTo(feeToAddress)`.
        -   Lakukan beberapa kali `swap`.
        -   Panggil `pool.mint(someAddress)` (atau `swap`/`burn` lagi) untuk memicu `_mintFee`.
        -   **Verifikasi (Assert):** Pastikan `feeToAddress` sekarang memiliki saldo LP token `> 0`.

`Prompt 1.6: Pengujian Keamanan & Governance (Test Suite Update)`
Tujuan: Memverifikasi bahwa lapisan keamanan baru berfungsi.

Create 'test/SovrySecurity.test.ts'.

Test Cases:

Timelock Integration:

Deploy Timelock, Factory, Pool. Transfer Factory Admin to Timelock.

Attempt to change feeTo directly from deployer -> Expect Revert (Access Denied).

Schedule a setFeeTo operation via Timelock.

Execute before minDelay -> Expect Revert.

Execute after minDelay -> Expect Success.

Emergency Pause:

Guardian calls pause() on a Pool.

User attempts swap -> Expect Revert ("Pausable: paused").

User attempts burn (Remove Liquidity) -> Expect Success (Escape hatch works).

Flash Loan Resilience (Oracle Check):

Perform a swap.

Verify price0CumulativeLast increases by the correct time-weighted amount.

`Prompt 2.1: Pengaturan Proyek Backend (Node.js)`

Initialize a new Node.js/Express/TypeScript project.

Install Dependencies (Core):

express, typescript, ts-node, @types/node

dotenv, cors, helmet (Security best practice)

express-async-handler (Error handling)

Install Dependencies (Solusi Anda):

Caching (Redis): ioredis (Klien Redis performa tinggi untuk terhubung ke Upstash).

Rate Limiting: express-rate-limit (Melindungi dari spam bot).

Resilience: opossum (Implementasi Circuit Breaker yang solid untuk Node.js).

Data: graphql-request, graphql (Klien Goldsky kita).

Struktur File (Diperbarui):

src/index.ts (Server)

src/api/routes.ts (Router)

src/config/redis.ts (Setup klien Redis)

src/config/goldsky.ts (Setup klien Goldsky)

src/middleware/cache.ts (Middleware Redis Caching)

src/middleware/auth.ts (Middleware API Key)

src/middleware/rateLimit.ts (Middleware Rate Limiter)

src/services/goldskyClient.ts (Klien dengan Circuit Breaker)

`Prompt 2.2: Skema Goldsky (Definisi Data)`

Ini adalah skema GraphQL (SDL) yang akan kita gunakan untuk Goldsky. Buatkan saya file 'goldsky.schema.graphql' dengan definisi ini:

Kita perlu mengindeks event-event berikut dari Aeneid Testnet:
1.  **Story Protocol Events:**
    -   `IPRegistered(address ipId, ...)` dari `IPAssetRegistry`.
    -   `RoyaltyPaid(address receiverIpId, address token, uint256 amount, ...)` dari `RoyaltyModule`. **(Ini yang paling penting).**
    -   `Claimed(...)` dari `IPRoyaltyVault`.
2.  **Kontrak `sovry` kita:**
    -   `PoolCreated(address tokenA, address tokenB, address poolAddress)` dari `SovryFactory`.
    -   `Swap(address sender, uint amount0In, uint amount1In, ...)` dari `SovryPool`.
    -   `Mint(...)` dan `Burn(...)` dari `SovryPool` (untuk TVL).

Buatkan saya skema entitas (entity schema) berdasarkan event-event ini.

Buatkan saya file 'goldsky.schema.graphql' dengan definisi ini:

... (Semua event Story Protocol kamu tetap sama) ...

type Pool @entity {
  id: ID! # Alamat pool
  token0: Token!
  token1: Token!
  reserve0: BigDecimal!
  reserve1: BigDecimal!
  totalLiquidity: BigDecimal! # Total LP token supply
  tvlUSD: BigDecimal! # Dihitung (jika harga tersedia)
  dailyVolumeUSD: BigDecimal!
  dailyTxns: BigInt!
  swaps: [Swap!] @derivedFrom(field: "pool")
}

type Token @entity {
  id: ID! # Alamat token
  symbol: String!
  name: String!
  # ... data token lainnya
}

# Entitas yang melacak IP sebagai Token
type Token @entity {
  id: ID! # Alamat token (ipId)
  symbol: String!
  name: String!
  metadataURI: String # SANGAT PENTING
  ipAsset: IPAsset @derivedFrom(field: "token")
}

# Entitas yang melacak detail IP itu sendiri
type IPAsset @entity {
  id: ID! # Alamat IP (ipId)
  token: Token!
  name: String
  description: String
  imageURL: String # Akan diisi oleh backend
  licenseTerms: String # Akan diisi oleh backend
  # ... data lain yang diindeks dari event RoyaltyPaid ...
}

# Event dari Story Protocol
type IPRegistered @entity {
  id: ID! # tx hash
  ipId: Bytes! # Alamat IP (ini adalah ID untuk entitas Token/IPAsset kita)
  tokenURI: String! # Ini yang kita butuhkan!
  # ... field lain dari event
}

# Event-event kita sekarang MEMPERBARUI entitas 'Pool'
type PoolCreated @entity { ... }
type Mint @entity { ... }
type Burn @entity { ... }

type Swap @entity {
  id: ID!
  timestamp: BigInt!
  pool: Pool!
  sender: Bytes!
  amount0In: BigDecimal!
  amount1In: BigDecimal!
  amount0Out: BigDecimal!
  amount1Out: BigDecimal!
  to: Bytes!
}

buatkan juga logic untuk data mentah yang diperlukan untuk verifikasi dan skoring.

`Prompt 2.2: API Setup dengan Caching (Node.js)`
Setup a Node.js/Express server.
buat src/config/redis.ts untuk menginisialisasi koneksi Upstash, Buat src/middleware/cache.ts untuk menggantikan apicache

Create `src/services/goldsky.ts`: Client for GraphQL queries.
Create `src/services/ipfs.ts`: Client to fetch metadata from IPFS gateways with a timeout.

Prompt 2.3 : Implementasi API Endpoints
Di file 'src/api/routes.ts', buatkan saya endpoint API Express.

1.  `GET /api/pools`: (Sama seperti sebelumnya) Mengembalikan daftar pool.
2.  `GET /api/pools/:address/chart`: (Sama seperti sebelumnya) Mengembalikan data chart harga.
3.  `GET /api/assets/:ipId/revenue`: (Sama seperti sebelumnya) Mengembalikan data pendapatan royalti.
4.  **`GET /api/assets/:ipId/metadata` (ENDPOINT BARU):**
    -   Buat src/middleware/auth.ts dan src/middleware/rateLimit.ts lalu Perbarui src/api/routes.ts untuk menggunakan semua middleware:
    -   **Logika:**
        Check Cache. If hit, return.
        1.  Ia harus mengambil `ipId` (yang merupakan alamat token $rIP) dari parameter URL.
        2.  Menggunakan `goldskyClient` untuk mengirim kueri GraphQL: `query { token(id: "ipId") { metadataURI } }`.
        3.  Mengambil `metadataURI` yang dikembalikan (misal: `ipfs://bafy...` or `https://...`).
        4.  **Menyelesaikan URI:** Jika URI tersebut IPFS, gunakan gateway (misal: `https://ipfs.io/ipfs/`).
        5.  **Mengambil Metadata:** Menggunakan `axios` untuk mengambil data dari *JSON metadata* di URI tersebut.
        6.  **Mengembalikan JSON Kaya:** Mengembalikan JSON yang telah di-parsing ke frontend, yang berisi: `{ name, description, image, attributes: [{...}] }`.
        7. API Endpoint (Dengan Relevance Score)

Prompt 2.4: Logika Klien Goldsky dengan Circuit Breaker Opossum

Buat file 'src/services/goldskyClient.ts'.
Implementasikan fungsi `queryGoldsky(query: string, variables: object)` yang menggunakan 'graphql-request' untuk mengirim kueri GraphQL ke endpoint Goldsky kita (yang disimpan di 'GOLDSKY_API_KEY').

`Prompt 2.5 (BARU): Curation Service (Backend Node.js)`
Ini adalah layanan terpisah (atau cron job) di backend kita yang berjalan setiap 10 menit. Ini tidak melayani permintaan pengguna secara langsung, tetapi memperkaya data kita.

Tujuan: Memverifikasi metadata dan mengumpulkan sinyal sosial.

Database: Kita akan menggunakan Upstash Redis atau Vercel Postgres sebagai "Curation DB" untuk menyimpan data yang tidak ada di on-chain (seperti followerCount dan status isVerified).

Logika:

fetch UnverifiedIPs from Goldsky (where onChainMetadataHash != null)

Untuk setiap IP:

Panggil goldskyClient.query({ ipAsset(id: "...") { tokenURI, onChainMetadataHash } }).

Panggil ipfsClient.fetch(tokenURI).

Verifikasi (Solusi 2):

Hitung hash(metadataJSON).

const isValid = hash(metadataJSON) === onChainMetadataHash;

Enrich (Solusi 1):

Jika isValid, parse metadataJSON untuk socials.twitter.

Panggil Twitter API untuk mendapatkan followerCount.

Simpan ke Curation DB:

db.set(ipId, { isVerified: isValid, twitterFollowers: followerCount })

Sekarang, kembali ke 'src/api/routes.ts' dan ganti data mock dengan panggilan nyata ke `queryGoldsky`. Buatkan saya kueri GraphQL yang sesuai untuk ketiga endpoint tersebut berdasarkan 'goldsky.schema.graphql' kita.
Fase 3: Frontend (UI & Integrasi Mitra)
Tujuan: Membangun antarmuka Next.js yang terhubung ke dompet pengguna (via Dynamic.xyz) dan menampilkan data (dari API Backend) untuk memungkinkan perdagangan.

Prompt 3.1: Pengaturan Proyek Frontend (Next.js)

Setup Next.js 14 (App Router).
Install `wagmi`, `viem`, `@tanstack/react-query`, `swr`.
Configure `DynamicContextProvider` (Dynamic.xyz) wrapping `WagmiProvider` and `QueryClientProvider`.

Initialize a new Next.js 14 (App Router) project with TypeScript and Tailwind CSS.
Buat struktur file dasar:
- 'src/app/layout.tsx'
- 'src/app/page.tsx' (Ini akan menjadi halaman DEX utama kita)
- 'src/app/pool/[address]/page.tsx' (Ini untuk halaman detail pool)
- 'src/components/'
- 'src/lib/'

Prompt 3.2: Integrasi Dynamic.xyz (Wallet Onboarding)

Integrate Dynamic.xyz into the project.
1.  Create a file 'src/app/providers.tsx'.
2.  Dalam file ini, setup `DynamicContextProvider`. Konfigurasikan untuk Story Aeneid Testnet:
    -   `chainId: 1315`
    -   `rpcUrl: 'https://aeneid.storyrpc.io'`
3.  Pastikan juga menyertakan Wagmi/Viem.
4.  Bungkus 'src/app/layout.tsx' dengan provider ini.
5.  Tambahkan komponen `DynamicWidget` (tombol connect wallet) ke header di 'layout.tsx'.

Prompt 3.3: Komponen Halaman Utama (Daftar Pool)

Di 'src/app/page.tsx', lakukan hal berikut:
1.  Buat fungsi `fetchPools` yang memanggil API backend kita di `GET /api/pools`.
2.  Tampilkan data pool dalam sebuah tabel (menggunakan Tailwind CSS).
3.  Kolom tabel harus: 'Nama Pool' (misal, $rIP-ABC / $WIP), 'TVL', 'Volume 24 Jam'.
4.  Setiap baris harus berupa `<Link>` yang mengarah ke halaman detail pool: `/pool/[poolAddress]`.

Prompt 3.4 Komponen Halaman Detail Pool

Halaman ini di 'src/app/pool/[address]/page.tsx' adalah halaman utama kita.
Ia perlu mengambil `ipId` (dari token $rIP) dan `address` (pool) dari URL/data.

**Struktur Halaman (Layout):**
Halaman harus dibagi menjadi dua kolom utama (desktop) atau tab (mobile).

**Komponen: Analisis & Detail Aset (ini adalah halaman utama)**
Ini adalah "Kartu Aset IP" kita. Sebelum chart, di bagian paling atas:
1.  **Panggil API:** Lakukan `fetch` ke `GET /api/assets/:ipId/metadata`.
2.  **Tampilkan Gambar:** Tampilkan `metadata.image` dalam komponen `<Image>` Next.js yang besar dan berkualitas tinggi.
3.  **Tampilkan Judul:** Tampilkan `metadata.name` sebagai `<h1>`.
4.  **Tampilkan Deskripsi:** Tampilkan `metadata.description` dalam paragraf.
5.  **Tampilkan Detail Lisensi:**
    -   Loop melalui `metadata.attributes`.
    -   Cari *trait* seperti "License Type" atau "Commercial Use" dan tampilkan dengan jelas. (Misal: Ikon untuk "Non-Commercial").
6.  **Grafik Pendapatan (Sangat Penting):**
    -   Panggil API backend kita `GET /api/assets/:ipId/revenue`.
    -   Tampilkan **grafik batang** pendapatan `RoyaltyPaid` harian di bawah deskripsi IP.
7. **Detail Harga**
    -   Tampilkan **Harga dari misalnya rIP/WIP**

    State (Diperluas):
8. Logika Peringatan Keamanan:

if (!metadata.isVerified):

Tampilkan BANNER PERINGATAN MERAH di atas halaman.

Teks: "Aset Tidak Terverifikasi. Metadata untuk IP ini tidak dapat diverifikasi secara on-chain. Ini mungkin spam atau aset berisiko tinggi. Berinteraksilah dengan risiko Anda sendiri."

Nonaktifkan tombol "Swap" secara default sampai pengguna mengklik kotak centang "Saya memahami risikonya, Tampilkan Sinyal Sosial: Di samping deskripsi aset, tampilkan jumlah pengikut Twitter (metadata.twitterFollowers) untuk memberikan konteks sosial tambahan.

slippage (default 0.5%, dari SwapSettings).

deadline (default 20m, dari SwapSettings).

amountIn, amountOut.

priceImpact (dihitung, default 0).

simulationState: ('idle', 'simulating', 'success', 'error').

simulationError: (Pesan string jika revert).

Reaktivitas & Perhitungan Real-time (Wagmi + Tenderly):

Saat pengguna mengetik amountIn, gunakan useReadContract (Wagmi) untuk memanggil getAmountsOut secara real-time.

Perhitungan Price Impact:

Hitung marketPrice (misalnya, dari reserve0 / reserve1).

Hitung executionPrice (amountIn / amountOut).

Hitung priceImpact = ((marketPrice - executionPrice) / marketPrice) * 100.

Peringatan Price Impact (Solusi Anda):

Jika priceImpact > 2.0%: Tampilkan RED BANNER di bawah input.

Teks Peringatan: "Peringatan: Dampak Harga Tinggi (>2%). Transaksi Anda akan menggerakkan harga secara signifikan karena likuiditas rendah."

Jika priceImpact > 5.0%: Nonaktifkan tombol "Swap" kecuali pengguna secara manual mengklik kotak centang "Saya menerima dampak harga tinggi".

Logika Tombol "Swap" (Dengan Simulasi):

Tombol harus dinamis: "Swap", "Simulating...", "Confirm Swap", "Error: Check Slippage".

Langkah 1 (Simulasi): Sebelum mengaktifkan useWriteContract, panggil useSimulateContract (dari Wagmi) atau secara manual mem-ping Tenderly Simulation API.

useSimulateContract akan melakukan eth_call dan mengembalikan request yang sudah disiapkan jika simulasi berhasil.

Jika simulasi gagal (revert), hook akan mengembalikan error.

Langkah 2 (Menampilkan Hasil Simulasi):

Sukses: Tombol "Swap" menjadi "Confirm Swap". Gas fee yang akurat ditampilkan.

Gagal: Tombol "Swap" tetap nonaktif. simulationError ditampilkan (misalnya, "Error: Slippage too high" atau "Insufficient liquidity").

Langkah 3 (Eksekusi):

Hanya jika simulasi berhasil, panggil writeContract(request) (dari useSimulateContract) untuk menyiarkan transaksi yang sudah pasti tidak akan revert (kecuali kondisi chain berubah drastis).

**Komponen: Detail Pool**
1.  **Pool List:** Fetch `/api/pools` using `useSWR` (for auto-refresh).
2.  **"Create Pool" Section (New Adoption Feature):**
    -   A form to input: "Token A (WIP)" and "Token B Address ($rIP Address)".
    -   Button: "Create Liquidity Pool".
    -   Action: Call `SovryRouter.addLiquidity` (providing initial liquidity is safer than just createPair).
    -   UX: Show loading state, then redirect to the new pool page upon success.

**Komponen: Aksi Perdagangan**
1.  **Komponen Swap:**
    -   **State:** `slippage` (default 0.5%), `deadline` (default 20m).
    -   **Reactivity:** Use `useReadContract` (Wagmi) to fetch `getAmountsOut` in real-time as user types.
    -   **Balance:** Use `useBalance` (Wagmi) to show user's WIP/$rIP balance. Updates automatically after swap.
    -   **Buttons:** Logic flow: `Approve` -> `Swap`.
    -   **Fee-on-Transfer:** Call `swapExactTokensForTokensSupportingFeeOnTransferTokens` on the router to be safe.
2.  **Grafik Harga:**
    -   Panggil API backend kita `GET /api/pools/:address/chart`.
    -   Tampilkan grafik harga *di bawah* widget swap.

**Mengapa Tata Letak Ini Penting:** Pengguna pertama-tama **menganalisis aset** (gambar, deskripsi, pendapatan) di sebelah kiri, kemudian **mengambil tindakan** (swap, cek harga) di sebelah kanan. Ini adalah alur UX yang profesional.

Prompt 3.5: Komponen Klaim Pendapatan

Di halaman detail pool ('src/app/pool/[address]/page.tsx'), tambahkan bagian "My Revenue".
1.  Bagian ini harus memeriksa saldo $rIP pengguna untuk pool ini.
2.  Tambahkan tombol "Claim My Revenue".
3.  Tombol ini harus memanggil fungsi `claim()` atau `claimAllRevenue()` langsung pada kontrak `IPRoyaltyVault` (yang alamatnya adalah alamat token $rIP).
4.  Gunakan `useWriteContract` dari Dynamic/Wagmi untuk mengeksekusi klaim ini. Ini menyelesaikan siklus bagi pengguna: Beli $rIP, dapatkan pendapatan, klaim pendapatan.

Prompt 3.6: Fitur Keamanan Transaksi (Frontend)
Tujuan: Melindungi user dari Sandwich Attacks di sisi UI.

Update src/components/Swap/SwapSettings.tsx.

Auto-Slippage: Implement "Auto" slippage based on volatility, but allow "Custom" setting. Warning if slippage > 2% (Front-running risk).

Deadline Settings: Default to 20 mins, allow user reduction to 5 mins to reduce exposure time in mempool.

MEV/RPC Note: Since Story is new, standard MEV-blockers might not exist yet. Add a UI tip: "Tip: Use high slippage tolerance only when necessary to avoid sandwich attacks."

`Prompt 3.6 (Revisi): Fitur Keamanan Transaksi (MEV & Slippage Settings)`
Buat komponen src/components/Swap/SwapSettings.tsx (biasanya dalam modal/popover).

Slippage Tolerance (UI):

Tombol cepat: 0.1%, 0.5%, 1.0%.

Input kustom (misal, __.__ %).

Peringatan: Jika pengguna mengatur slippage kustom > 2.0%, tampilkan peringatan kuning: "Slippage tinggi meningkatkan risiko front-running (MEV)."

Deadline Settings (UI):

Input: __ menit (default 20).

Tampilkan peringatan jika diatur terlalu tinggi (> 60m).

MEV/RPC Note (UI):

Tambahkan tombol toggle (default nonaktif) berlabel "Gunakan RPC Privat (Anti-MEV)".

Catatan: Ini mungkin belum berfungsi di Aeneid, tetapi ini menunjukkan kepada pengguna bahwa Anda memikirkan MEV. Untuk saat ini, bisa jadi placeholder.

`Prompt 3.7 (BARU): Komponen Manajemen Transaksi (Pending/Stuck Tx)`
Ini adalah komponen UI global, kemungkinan di-render di layout.tsx atau di dalam DynamicWidget.

Tujuan: Memberi pengguna kendali atas transaksi yang "macet" (stuck) di mempool.

State Management (Global):

Gunakan global state (Zustand atau React Context) untuk menyimpan daftar pendingTransactions: { hash, nonce, timestamp, status }.

Saat useWriteContract mengembalikan hash, tambahkan ke state ini.

UI Indicator:

Di header/navbar, tampilkan indikator "Pending (1)" jika ada transaksi di state.

Klik indikator ini akan membuka modal "Transaction Manager".

Modal Transaction Manager:

Daftar semua transaksi yang pending.

Gunakan useWaitForTransactionReceipt (Wagmi) dengan timeout untuk memantau statusnya.

Jika transaksi masih pending setelah (misalnya) 1 menit, tampilkan dua tombol di sebelahnya:

"Speed Up" (Percepat):

Logika: Panggil useSendTransaction (Wagmi) lagi.

Gunakan nonce yang sama dengan transaksi yang macet.

Gunakan to, data, dan value yang sama.

Kunci: Atur maxFeePerGas dan maxPriorityFeePerGas 10-20% lebih tinggi dari gas transaksi asli.

"Cancel" (Batalkan):

Logika: Panggil useSendTransaction (Wagmi) lagi.

Gunakan nonce yang sama dengan transaksi yang macet.

Kunci: Atur to: userAddress (kirim ke diri sendiri), value: 0, data: '0x'.

Atur maxFeePerGas dan maxPriorityFeePerGas 10-20% lebih tinggi.

Auto-Clear: Saat useWaitForTransactionReceipt mengembalikan status: 'success', tampilkan notifikasi (toast) dan hapus transaksi dari state pending.

`Prompt 4.1 (Revisi): Deployment Smart Contract (Hardhat & Verifikasi Otomatis)`

Kita perlu mendeploy DAN memverifikasi kontrak `SovryFactory` dan `SovryRouter` ke Aeneid Testnet.

**Setup Tambahan:**
1.  Install `@nomicfoundation/hardhat-verify`: `npm install --save-dev @nomicfoundation/hardhat-verify`
2.  Tambahkan konfigurasi verifikasi ke `hardhat.config.ts`. (Tenderly mungkin memerlukan setup khusus untuk verifikasi, atau gunakan Etherscan jika Aeneid didukung).

**Buatkan saya skrip deployment Hardhat di 'scripts/deploy.ts'.**
Skrip ini harus:
1.  Menggunakan Ethers.js dan `hre` (Hardhat Runtime Environment).
2.  Mengambil 'PRIVATE_KEY' dari '.env'.
3.  Mengambil 'OWNER_ADDRESS' dari '.env' (untuk konstruktor `Ownable`).
4.  Deploy 'SovryFactory.sol' dengan `OWNER_ADDRESS` sebagai argumen konstruktor.
5.  Menunggu 5 konfirmasi blok (praktik baik untuk chain).
6.  Deploy 'SovryRouter.sol', menyuntikkan alamat `SovryFactory` yang baru di-deploy.
7.  Menunggu 5 konfirmasi blok.
8.  Mencetak (console.log) alamat `SovryFactory` dan `SovryRouter`.
9.  **Verifikasi (BARU):**
    -   Secara otomatis memanggil `hre.run("verify:verify", { address: factoryAddress, constructorArguments: [OWNER_ADDRESS] })`.
    -   Secara otomatis memanggil `hre.run("verify:verify", { address: routerAddress, constructorArguments: [factoryAddress] })`.

Juga, pastikan 'hardhat.config.ts' memiliki konfigurasi 'aeneid' yang menggunakan `PRIVATE_KEY` ini di array 'accounts'.

Prompt 4.2: Konfigurasi Goldsky (Production Indexing)

Sekarang kita memiliki alamat kontrak `SovryFactory` yang *live* di Aeneid. Kita perlu mengkonfigurasi Goldsky untuk mengindeksnya secara produksi.

Buatkan saya file konfigurasi 'goldsky.yaml'.
File ini harus mendefinisikan 'sources' (sumber data) kita untuk Aeneid (Chain ID 1315):
1.  **Sumber Statis:**
    -   `IPAssetRegistry` (Gunakan alamat resmi Story)
    -   `RoyaltyModule` (Gunakan alamat resmi Story)
    -   `SovryFactory` (Gunakan alamat yang kita dapatkan dari skrip deployment 4.1).
2.  **Sumber Dinamis (Penting):**
    -   Konfigurasikan 'factory' source yang memantau event `PoolCreated` di `SovryFactory`.
    -   Ketika event `PoolCreated` terdeteksi, Goldsky harus secara otomatis mulai mengindeks kontrak `SovryPool` baru di 'poolAddress' yang di-emit oleh event tersebut.
    -   Gunakan ABI dari 'SovryPool.sol' untuk sumber dinamis ini.

Buatkan saya juga perintah CLI `goldsky` untuk mendeploy konfigurasi ini dan skema GraphQL kita dari Fase 2.

Prompt 4.3: Deployment Frontend & Backend (Vercel)

Kita akan mendeploy Frontend (Next.js) dan Backend (Node.js/Express) kita ke Vercel.

1.  **Untuk Frontend (Next.js):** Vercel seharusnya mendeteksinya secara otomatis.
2.  **Untuk Backend (Node.js/Express):** Buatkan saya file 'vercel.json' di root proyek backend. File ini harus mengkonfigurasi 'rewrites' agar Vercel dapat menjalankan server Express kita sebagai *serverless function* tunggal.

Terakhir, buatkan saya daftar **Environment Variables** yang perlu saya atur di dasbor Vercel untuk KEDUA proyek:
-   `GOLDSKY_API_KEY`: (Untuk Backend, agar bisa query Goldsky).
-   `NEXT_PUBLIC_API_URL`: (Untuk Frontend, menunjuk ke URL produksi backend Vercel kita).
-   `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID`: (Untuk Frontend, ID proyek Dynamic.xyz).
-   `NEXT_PUBLIC_AENEID_RPC_URL`: (Untuk Frontend, 'https://aeneid.storyrpc.io').
-   `AENEID_DEPLOYER_PK`: (Untuk Backend, JIKA backend perlu melakukan transaksi *on-chain*. Jika tidak, abaikan).

Prompt 4.4: Pengaturan Monitoring & Alerting (Tenderly)

Kontrak kita sekarang *live* di Aeneid dan menangani aset nyata ($WIP, $rIP). Kita perlu memonitornya 24/7 menggunakan Tenderly.

Buatkan saya instruksi untuk mengatur Alert (Peringatan) di dasbor Tenderly:
Saya perlu memantau alamat `SovryFactory` dan `SovryRouter` saya.

1.  **Alert 1 (Keamanan Admin):**
    -   **Pemicu:** Ketika fungsi *apa pun* di `SovryFactory` dipanggil oleh alamat selain alamat 'owner' / 'deployer' saya.
    -   **Notifikasi:** Kirim email & pesan Slack.
2.  **Alert 2 (Kegagalan Swap Kritis):**
    -   **Pemicu:** Ketika *ada* transaksi yang memanggil fungsi `swap...` di `SovryRouter` mengalami **REVERT (GAGAL)**.
    -   **Alasan:** Ini membantu kita mendeteksi masalah likuiditas atau bug di AMM kita secara proaktif.
    -   **Notifikasi:** Kirim email & pesan Slack.
3.  **Alert 3 (Aktivitas Likuiditas Besar):**
    -   **Pemicu:** Ketika event `Burn` (penarikan likuiditas) terjadi di *pool manapun* (kita bisa memantaunya melalui `SovryFactory`) DAN nilai $WIP yang ditarik > 1000 (atau nilai ambang batas tinggi lainnya).
    -   **Alasan:** Mendeteksi penarikan likuiditas besar (rug pull) secara instan.
    -   **Notifikasi:** Pesan Slack.

Prompt 4.5: Verifikasi End-to-End (Final)

Ini adalah prompt verifikasi terakhir untuk saya jalankan di pikiran saya.

Buatkan saya daftar periksa (checklist) 'Go-Live' untuk memverifikasi bahwa *semua* mitra buildathon terintegrasi dan berfungsi:
1.  **[ ] Dynamic.xyz:** Saya bisa mengunjungi `sovry.fi` (URL Vercel), mengklik 'Connect Wallet', dan berhasil login di Aeneid.
2.  **[ ] Goldsky (Backend):** Saya mengunjungi halaman utama, dan daftar pool (dari `GET /api/pools`) berhasil dimuat. Ini membuktikan Backend Node.js bisa memanggil Goldsky.
3.  **[ ] Goldsky (Frontend):** Saya mengklik satu pool, dan 'Grafik Harga' (dari event `Swap`) serta 'Grafik Pendapatan' (dari event `RoyaltyPaid`) berhasil dimuat.
4.  **[ ] Story Protocol & Kontrak `sovry`:** Saya berhasil melakukan `swap` kecil (misal, 1 $WIP ke $rIP-Test). Transaksi berhasil di Aeneid.
5.  **[ ] Tenderly (Positif):** Saya memeriksa dasbor Tenderly dan melihat transaksi `swap` saya berhasil dan terindeks tanpa peringatan.
6.  **[ ] Tenderly (Negatif):** Saya mencoba melakukan `swap` yang mustahil (misal, `amountOutMin` terlalu tinggi) untuk sengaja membuatnya gagal. Saya memverifikasi bahwa saya menerima notifikasi Slack/email dari 'Alert 2'.

Jika semua 6 item ini dicentang, proyek kita berhasil diluncurkan dan terintegrasi