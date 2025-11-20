# Sovry DEX - IP Asset Trading Platform

Sovry is the first decentralized exchange (AMM) specifically designed for the Story Protocol ecosystem. It enables creators to bootstrap liquidity for their IP Assets instantly and allows investors to trade Royalty Tokens (RT).

## 🏗️ Architecture

- **Frontend**: Next.js 16 with TypeScript
- **Backend**: Express.js API server  

## 🔗 API Endpoints

### Story Protocol API
- **Staging**: `https://staging-api.storyprotocol.net/api/v4`
- **Documentation**: https://staging-api.storyprotocol.net/api/v4/openapi.json
- **Authentication**: API Key in `X-Api-Key` header

### Key Endpoints Used
- `POST /assets` - List IP assets with pagination
- `POST /search` - Vector search for IP assets
- `POST /licenses/tokens` - Get license tokens
- `POST /transactions` - List IP transactions

## 🚀 Development Setup

### Environment Variables
```bash
# --- Blockchain ---
PRIVATE_KEY=your_wallet_private_key
NEXT_PUBLIC_STORY_RPC_URL=[https://aeneid.storyrpc.io](https://aeneid.storyrpc.io)

# --- Story Protocol API ---
NEXT_PUBLIC_STORY_API_KEY=your_api_key_here

# --- Dynamic.xyz Wallet ---
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=your_environment_id

# --- Backend API ---
NEXT_PUBLIC_API_URL=http://localhost:3001

# --- Goldsky & Database ---
GOLDSKY_API_URL=[https://api.goldsky.com/](https://api.goldsky.com/)...
DATABASE_URL=postgres://user:pass@localhost:5432/sovry_db


2. Start Development

# Install dependencies
npm install

# Start both Frontend and Backend (concurrently)
npm run dev

# Access the apps:
# Frontend: http://localhost:3000
# Backend: http://localhost:3001

# Dynamic.xyz Wallet
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=your_environment_id

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Start Development
```bash
# Start both frontend and backend
npm run dev

# Frontend only: http://localhost:3000
# Backend only: http://localhost:3001
```

## 📱 Features

- **Home**: Trending IP assets with NFT-style display
- **Portfolio**: Track IP asset holdings and royalties
- **Pool Analysis**: Detailed IP asset metadata and license terms
- **Liquidty**: Unlock Royalty Token and Add liquidity to your IP assets
- **Trading**: Swap interface for IP asset tokens
- **Revenue**: Royalty claiming and tracking

## 📚 Documentation

- [Story Protocol Docs](https://docs.story.foundation)
- [Dynamic.xyz Docs](https://www.dynamic.xyz/docs)
- [Goldsky Docs](https://docs.goldsky.com)
