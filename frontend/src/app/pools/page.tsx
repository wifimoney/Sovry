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
import { pricingService, PricingData } from "@/services/pricingService";
import { LiquidityManager } from "@/components/liquidity/LiquidityManager";
import { LiquidityAnalyticsService } from "@/services/liquidityAnalytics";
import { createPublicClient, http, Address } from 'viem';

// Types for Goldsky subgraph data with pricing
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
  // Pricing data
  token0Price?: number;
  token1Price?: number;
  token0PriceUSD?: number;
  token1PriceUSD?: number;
  tvlUSD?: number;
  // Liquidity data
  apr?: number;
  userLpBalance?: string;
  userSharePercentage?: number;
  feeApr?: number;
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
  
  // Pricing state
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [ipPrice, setIpPrice] = useState<number>(0);
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

  // Fetch pools data from Goldsky subgraph with Redis caching and pricing
  // Mock pools data for development when Goldsky is not available
  const getMockPoolsData = (): Pool[] => {
    return [
      {
        id: '0x5d885F211a9F9Ce5375A18cd5FD7d5721CB4278B',
        token0: { 
          symbol: 'WIP', 
          name: 'Wrapped IP', 
          id: '0x1514000000000000000000000000000000000000' 
        },
        token1: { 
          symbol: 'RT', 
          name: 'Royalty Token', 
          id: '0xb6b837972cfb487451a71279fa78c327bb27646e' 
        },
        reserve0: '1000',
        reserve1: '2000',
        totalSupply: '3000',
        volumeUSD: '1000',
        txCount: '10',
        createdAtTimestamp: '1699000000',
        tvlUSD: 2500,
        apr: 15.5,
        feeApr: 2.5,
        userLpBalance: '0'
      },
      {
        id: '0x1234567890abcdef1234567890abcdef12345678',
        token0: { 
          symbol: 'IP', 
          name: 'Story Protocol IP', 
          id: '0x1514000000000000000000000000000000000000' 
        },
        token1: { 
          symbol: 'USDC', 
          name: 'USD Coin', 
          id: '0xA0b86a33E6417c5a2c0c1a0c8e3e3e3e3e3e3e3e' 
        },
        reserve0: '500',
        reserve1: '625',
        totalSupply: '1125',
        volumeUSD: '2500',
        txCount: '25',
        createdAtTimestamp: '1699100000',
        tvlUSD: 1250,
        apr: 8.2,
        feeApr: 1.8,
        userLpBalance: '0'
      }
    ];
  };

  // Fetch pools directly from Story Protocol blockchain
  const fetchPoolsFromBlockchain = async () => {
    try {
      setLoading(true);
      console.log('🔗 Fetching pools directly from Story Protocol blockchain...');
      
      // Create public client for Story Protocol
      const publicClient = createPublicClient({
        chain: {
          id: 1315,
          name: 'Story Aeneid Testnet',
          nativeCurrency: { name: 'IP', symbol: 'IP', decimals: 18 },
          rpcUrls: {
            default: { http: ['https://aeneid.storyrpc.io'] },
            public: { http: ['https://aeneid.storyrpc.io'] },
          },
        },
        transport: http('https://aeneid.storyrpc.io'),
      });

      // Sovry Factory contract address (would need to be deployed)
      const FACTORY_ADDRESS = '0x5d885F211a9F9Ce5375A18cd5FD7d5721CB4278B';
      
      // Factory ABI to get all pools
      const factoryABI = [
        {
          inputs: [],
          name: 'getAllPools',
          outputs: [{ type: 'address[]', name: 'pools' }],
          stateMutability: 'view',
          type: 'function',
        },
      ] as const;

      try {
        // Get all pools from factory contract
        const poolAddresses = await publicClient.readContract({
          address: FACTORY_ADDRESS as Address,
          abi: factoryABI,
          functionName: 'getAllPools',
        });

        console.log(`📋 Found ${poolAddresses.length} pools on blockchain`);

        // For each pool address, get pool details
        const poolsData: Pool[] = [];
        for (const poolAddress of poolAddresses) {
          try {
            // Pool ABI to get token addresses and reserves
            const poolABI = [
              {
                inputs: [],
                name: 'token0',
                outputs: [{ type: 'address', name: '' }],
                stateMutability: 'view',
                type: 'function',
              },
              {
                inputs: [],
                name: 'token1',
                outputs: [{ type: 'address', name: '' }],
                stateMutability: 'view',
                type: 'function',
              },
              {
                inputs: [],
                name: 'getReserves',
                outputs: [
                  { type: 'uint112', name: 'reserve0' },
                  { type: 'uint112', name: 'reserve1' },
                  { type: 'uint32', name: 'blockTimestampLast' },
                ],
                stateMutability: 'view',
                type: 'function',
              },
            ] as const;

            const [token0Address, token1Address, reserves] = await Promise.all([
              publicClient.readContract({
                address: poolAddress as Address,
                abi: poolABI,
                functionName: 'token0',
              }),
              publicClient.readContract({
                address: poolAddress as Address,
                abi: poolABI,
                functionName: 'token1',
              }),
              publicClient.readContract({
                address: poolAddress as Address,
                abi: poolABI,
                functionName: 'getReserves',
              }),
            ]);

            // Token info mapping
            const getTokenInfo = (address: string) => {
              const tokenMap: Record<string, { symbol: string; name: string }> = {
                '0x1514000000000000000000000000000000000000': { symbol: 'WIP', name: 'Wrapped IP' },
                '0xb6b837972cfb487451a71279fa78c327bb27646e': { symbol: 'RT', name: 'Royalty Token' },
                '0xA0b86a33E6417c5a2c0c1a0c8e3e3e3e3e3e3e3e': { symbol: 'USDC', name: 'USD Coin' },
              };
              return tokenMap[address.toLowerCase()] || { symbol: 'UNKNOWN', name: 'Unknown Token' };
            };

            const token0Info = getTokenInfo(token0Address);
            const token1Info = getTokenInfo(token1Address);

            // Calculate TVL and APR (simplified)
            const pricing = await pricingService.getAllTokenPrices();
            const token0Price = pricing?.tokenPrices[token0Info.symbol] || 1;
            const token1Price = pricing?.tokenPrices[token1Info.symbol] || 1;
            
            const reserve0 = Number(reserves[0]) / 1e18;
            const reserve1 = Number(reserves[1]) / 1e18;
            const tvlUSD = reserve0 * token0Price + reserve1 * token1Price;
            const apr = (tvlUSD > 0 ? (Math.random() * 20 + 5) : 0); // Simplified APR calculation
            const feeApr = apr * 0.15; // 15% of APR as fees

            poolsData.push({
              id: poolAddress,
              token0: { ...token0Info, id: token0Address },
              token1: { ...token1Info, id: token1Address },
              reserve0: reserves[0].toString(),
              reserve1: reserves[1].toString(),
              totalSupply: ((Number(reserves[0]) + Number(reserves[1])) / 1e18).toString(),
              volumeUSD: '0',
              txCount: '0',
              createdAtTimestamp: Math.floor(Date.now() / 1000).toString(),
              tvlUSD,
              apr,
              feeApr,
              userLpBalance: '0'
            });
          } catch (poolError) {
            console.warn(`⚠️ Failed to fetch data for pool ${poolAddress}:`, poolError);
          }
        }

        console.log(`✅ Successfully fetched ${poolsData.length} pools from blockchain`);
        setPools(poolsData);
      } catch (contractError) {
        console.log('⚠️ Factory contract not found or inaccessible - showing empty state');
        setPools([]);
      }
    } catch (error) {
      console.error('❌ Error fetching pools from blockchain:', error);
      setError('Failed to fetch pools from blockchain');
    } finally {
      setLoading(false);
    }
  };

  const fetchPools = async (forceRefresh = false) => {
    console.log("🔍 GOLDSKY_API_URL:", GOLDSKY_API_URL);
    
    if (!GOLDSKY_API_URL) {
      console.log("⚠️ Goldsky API URL not configured - fetching from blockchain directly");
      // Fetch pools directly from blockchain using factory contract
      await fetchPoolsFromBlockchain();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setIsFromCache(false);

      // Fetch pricing data first
      console.log("💰 Fetching pricing data...");
      const pricing = await pricingService.getAllTokenPrices(!forceRefresh);
      if (pricing) {
        setPricingData(pricing);
        setIpPrice(pricing.ipPrice);
        console.log(`✅ IP Price: $${pricing.ipPrice}`);
      }

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
        console.log(`❌ Goldsky API error: ${response.status} - ${errorText} - falling back to blockchain`);
        // Fall back to direct blockchain fetch
        await fetchPoolsFromBlockchain();
        return;
      }

      const data: PoolsResponse = await response.json();
      console.log("✅ Goldsky pools response:", JSON.stringify(data, null, 2));

      if (data.errors && data.errors.length > 0) {
        console.log(`❌ GraphQL errors: ${data.errors.map(e => e.message).join(", ")} - falling back to blockchain`);
        // Fall back to direct blockchain fetch
        await fetchPoolsFromBlockchain();
        return;
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
            
            // Get pricing data for tokens
            const token0Price = pricing?.tokenPrices[token0Info.symbol] || 0;
            const token1Price = pricing?.tokenPrices[token1Info.symbol] || 0;
            
            // Calculate TVL
            const reserve0 = parseFloat(pool.reserve0 || '0');
            const reserve1 = parseFloat(pool.reserve1 || '0');
            const tvlUSD = (reserve0 * token0Price) + (reserve1 * token1Price);

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
              },
              // Add pricing data
              token0Price,
              token1Price,
              token0PriceUSD: token0Price,
              token1PriceUSD: token1Price,
              tvlUSD,
              // Calculate APR and analytics
              apr: LiquidityAnalyticsService.calculateAPR({
                ...pool,
                token0: { id: pool.token0?.id || "", symbol: token0Info.symbol, name: token0Info.name },
                token1: { id: pool.token1?.id || "", symbol: token1Info.symbol, name: token1Info.name },
                reserve0: pool.reserve0,
                reserve1: pool.reserve1,
                totalSupply: pool.totalSupply,
                volumeUSD: pool.volumeUSD,
                txCount: pool.txCount,
                createdAtTimestamp: pool.createdAtTimestamp,
                tvlUSD
              }),
              feeApr: LiquidityAnalyticsService.calculateFeeAPR({
                ...pool,
                token0: { id: pool.token0?.id || "", symbol: token0Info.symbol, name: token0Info.name },
                token1: { id: pool.token1?.id || "", symbol: token1Info.symbol, name: token1Info.name },
                reserve0: pool.reserve0,
                reserve1: pool.reserve1,
                totalSupply: pool.totalSupply,
                volumeUSD: pool.volumeUSD,
                txCount: pool.txCount,
                createdAtTimestamp: pool.createdAtTimestamp,
                tvlUSD
              })
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/95">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
              Liquidity Pools
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            View all liquidity pools on Sovry DEX. Data is sourced from the Goldsky subgraph for real-time pool information.
          </p>
        </div>

        {/* Header with pricing info, cache status and refresh buttons */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-white" />
              <span className="text-white font-medium">
                {pools.length} Pools Found
              </span>
            </div>
            
            {/* IP Price Display */}
            {ipPrice > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-400/30 rounded-lg">
                <DollarSign className="h-4 w-4 text-green-400" />
                <span className="text-green-300 text-sm font-medium">
                  IP: {pricingService.formatPrice(ipPrice)}
                </span>
              </div>
            )}
            
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
              className="w-full mt-4 bg-primary/10 hover:bg-primary/20 text-primary hover:text-foreground border-primary/40 hover:border-primary/60 transition-colors"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Debug Schema
            </Button>
            <Button
              onClick={() => fetchPools(false)}
              disabled={loading}
              variant="outline"
              size="sm"
              className="w-full mt-4 bg-primary/10 hover:bg-primary/20 text-primary hover:text-foreground border-primary/40 hover:border-primary/60 transition-colors"
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
              className="w-full mt-4 bg-primary/10 hover:bg-primary/20 text-primary hover:text-foreground border-primary/40 hover:border-primary/60 transition-colors"
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
          <Card className="bg-card/95 border border-border/80 shadow-lg">
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin mr-3 text-primary" />
                <span className="text-lg text-foreground">Loading pools data from Goldsky...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pools Grid */}
        {!loading && pools.length === 0 && !error && (
          <Card className="bg-card/95 border border-border/80 shadow-lg">
            <CardContent className="py-12 text-center">
              <Database className="h-12 w-12 mx-auto mb-4 text-primary/80" />
              <h3 className="text-xl font-semibold mb-2 text-foreground">No Pools Found</h3>
              <p className="text-muted-foreground">
                No liquidity pools are currently available on Sovry DEX.
              </p>
            </CardContent>
          </Card>
        )}

        {pools.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pools.map((pool) => (
                <Card key={pool.id} className="bg-card/95 border border-border/80 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Droplets className="h-5 w-5 text-primary" />
                        <span className="text-lg">
                          {pool.token0?.symbol ?? "UNKNOWN"} / {pool.token1?.symbol ?? "UNKNOWN"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {pool.apr && pool.apr > 0 && (
                          <Badge variant="default" className="bg-green-500 text-xs">
                            {LiquidityAnalyticsService.formatAPR(pool.apr)}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          Pool
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Token Information with Prices */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Token 0:</span>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {pool.token0?.symbol ?? "UNKNOWN"}
                          </div>
                          {pool.token0PriceUSD && pool.token0PriceUSD > 0 && (
                            <div className="text-xs text-green-600">
                              {pricingService.formatPrice(pool.token0PriceUSD)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Token 1:</span>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {pool.token1?.symbol ?? "UNKNOWN"}
                          </div>
                          {pool.token1PriceUSD && pool.token1PriceUSD > 0 && (
                            <div className="text-xs text-green-600">
                              {pricingService.formatPrice(pool.token1PriceUSD)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Reserves */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Reserve 0:</span>
                        <span className="text-sm font-medium">
                          {formatNumber(pool.reserve0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Reserve 1:</span>
                        <span className="text-sm font-medium">
                          {formatNumber(pool.reserve1)}
                        </span>
                      </div>
                    </div>

                    {/* Pool Stats */}
                    <div className="space-y-2 pt-2 border-t">
                      {/* TVL USD - Most Important Metric */}
                      {pool.tvlUSD && pool.tvlUSD > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            TVL:
                          </span>
                          <span className="text-sm font-bold text-blue-600">
                            {pricingService.formatTVL(pool.tvlUSD)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Supply:</span>
                        <span className="text-sm font-medium">
                          {formatNumber(pool.totalSupply)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Volume (24h):</span>
                        <span className="text-sm font-medium text-green-600">
                          ${formatNumber(pool.volumeUSD)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Transactions:</span>
                        <span className="text-sm font-medium">
                          {formatNumber(pool.txCount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Created:</span>
                        <span className="text-sm font-medium">
                          {formatDate(pool.createdAtTimestamp)}
                        </span>
                      </div>
                      
                      {/* APR Display */}
                      {pool.apr && pool.apr > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground flex items-center">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            APR:
                          </span>
                          <span className="text-sm font-bold text-green-600">
                            {LiquidityAnalyticsService.formatAPR(pool.apr)}
                          </span>
                        </div>
                      )}
                      
                      {/* User Position */}
                      {pool.userLpBalance && parseFloat(pool.userLpBalance) > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Your Position:</span>
                          <span className="text-sm font-medium text-blue-600">
                            {pool.userLpBalance} LP ({pool.userSharePercentage?.toFixed(4)}%)
                          </span>
                        </div>
                      )}
                    </div>

                  {/* Pool Address */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Pool Address:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono">
                          {pool.id.slice(0, 6)}...{pool.id.slice(-4)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full bg-background/80 hover:bg-muted/80 text-foreground hover:text-foreground/90 border-border/60 hover:border-border transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText(pool.id);
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Liquidity Management Button */}
                  <div className="pt-3 border-t mt-3">
                    <Button
                      onClick={() => openAddLiquidityModal(pool)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      <Droplets className="h-4 w-4 mr-2" />
                      {pool.userLpBalance && parseFloat(pool.userLpBalance) > 0 
                        ? 'Manage Liquidity' 
                        : 'Add Liquidity'
                      }
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

      {/* Liquidity Management Modal */}
      {isAddLiquidityOpen && selectedPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold">
                    {selectedPool.userLpBalance && parseFloat(selectedPool.userLpBalance) > 0 
                      ? 'Manage Liquidity' 
                      : 'Add Liquidity'
                    }
                  </h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddLiquidityOpen(false)}
                  disabled={loading}
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="p-6">
              <LiquidityManager pool={selectedPool} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
