# Sovry Launchpad – IP-Backed Token Engine

Sovry Launchpad is a **Pump.fun–style bonding-curve launchpad** for Story Protocol IP assets.

Creators lock a portion of their **Story Protocol Royalty Tokens (RT)** into the Launchpad, which deploys a branded ERC‑20 **wrapper token** and sells it on a bonding curve. When the raise target is hit, the wrapper graduates to a **PiperX V2** pool. Royalties earned by the underlying IP can be **harvested** and injected back into the curve to **boost price**.

---

## 🏗 Architecture

- **Blockchain**: Story Protocol – Aeneid Testnet (chainId 1315)
- **Core Contracts** (Aeneid):
  - `SovryLaunchpad.sol` – bonding curve engine + graduation to PiperX
  - `SovryToken.sol` – simple ERC‑20 wrapper token (one per IP launch)
- **Frontend**: Next.js + TypeScript (in `frontend/`)
  - `/` – Launch grid (from subgraph)
  - `/create` – Launch flow (Register IP → Get RT → Launch)
  - `/pool/[address]` – Trading terminal (chart + trade + comments + harvest)
- **Wallet**: Dynamic.xyz (primary wallet context + viem integration)
- **Indexing**: The Graph / Goldsky subgraph tracking **Launchpad events only**

---

## ⚙️ Smart Contracts (Aeneid)

> Always check deployed addresses in env / deployment logs; values below are examples.

- **Launchpad** – `SovryLaunchpad`
  - Holds locked RT inventory
  - Mints wrapper tokens
  - Runs bonding curve for buys/sells
  - Calls PiperX V2 router `addLiquidityETH` on graduation
  - Implements Harvest & Pump
- **Wrapper Token** – `SovryToken`
  - `constructor(string name, string symbol, uint256 supply, address owner)`
  - Mints total `supply` to `owner` (Launchpad)
  - `onlyOwner` `mint` and `burnFrom` hooks for Launchpad control

Key on-chain behaviours:

- **Wrapper Pattern**
  - `launchToken(royaltyToken, amount, name, symbol)`
  - Launchpad locks `amount` of RT from creator
  - Deploys a `SovryToken` wrapper and mints `amount` units to itself
  - Emits `WrapperDeployed(royaltyToken, wrapper, name, symbol)` and `Launched(wrapper, creator)`

- **Fractional Listing**
  - `amount` parameter lets creators choose **what % of their RTs** to tokenize
  - Frontend passes `amountToLock = balance * percentage / 100`

- **Bonding Curve**
  - `buy(token)` – pays native IP, takes 1% fee to `feeTo`, rest into curve
  - `sell(token, tokenAmount)` – returns IP minus 1% fee
  - Curve math uses constant product formula with a **virtual IP reserve**

- **Harvest & Pump**
  - `harvestAndPump(wrapperToken)` – Launchpad (as RT holder) calls Story’s **royalty vault**
    - Checks WIP balance before/after
    - Treats claimed WIP as **free reserve** and adds to `totalRaised`
    - Emits `RevenueInjected(wrapperToken, amount)`

- **Graduation to PiperX**
  - When `totalRaised` ≥ `TARGET_RAISE` (e.g. `100 ether` of IP):
    - `_graduate(token)` calls PiperX router `addLiquidityETH`
    - Supplies all accumulated IP and remaining wrappers
    - Sends LP tokens to `0x...dEaD` (burn) to lock liquidity
    - Emits `Graduated(token, pool, totalLiquidity)`

- **Redemption**
  - `redeem(wrapperToken, amount)` burns wrapper tokens held by user and returns underlying RT 1:1
  - Emits `Redeemed(wrapper, user, amount)`

---

## 🌐 Frontend Apps

### `frontend/` – Next.js App Router

- **Navigation**
  - `Home` – `/`
  - `Create` – `/create`
  - `Profile` – `/profile`

- **Home (`/`) – Launch Grid**
  - Fetches `Launch` entities from the subgraph
  - Shows wrapper token address, creator, and launch date
  - Clicking a card routes to `/pool/[address]` for trading

- **Create (`/create`) – Launch Your IP**
  - Register IP on Story Protocol:
    - Title, Description, Image / Media URL, optional symbol
  - Get Royalty Tokens:
    - Mint license, deploy Story Royalty Vault, transfer RTs to user
  - Configure Launch:
    - Wrapper **name & symbol** (e.g. `Chill Guy`, `CHILL`)
    - **Percentage to Launch** slider (1–100%)
  - Launch on Bonding Curve:
    - Calls `launchOnBondingCurveDynamic(royaltyToken, name, symbol, percentage)`
    - Under the hood: approves Launchpad for `amountToLock` and calls `launchToken`

- **Pool Detail (`/pool/[address]`) – Trading Terminal**
  - Left: Bonding curve chart + IP metadata + license terms + comments
  - Right:
    - Bonding curve progress vs target raise
    - Trade widget (bonding-curve buy/sell)
    - **Harvest Royalties** button:
      - Calls `harvestAndPump(wrapperToken)` via `launchpadService`
      - Tooltip: "Claim pending royalties from Story Protocol to this pool's Launchpad vault and inject them into the bonding curve reserve. This can instantly boost the token price for all holders."

---

## 📊 Subgraph (Launchpad-Only)

Directory: `subgraph/`

- **Data Source**: `SovryLaunchpad` only (no legacy factory/pool indexing)
- **Tracked Events**:
  - `Launched(token, creator)`
  - `WrapperDeployed(royaltyToken, wrapper, name, symbol)`
  - `Bought(token, buyer, amountIP, amountTokens)`
  - `Sold(token, seller, amountTokens, amountIP)`
  - `RevenueInjected(token, amount)`
  - `Graduated(token, pool, totalLiquidity)`
  - `Redeemed(wrapper, user, amount)`

Core entities in `schema.graphql`:

- `Launch` – one per wrapper token
- `Trade` – all buys/sells on the curve
- `RevenueInjection` – Harvest & Pump events
- `Graduation` – final state when a launch moves to PiperX

Use this subgraph to power the **Home grid**, analytics charts, and profile views.

---

## 🔐 Environment Variables

Root / frontend `.env` examples:

```bash
# Story Protocol
NEXT_PUBLIC_STORY_API_KEY=your_api_key_here
NEXT_PUBLIC_STORY_RPC_URL=https://aeneid.storyrpc.io

# Dynamic.xyz
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=your_dynamic_environment_id

# Launchpad
NEXT_PUBLIC_LAUNCHPAD_ADDRESS=0x...   # SovryLaunchpad on Aeneid

# Subgraph
NEXT_PUBLIC_SUBGRAPH_URL=https://api.goldsky.com/api/public/.../subgraphs/sovry-launchpad/latest

# Optional backend (if you run one)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

If you also deploy contracts from scripts, you may keep `SOVRY_LAUNCHPAD_ADDRESS` at the root for tooling.

---

## 🚀 Development

From project root:

```bash
cd frontend
npm install
npm run dev

# Frontend: http://localhost:3000
```

Subgraph (optional, if you’re iterating on mappings/schema):

```bash
cd subgraph
yarn install
yarn codegen
yarn build
# yarn deploy ... (to your Graph / Goldsky endpoint)
```

---

## 📚 References

- [Story Protocol Docs](https://docs.story.foundation)
- [Dynamic.xyz Docs](https://www.dynamic.xyz/docs)
- [Goldsky / The Graph Docs](https://docs.goldsky.com)