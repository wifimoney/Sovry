"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/navigation/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Database, TrendingUp, ExternalLink, AlertCircle, Droplets, DollarSign, RefreshCw, Plus, Zap } from "lucide-react";
import RedisService, { CachedPool } from "@/services/redisService";

// Types for Goldsky subgraph data
interface Pool {
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

interface PoolsResponse {
  data?: {
    pools?: Pool[];
  };
  errors?: { message: string }[];
}

// Goldsky API endpoint from env
const GOLDSKY_API_URL = process.env.NEXT_PUBLIC_GOLDSKY_API_URL;

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

export default function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [userPools, setUserPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPoolsLoading, setUserPoolsLoading] = useState(false);
  const [userPoolsError, setUserPoolsError] = useState<string | null>(null);

  // Add liquidity modal state
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [isAddLiquidityOpen, setIsAddLiquidityOpen] = useState(false);
  const [token0Amount, setToken0Amount] = useState("");
  const [token1Amount, setToken1Amount] = useState("");
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  
  // Redis cache state
  const [isFromCache, setIsFromCache] = useState(false);
  const [cacheStats, setCacheStats] = useState<{
    pools: boolean;
    goldsky: boolean;
    uptime: string;
  } | null>(null);

  // GraphQL query for Sovry pools (matches subgraph schema)
  const POOLS_QUERY = `
    query GetPools {
      pools(
        first: 100
        orderBy: createdAtTimestamp
        orderDirection: desc
      ) {
        id
        token0 {
          id
          symbol
          name
        }
        token1 {
          id
          symbol
          name
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

  // Fallback query with manual token symbol mapping
  const POOLS_QUERY_WITH_FALLBACK = `
    query GetPoolsWithFallback {
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

  // Introspection query to debug Goldsky schema
  const INTROSPECTION_QUERY = `
    query IntrospectionQuery {
      __schema {
        queryType {
          fields {
            name
            type {
              name
              kind
            }
          }
        }
      }
    }
  `;

  // Fetch pools data from Goldsky subgraph with Redis caching
  const fetchPools = async (forceRefresh = false) => {
    console.log("🔍 GOLDSKY_API_URL:", GOLDSKY_API_URL);
    
    if (!GOLDSKY_API_URL) {
      setError("Goldsky API URL not configured in environment variables");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setIsFromCache(false);

      // Try to get cached data first (unless force refresh)
      if (!forceRefresh) {
        console.log("🔍 Checking Redis cache for pools data...");
        const cachedPools = await RedisService.getCachedPoolsData();
        
        if (cachedPools && cachedPools.length > 0) {
          console.log(`✅ Using cached pools data (${cachedPools.length} pools)`);
          setPools(cachedPools);
          setIsFromCache(true);
          setLoading(false);
          return;
        }
      }

      console.log("🚀 Fetching fresh data from Goldsky:", POOLS_QUERY_WITH_FALLBACK);

      const response = await fetch(GOLDSKY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: POOLS_QUERY_WITH_FALLBACK,
        }),
      });

