import { createPublicClient, createWalletClient, http, PrivateKeyAccount } from 'viem';
import { storyTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Story Protocol Testnet Configuration
const STORY_TESTNET = {
  id: 1315,
  chainId: 1315,
  name: 'Story Testnet',
  nativeCurrency: {
    name: 'IP',
    symbol: 'IP',
    decimals: 18,
  },
  rpcUrls: {
    public: { http: ['https://aeneid.storyrpc.io'] },
    default: { http: ['https://aeneid.storyrpc.io'] },
  },
  blockExplorers: {
    default: { name: 'Storyscan', url: 'https://storyscan.xyz' },
  },
  testnet: true,
};

// Create clients
const publicClient = createPublicClient({
  chain: STORY_TESTNET,
  transport: http(),
});

const getWalletClient = () => {
  const privateKey = process.env.PRIVATE_KEY || process.env.NEXT_PUBLIC_PRIVATE_KEY;
  
  if (!privateKey || privateKey === 'your_private_key_here') {
    throw new Error('Private key not configured. Please set PRIVATE_KEY in environment variables.');
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  return createWalletClient({
    account,
    chain: STORY_TESTNET,
    transport: http(),
  });
};

// Mock IP Asset interface
export interface IPAsset {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  owner: string;
  createdAt: string;
}

// Pool creation parameters
export interface PoolCreationParams {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  token0Address: string;
  token1Address: string;
}

// Wallet info interface
export interface WalletInfo {
  address: string;
  balance: string;
  isConnected: boolean;
}

// Check if wallet is configured (using Dynamic)
export function isWalletConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Dynamic handles wallet configuration
  return true;
}

// Get wallet info using Dynamic
export async function getWalletInfo(): Promise<WalletInfo | null> {
  try {
    // For now, return mock data since we're using Dynamic
    // In production, this would use Dynamic's wallet API
    return {
      address: '0x1234567890123456789012345678901234567890',
      balance: '1.2345',
      isConnected: true,
    };
  } catch (error) {
    console.error('Error getting wallet info:', error);
    return null;
  }
}

// Create IP Asset Pool using Dynamic wallet
export async function createIPAssetPool(params: PoolCreationParams): Promise<{
  success: boolean;
  poolAddress?: string;
  error?: string;
}> {
  try {
    // Mock pool creation - in production this would use Dynamic's signing API
    console.log('Creating IP Asset Pool with params:', params);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate mock pool address
    const poolAddress = `0x${Math.random().toString(16).substr(2, 40)}`;
    
    return {
      success: true,
      poolAddress,
    };
  } catch (error) {
    console.error('Error creating IP Asset Pool:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Create mock IP Asset
export async function createMockIPAsset(params: {
  name: string;
  description: string;
  imageUrl: string;
}): Promise<IPAsset> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    id: `ip_${Date.now()}`,
    name: params.name,
    description: params.description,
    imageUrl: params.imageUrl,
    owner: '0x1234567890123456789012345678901234567890',
    createdAt: new Date().toISOString(),
  };
}
