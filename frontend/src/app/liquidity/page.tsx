"use client";

import { useState, useEffect } from "react";
import { useDynamicContext, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { Navigation } from "@/components/navigation/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Wallet, AlertCircle, CheckCircle, Crown, TrendingUp, ExternalLink, Unlock, Coins, Droplets, Database } from "lucide-react";
import { 
  fetchWalletIPAssets, 
  approveRoyaltyTokensDynamic,
  createPoolDynamic,
  IPAsset, 
  getTokenBalance, 
  needsTokenUnlock, 
  unlockRoyaltyTokens,
  TokenBalance,
  PoolCreationParams
} from "@/services/storyProtocolService";
import { createWalletClient, http } from "viem";

// Sovry Router Address for UI display
const SOVRY_ROUTER_ADDRESS = '0x5d885F211a9F9Ce5375A18cd5FD7d5721CB4278B';

// Goldsky API endpoint from env
const GOLDSKY_API_URL = process.env.NEXT_PUBLIC_GOLDSKY_API_URL;

// Types for user pools
interface UserPool {
  id: string;
  token0: {
    id: string;
    symbol: string;
    name: string;
  };
  token1: {
    id: string;
    symbol: string;
    name: string;
  };
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  volumeUSD: string;
  txCount: string;
  createdAtTimestamp: string;
}

// Manual token mapping for known addresses
const TOKEN_MAPPING: Record<string, { symbol: string; name: string }> = {
  "0x1514000000000000000000000000000000000000": {
    symbol: "WIP",
    name: "Wrapped IP"
  },
  "0xb6b837972cfb487451a71279fa78c327bb27646e": {
    symbol: "RT",
    name: "Royalty Token"
  }
};

export default function LiquidityPage() {
  const { primaryWallet } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();
  
  const [ipAssets, setIpAssets] = useState<IPAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingPool, setCreatingPool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedIP, setSelectedIP] = useState<string>("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [wipAmount, setWipAmount] = useState("1000");
  const [royaltyAmount, setRoyaltyAmount] = useState("1000");
  const [tokenBalances, setTokenBalances] = useState<Record<string, TokenBalance>>({});
  const [unlockingTokens, setUnlockingTokens] = useState<string | null>(null);
  
  // User pools state
  const [userPools, setUserPools] = useState<UserPool[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [poolsError, setPoolsError] = useState<string | null>(null);

  // Get wallet address from Dynamic
  const walletAddress = primaryWallet?.address;

  // Fetch user pools from Goldsky
  const fetchUserPools = async () => {
    if (!GOLDSKY_API_URL || !walletAddress) {
      return;
    }

    try {
      setPoolsLoading(true);
      setPoolsError(null);

      // Query pools where user has liquidity (simplified - in real implementation would need LP token balance check)
      const query = `
        query GetUserPools($userAddress: String!) {
          pools(first: 100) {
            id
            token0 {
              id
            }
            token1 {
              id
            }
            reserve0
            reserve1
            totalSupply
            volumeUSD
            txCount
            createdAtTimestamp
          }
        }
      `;

      const response = await fetch(GOLDSKY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: {
            userAddress: walletAddress.toLowerCase()
          }
        }),
      });

      const data = await response.json();
      console.log("🏊 User pools response:", data);

      if (data.errors && data.errors.length > 0) {
        throw new Error(data.errors[0]?.message || "GraphQL error");
      }

      if (data.data && data.data.pools) {
        // Map pools with proper token metadata
        const mappedPools = data.data.pools.map((pool: any) => {
          const token0Address = pool.token0?.id?.toLowerCase();
          const token1Address = pool.token1?.id?.toLowerCase();
          
          const token0Info = TOKEN_MAPPING[token0Address] || {
            symbol: "UNKNOWN",
            name: "Unknown Token"
          };
          
          const token1Info = TOKEN_MAPPING[token1Address] || {
            symbol: "UNKNOWN", 
            name: "Unknown Token"
          };
          
          return {
            ...pool,
            token0: {
              id: pool.token0?.id || "",
              symbol: token0Info.symbol,
              name: token0Info.name
            },
            token1: {
              id: pool.token1?.id || "",
              symbol: token1Info.symbol,
              name: token1Info.name
            }
          };
        });

        console.log("🏊 Mapped user pools:", mappedPools);
        setUserPools(mappedPools);
      } else {
        setUserPools([]);
      }
    } catch (err) {
      console.error("💥 Error fetching user pools:", err);
      setPoolsError(err instanceof Error ? err.message : "Failed to fetch user pools");
      setUserPools([]);
    } finally {
      setPoolsLoading(false);
    }
  };

  // Fetch IP assets and user pools when wallet is connected
  useEffect(() => {
    const fetchAssets = async () => {
      if (isLoggedIn && walletAddress) {
        setLoading(true);
        setError(null);
        
        try {
          const assets = await fetchWalletIPAssets(walletAddress);
          setIpAssets(assets);
          
          // Also fetch user pools
          await fetchUserPools();
          
          // Fetch token balances for each IP asset
          const balances: Record<string, TokenBalance> = {};
          for (const asset of assets) {
            if (asset.royaltyVaultAddress) {
              const balance = await getTokenBalance(walletAddress, asset.royaltyVaultAddress);
              if (balance) {
                balances[asset.ipId] = balance;
              }
            }
          }
          setTokenBalances(balances);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to fetch IP assets");
        } finally {
          setLoading(false);
        }
      }
    };

    fetchAssets();
  }, [isLoggedIn, walletAddress]);

  const handleUnlockTokens = async (ipAsset: IPAsset) => {
    if (!walletAddress) return;
    
    setUnlockingTokens(ipAsset.ipId);
    setError(null);
    setSuccess(null);

    try {
      const result = await unlockRoyaltyTokens(walletAddress, ipAsset.ipId);
      
      if (result.success) {
        setSuccess(`Tokens unlocked successfully! Transaction: ${result.transactionHash}`);
        
        // Refresh token balance
        const balance = await getTokenBalance(walletAddress, ipAsset.royaltyVaultAddress);
        if (balance) {
          setTokenBalances(prev => ({
            ...prev,
            [ipAsset.ipId]: balance
          }));
        }
      } else {
        throw new Error(result.error || "Failed to unlock tokens");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setUnlockingTokens(null);
    }
  };

  const handleCreatePool = async (ipAsset: IPAsset) => {
    try {
      setCreatingPool(ipAsset.ipId);
      setError(null);
      setSuccess(null);

      if (!primaryWallet) {
        throw new Error("Please connect your wallet first");
      }

      console.log('🚀 Starting Story Protocol pool creation with Dynamic SDK');
      console.log('IP Asset:', ipAsset);

      // Step 1: Approve Royalty Token for Sovry Router
      console.log('Step 1: Approving Royalty Token for Router...');
      
      const approveResult = await approveRoyaltyTokensDynamic(
        ipAsset.royaltyVaultAddress, // Royalty Token address to approve
        royaltyAmount, // Amount to approve (user-defined)
        primaryWallet
      );

      if (!approveResult.success) {
        throw new Error(approveResult.error || "Failed to approve royalty tokens");
      }

      console.log('✅ Royalty tokens approved successfully:', approveResult.txHash);

      // Step 2: Create Royalty Token + WIP pair using addLiquidityIP
      console.log('Step 2: Creating Royalty Token + WIP pair (IP will be wrapped to WIP)...');
      
      const poolResult = await createPoolDynamic(
        ipAsset.royaltyVaultAddress, // Royalty Token address for pair
        royaltyAmount, // User-defined royalty token amount
        wipAmount, // User-defined IP amount (will be wrapped to WIP)
        primaryWallet
      );

      if (!poolResult.success) {
        throw new Error(poolResult.error || "Failed to create Story Protocol pool");
      }

      console.log('✅ Story Protocol pool created successfully:', poolResult.txHash);
      
      setSuccess(`Story Protocol Pool created successfully! 
        Royalty Token Approve Tx: ${approveResult.txHash}
        Pool Creation Tx: ${poolResult.txHash}
        Pool Address: ${poolResult.poolAddress}
        
        Pair: ${royaltyAmount} Royalty Tokens + ${wipAmount} IP (wrapped to WIP)
        Router: ${SOVRY_ROUTER_ADDRESS.slice(0, 10)}...`);
      
      // DON'T remove IP asset on success - keep it for retry if needed
      // setIpAssets(prev => prev.filter(asset => asset.ipId !== ipAsset.ipId));
      setSelectedIP("");
      setTokenAddress("");
      setWipAmount("1000");
      setRoyaltyAmount("1000");

    } catch (error) {
      console.error('WIP pair creation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create WIP pair');
    } finally {
      setCreatingPool(null);
    }
  };

  const selectedIPAsset = ipAssets.find(asset => asset.ipId === selectedIP);
  const selectedTokenBalance = selectedIPAsset ? tokenBalances[selectedIPAsset.ipId] : null;
  const needsUnlock = selectedIPAsset ? 
    (selectedTokenBalance ? Number(selectedTokenBalance.balance) <= 0.000001 : true) : 
    false;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 via-purple-900 to-gray-900">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Connect EVM Wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Connect your EVM wallet (MetaMask, WalletConnect, etc.) to view your IP assets and create pools.
                  </AlertDescription>
                </Alert>

                {/* Wallet Installation Help */}
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold">MetaMask Extension Not Detected</p>
                      <p>Please install MetaMask browser extension first:</p>
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        <a 
                          href="https://metamask.io/download/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Download MetaMask
                        </a>
                      </div>
                      <p className="text-xs">After installation, refresh this page</p>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Alternative Options */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Alternative Options:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Try using WalletConnect mobile app</li>
                    <li>• Use Brave browser (built-in wallet)</li>
                    <li>• Try other wallet extensions like Phantom</li>
                    <li>• Check if MetaMask is enabled in your browser</li>
                  </ul>
                </div>

                {/* Troubleshooting */}
                <div className="p-3 bg-gray-100 rounded-lg text-xs">
                  <p><strong>Troubleshooting:</strong></p>
                  <ul className="space-y-1 mt-1">
                    <li>• Make sure MetaMask is enabled in browser extensions</li>
                    <li>• Try refreshing the page after installing MetaMask</li>
                    <li>• Check if browser is blocking extensions</li>
                    <li>• Try incognito/private window</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Format large numbers
  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  // Format timestamp
  const formatDate = (timestamp: string) => {
    return new Date(parseInt(timestamp) * 1000).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Create Liquidity Pools from IP Assets
          </h1>
          <p className="text-lg text-white/80 max-w-3xl mx-auto">
            Create liquidity pools using WIP tokens paired with your IP asset royalty tokens. 
            Each IP asset with royalty tokens can be paired with WIP (Wrapped IP) tokens.
          </p>
          
          {/* Wallet Status */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full">
            <Wallet className="h-4 w-4" />
            <span className="text-sm font-medium">
              Connected: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
            </span>
          </div>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* IP Assets List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Your IP Assets with Royalty Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Fetching IP assets...</span>
                </div>
              ) : ipAssets.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No IP assets with royalty tokens found. Create IP assets first to enable liquidity pool creation.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {ipAssets.map((ipAsset) => {
                    const tokenBalance = tokenBalances[ipAsset.ipId];
                    const hasTokens = tokenBalance && Number(tokenBalance.balance) > 0.000001;
                    
                    return (
                      <div
                        key={ipAsset.ipId}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedIP === ipAsset.ipId
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setSelectedIP(ipAsset.ipId)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{ipAsset.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{ipAsset.description}</p>
                            <div className="mt-2 text-xs text-gray-500">
                              <p>IP ID: {ipAsset.ipId.slice(0, 10)}...</p>
                              <p>Royalty Vault: {ipAsset.royaltyVaultAddress.slice(0, 10)}...</p>
                            </div>
                            
                            {/* Token Balance Display */}
                            {tokenBalance && (
                              <div className="mt-2 flex items-center gap-2">
                                <Coins className="h-3 w-3 text-yellow-600" />
                                <span className="text-xs font-medium">
                                  {tokenBalance.balance} {tokenBalance.symbol}
                                </span>
                                {hasTokens ? (
                                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                    Available
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                                    Needs Unlock
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {ipAsset.hasRoyaltyTokens && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                Has Royalty Tokens
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pool Creation Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create Liquidity Pool
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedIPAsset ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Select an IP asset from the left to create a liquidity pool.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-2">Selected IP Asset</h3>
                    <p className="text-sm text-blue-800">{selectedIPAsset.name}</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Royalty Token: {selectedIPAsset.royaltyVaultAddress.slice(0, 10)}...
                    </p>
                  </div>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="font-medium text-green-900 mb-2">Story Protocol Pool Details</h3>
                    <div className="text-sm text-green-800 space-y-1">
                      <p>• Royalty Token: {selectedIPAsset.royaltyVaultAddress.slice(0, 10)}...</p>
                      <p>• Native IP: Will be wrapped to WIP automatically</p>
                      <p>• Final Pair: Royalty Token + WIP</p>
                      <p>• Router: Sovry Router ({SOVRY_ROUTER_ADDRESS?.slice(0, 10)}...)</p>
                    </div>
                  </div>

                  {/* Liquidity Input Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Liquidity Amounts</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="royaltyAmount">Royalty Token Amount</Label>
                        <Input
                          id="royaltyAmount"
                          type="number"
                          value={royaltyAmount}
                          onChange={(e) => setRoyaltyAmount(e.target.value)}
                          placeholder="1000"
                          min="0"
                          step="0.01"
                        />
                        <p className="text-xs text-gray-500 mt-1">Amount of royalty tokens</p>
                      </div>
                      
                      <div>
                        <Label htmlFor="wipAmount">Native IP Amount</Label>
                        <Input
                          id="wipAmount"
                          type="number"
                          value={wipAmount}
                          onChange={(e) => setWipAmount(e.target.value)}
                          placeholder="1000"
                          min="0"
                          step="0.01"
                        />
                        <p className="text-xs text-gray-500 mt-1">Native IP (will be wrapped to WIP)</p>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Pool Preview:</strong> {royaltyAmount || '0'} Royalty Tokens + {wipAmount || '0'} IP → WIP
                      </p>
                    </div>
                  </div>

                  {needsUnlock && (
                    <div className="space-y-3">
                      <Alert variant="destructive">
                        <Unlock className="h-4 w-4" />
                        <AlertDescription>
                          You need to unlock royalty tokens before creating a liquidity pool.
                        </AlertDescription>
                      </Alert>
                      
                      <Button
                        onClick={() => handleUnlockTokens(selectedIPAsset)}
                        disabled={unlockingTokens === selectedIPAsset.ipId}
                        className="w-full"
                        variant="outline"
                      >
                        {unlockingTokens === selectedIPAsset.ipId ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Unlocking Tokens...
                          </>
                        ) : (
                          <>
                            <Unlock className="mr-2 h-4 w-4" />
                            Unlock Royalty Tokens
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={() => handleCreatePool(selectedIPAsset)}
                    disabled={
                      creatingPool === selectedIPAsset.ipId || 
                      needsUnlock || 
                      !wipAmount || 
                      !royaltyAmount || 
                      parseFloat(wipAmount) <= 0 || 
                      parseFloat(royaltyAmount) <= 0
                    }
                    className="w-full"
                    size="lg"
                  >
                    {creatingPool === selectedIPAsset.ipId ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Liquidity Pool...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Create Story Protocol Pool ({royaltyAmount || '0'} RT + {wipAmount || '0'} IP)
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* User Pools Section */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5" />
                Your Liquidity Pools
              </CardTitle>
            </CardHeader>
            <CardContent>
              {poolsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading your pools...</span>
                </div>
              ) : poolsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{poolsError}</AlertDescription>
                </Alert>
              ) : userPools.length === 0 ? (
                <Alert>
                  <Database className="h-4 w-4" />
                  <AlertDescription>
                    You don't have any liquidity pools yet. Create your first pool above!
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {userPools.map((pool) => (
                    <Card key={pool.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Droplets className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">
                              {pool.token0?.symbol ?? "UNKNOWN"} / {pool.token1?.symbol ?? "UNKNOWN"}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            Your Pool
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Token Information */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Token 0:</span>
                            <span className="text-xs font-medium">
                              {pool.token0?.symbol ?? "UNKNOWN"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Token 1:</span>
                            <span className="text-xs font-medium">
                              {pool.token1?.symbol ?? "UNKNOWN"}
                            </span>
                          </div>
                        </div>

                        {/* Pool Stats */}
                        <div className="space-y-2 pt-2 border-t">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Reserve 0:</span>
                            <span className="text-xs font-medium">
                              {formatNumber(pool.reserve0)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Reserve 1:</span>
                            <span className="text-xs font-medium">
                              {formatNumber(pool.reserve1)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Volume USD:</span>
                            <span className="text-xs font-medium text-green-600">
                              ${formatNumber(pool.volumeUSD)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Created:</span>
                            <span className="text-xs font-medium">
                              {formatDate(pool.createdAtTimestamp)}
                            </span>
                          </div>
                        </div>

                        {/* Pool Address */}
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Pool:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono">
                                {pool.id.slice(0, 6)}...{pool.id.slice(-4)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(pool.id);
                                }}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
