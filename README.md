# Sovry DEX - IP Asset Trading Platform

A decentralized exchange for Intellectual Property assets built on Story Protocol.

## 🏗️ Architecture

- **Frontend**: Next.js 16 with TypeScript
- **Backend**: Express.js API server  
- **Blockchain**: Story Protocol Aeneid Testnet
- **Protocol**: Dynamic.xyz for wallet integration

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
# Story Protocol API (Staging)
NEXT_PUBLIC_STORY_API_KEY=your_api_key_here
NEXT_PUBLIC_STORY_RPC_URL=https://aeneid.storyrpc.io

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
- **Trading**: Swap interface for IP asset tokens
- **Revenue**: Royalty claiming and tracking

## 🎯 Project Rules

1. **Always use Dynamic.xyz** for wallet integration
2. **Always use Story Protocol SDK** for IP asset management  
3. **Always use Goldsky** for subgraph data
4. **Never use mock data** - all data from blockchain APIs
5. **Never kill ports** - avoid long compilation times

## 📚 Documentation

- [Story Protocol Docs](https://docs.story.foundation)
- [Dynamic.xyz Docs](https://www.dynamic.xyz/docs)
- [Goldsky Docs](https://docs.goldsky.com)