      console.log("📡 Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ HTTP error response:", errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data: PoolsResponse = await response.json();
      console.log("✅ Goldsky pools response:", JSON.stringify(data, null, 2));

      if (data.errors && data.errors.length > 0) {
        console.error("❌ GraphQL errors:", data.errors);
        throw new Error(`GraphQL error: ${data.errors[0]?.message || "Unknown GraphQL error"}`);
      }

      // Check what we actually got back
      console.log("🔍 Response structure check:");
      console.log("- data:", !!data.data);
      console.log("- data.pools:", !!data.data?.pools);
      console.log("- pools array:", data.data?.pools);
      console.log("- pools length:", data.data?.pools?.length || 0);

      if (data.data && data.data.pools) {
        if (data.data.pools.length > 0) {
          console.log(`🎉 Found ${data.data.pools.length} pools from Goldsky`);
          console.log("📊 Raw pool data:", data.data.pools[0]);
          
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
          
          console.log("📊 Mapped pool data:", mappedPools[0]);
          setPools(mappedPools);
          
          // Cache the fresh data to Redis
          await RedisService.cachePoolsData(mappedPools);
          await RedisService.cacheGoldskyResponse(data);
        } else {
          console.log("⚠️ Pools array is empty - no pools created yet");
          setError("No pools found in Goldsky subgraph. No pools have been created yet on Sovry DEX.");
          setPools([]);
        }
      } else {
        console.log("⚠️ No pools data structure in response");
        setError("Invalid response structure from Goldsky subgraph.");
        setPools([]);
      }
    } catch (err) {
      console.error("💥 Error fetching pools:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch pools data from Goldsky");
      setPools([]);
    } finally {
      setLoading(false);
    }
  };

  // Debug Goldsky schema
  const debugSchema = async () => {
    if (!GOLDSKY_API_URL) {
      console.error("No Goldsky API URL configured");
      return;
    }

    try {
      console.log("🔍 Debugging Goldsky schema...");
      
      const response = await fetch(GOLDSKY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: INTROSPECTION_QUERY,
        }),
      });

      const data = await response.json();
      console.log("📋 Goldsky Schema Fields:", data.data?.__schema?.queryType?.fields?.map((f: any) => f.name));
      
      // Try a simple pools query to see what's available
      const poolsTestResponse = await fetch(GOLDSKY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `{ 
            pools(first: 5) { 
              id 
            } 
          }`,
        }),
      });
      
      const poolsTestData = await poolsTestResponse.json();
      console.log("🔍 Simple pools query result:", JSON.stringify(poolsTestData, null, 2));
      
      // Try factory query to see if there's any data
      const factoryResponse = await fetch(GOLDSKY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `{ 
            factory(id: "0x5d885F211a9F9Ce5375A18cd5FD7d5721CB4278B") { 
              id
              poolCount
              totalVolumeUSD
            } 
          }`,
        }),
      });
      
      const factoryData = await factoryResponse.json();
      console.log("🏭 Factory query result:", JSON.stringify(factoryData, null, 2));
      
      // Check all factories
      const allFactoriesResponse = await fetch(GOLDSKY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `{ 
            factories(first: 10) { 
              id
              poolCount
              totalVolumeUSD
            } 
          }`,
        }),
      });
      
      const allFactoriesData = await allFactoriesResponse.json();
      console.log("🏭 All factories:", JSON.stringify(allFactoriesData, null, 2));
      
      // Check all tokens
      const tokensResponse = await fetch(GOLDSKY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `{ 
            tokens(first: 10) { 
              id
              symbol
              name
            } 
          }`,
        }),
      });
      
      const tokensData = await tokensResponse.json();
      console.log("🪙 All tokens:", JSON.stringify(tokensData, null, 2));
      
    } catch (err) {
      console.error("❌ Schema debug failed:", err);
    }
  };

  // Load cache stats
  const loadCacheStats = async () => {
    try {
      const stats = await RedisService.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error("Failed to load cache stats:", error);
    }
  };

  // Fetch pools on component mount
  useEffect(() => {
    fetchPools();
    loadCacheStats();
  }, []);

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

  // Handle add liquidity
  const handleAddLiquidity = async () => {
    if (!selectedPool || !token0Amount || !token1Amount) return;
    
    setIsAddingLiquidity(true);
    
    try {
      // Simulate add liquidity transaction
      console.log("Adding liquidity:", {
        pool: selectedPool.id,
        token0Amount,
        token1Amount,
        token0Symbol: selectedPool.token0.symbol,
        token1Symbol: selectedPool.token1.symbol
      });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Create transaction record for Redis cache
      const liquidityTransaction = {
        id: `liquidity-${Date.now()}`,
        pool: selectedPool.id,
        token0Symbol: selectedPool.token0.symbol,
        token1Symbol: selectedPool.token1.symbol,
        amount0: token0Amount,
        amount1: token1Amount,
        timestamp: Date.now(),
        txHash: `0x${Math.random().toString(16).substr(2, 64)}` // Mock hash
      };
      
      // Add to user history (using mock address for now)
      const mockUserAddress = "0x1234567890123456789012345678901234567890";
      await RedisService.addSwapToHistory(mockUserAddress, liquidityTransaction);
      
      // Reset form
      setToken0Amount("");
      setToken1Amount("");
      setIsAddLiquidityOpen(false);
      
      // Force refresh pools data to clear cache
      await fetchPools(true);
      await loadCacheStats();
      
      alert(`Successfully added ${token0Amount} ${selectedPool.token0.symbol} and ${token1Amount} ${selectedPool.token1.symbol} to the pool!`);
    } catch (error) {
      console.error("Add liquidity error:", error);
      alert("Failed to add liquidity. Please try again.");
    } finally {
      setIsAddingLiquidity(false);
    }
  };

  // Calculate proportional amounts based on pool reserves
  const calculateProportionalAmount = (inputAmount: string, isToken0: boolean) => {
    if (!selectedPool || !inputAmount) return "";
    
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) return "";
    
    const reserve0 = parseFloat(selectedPool.reserve0);
    const reserve1 = parseFloat(selectedPool.reserve1);
    
    if (reserve0 <= 0 || reserve1 <= 0) return "";
    
    if (isToken0) {
      // Calculate token1 amount based on token0 input
      const token1Amount = (amount * reserve1) / reserve0;
      return token1Amount.toFixed(6);
    } else {
      // Calculate token0 amount based on token1 input
      const token0Amount = (amount * reserve0) / reserve1;
      return token0Amount.toFixed(6);
    }
  };

  // Handle token amount changes with proportional calculation
  const handleToken0AmountChange = (value: string) => {
    setToken0Amount(value);
    if (selectedPool && value) {
      const proportionalToken1 = calculateProportionalAmount(value, true);
      setToken1Amount(proportionalToken1);
    } else {
      setToken1Amount("");
    }
  };

  const handleToken1AmountChange = (value: string) => {
    setToken1Amount(value);
    if (selectedPool && value) {
      const proportionalToken0 = calculateProportionalAmount(value, false);
      setToken0Amount(proportionalToken0);
    } else {
      setToken0Amount("");
    }
  };

  // Open add liquidity modal
  const openAddLiquidityModal = (pool: Pool) => {
    setSelectedPool(pool);
    setToken0Amount("");
    setToken1Amount("");
    setIsAddLiquidityOpen(true);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Liquidity Pools
          </h1>
          <p className="text-lg text-white/80 max-w-3xl mx-auto">
            View all liquidity pools on Sovry DEX. Data is sourced from the Goldsky subgraph for real-time pool information.
          </p>
        </div>

        {/* Header with cache status and refresh buttons */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-white" />
              <span className="text-white font-medium">
                {pools.length} Pools Found
              </span>
            </div>
            
            {/* Cache Status */}
            {isFromCache && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-lg">
                <Zap className="h-4 w-4 text-blue-400" />
                <span className="text-blue-300 text-sm font-medium">From Cache</span>
              </div>
            )}
            
            {cacheStats && (
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <span>Redis:</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  cacheStats.pools ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-300"
                }`}>
                  {cacheStats.pools ? "✓" : "✗"} Pools
                </span>
                <span className={`px-2 py-1 rounded text-xs ${
                  cacheStats.goldsky ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-300"
                }`}>
                  {cacheStats.goldsky ? "✓" : "✗"} Goldsky
                </span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={debugSchema}
              variant="outline"
              size="sm"
              className="text-white border-white/20 hover:bg-white/10"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Debug Schema
            </Button>
            <Button
              onClick={() => fetchPools(false)}
              disabled={loading}
              variant="outline"
              size="sm"
              className="text-white border-white/20 hover:bg-white/10"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
            <Button
              onClick={() => fetchPools(true)}
              disabled={loading}
              variant="outline"
              size="sm"
              className="text-white border-white/20 hover:bg-white/10"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Force Refresh
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && pools.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin mr-3" />
                <span className="text-lg">Loading pools data from Goldsky...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pools Grid */}
        {!loading && pools.length === 0 && !error && (
          <Card>
            <CardContent className="py-12 text-center">
              <Database className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No Pools Found</h3>
              <p className="text-gray-600">
                No liquidity pools are currently available on Sovry DEX.
              </p>
            </CardContent>
          </Card>
        )}

        {pools.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pools.map((pool) => (
                <Card key={pool.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Droplets className="h-5 w-5 text-blue-500" />
                        <span className="text-lg">
                          {pool.token0?.symbol ?? "UNKNOWN"} / {pool.token1?.symbol ?? "UNKNOWN"}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Pool
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Token Information */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Token 0:</span>
                        <span className="text-sm font-medium">
                          {pool.token0?.symbol ?? "UNKNOWN"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Token 1:</span>
                        <span className="text-sm font-medium">
                          {pool.token1?.symbol ?? "UNKNOWN"}
                        </span>
                      </div>
                    </div>

                    {/* Reserves */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Reserve 0:</span>
                        <span className="text-sm font-medium">
                          {formatNumber(pool.reserve0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Reserve 1:</span>
                        <span className="text-sm font-medium">
                          {formatNumber(pool.reserve1)}
                        </span>
                      </div>
                    </div>

                    {/* Pool Stats */}
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Supply:</span>
                        <span className="text-sm font-medium">
                          {formatNumber(pool.totalSupply)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Volume USD:</span>
                        <span className="text-sm font-medium text-green-600">
                          ${formatNumber(pool.volumeUSD)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Transactions:</span>
                        <span className="text-sm font-medium">
                          {formatNumber(pool.txCount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Created:</span>
                        <span className="text-sm font-medium">
                          {formatDate(pool.createdAtTimestamp)}
                        </span>
                      </div>
                    </div>

                  {/* Pool Address */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Pool Address:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono">
                          {pool.id.slice(0, 6)}...{pool.id.slice(-4)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            navigator.clipboard.writeText(pool.id);
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Add Liquidity Button */}
                  <div className="pt-3 border-t mt-3">
                    <Button
                      onClick={() => openAddLiquidityModal(pool)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Liquidity
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-white/60">
            Data sourced from Goldsky subgraph • Updated in real-time
          </p>
          {GOLDSKY_API_URL && (
            <p className="text-xs text-white/40 mt-1">
              API: {GOLDSKY_API_URL.split("/").slice(-2).join("/")}
            </p>
          )}
        </div>
      </main>

      {/* Add Liquidity Modal (simple overlay, no dialog dependency) */}
      {isAddLiquidityOpen && selectedPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Add Liquidity</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddLiquidityOpen(false)}
                disabled={isAddingLiquidity}
              >
                Close
              </Button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800">
                  {selectedPool.token0.symbol} / {selectedPool.token1.symbol} Pool
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Current Ratio: {parseFloat(selectedPool.reserve0).toFixed(2)} {selectedPool.token0.symbol} : {parseFloat(selectedPool.reserve1).toFixed(2)} {selectedPool.token1.symbol}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {selectedPool.token0.symbol} Amount
                </label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={token0Amount}
                  onChange={(e) => handleToken0AmountChange(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  {selectedPool.token0.name}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {selectedPool.token1.symbol} Amount
                </label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={token1Amount}
                  onChange={(e) => handleToken1AmountChange(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  {selectedPool.token1.name}
                </p>
              </div>

              {token0Amount && token1Amount && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-800">
                    ✓ Amounts are proportional to current pool ratio
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsAddLiquidityOpen(false)}
                  className="flex-1"
                  disabled={isAddingLiquidity}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddLiquidity}
                  disabled={!token0Amount || !token1Amount || isAddingLiquidity}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isAddingLiquidity ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Liquidity
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
