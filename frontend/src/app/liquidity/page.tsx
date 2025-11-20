"use client";

import { useState, useEffect } from "react";
import { useDynamicContext, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { ethers } from "ethers";
import { Navigation } from "@/components/navigation/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Wallet, AlertCircle, CheckCircle, Crown, TrendingUp, ExternalLink, Unlock, Coins, Droplets, Database, ArrowUpDown, Percent } from "lucide-react";
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
import {
  registerIPAsset,
  claimRevenue,
  mintLicenseToken,
  transferRoyaltyTokensFromIP,
  createSampleIPMetadata,
  createSampleNFTMetadata,
  IPMetadata,
  NFTMetadata,
  RegistrationResult
} from "@/services/storyProtocolRegistration";
import { liquidityService } from "@/services/liquidityService";

// Sovry Router Address for UI display
const SOVRY_ROUTER_ADDRESS = '0x67f00093dEA379B14bE70ef3B12b478107c97349';

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
  userLpBalance?: string;
  userLpPercentage?: number;
  tvlUSD?: number;
  userTVL?: number;
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
  const [claimingRevenue, setClaimingRevenue] = useState<string | null>(null);
  const [registeringIP, setRegisteringIP] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [ipTitle, setIpTitle] = useState("");
  const [ipDescription, setIpDescription] = useState("");
  const [ipImageUrl, setIpImageUrl] = useState("");
  
  // User pools state
  const [userPools, setUserPools] = useState<UserPool[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(false);
  const [poolsError, setPoolsError] = useState<string | null>(null);

  // Add/Remove liquidity state for existing pools
  const [selectedPoolForLiquidity, setSelectedPoolForLiquidity] = useState<UserPool | null>(null);
  const [liquidityMode, setLiquidityMode] = useState<"add" | "remove">("add");
  const [liquidityAmount0, setLiquidityAmount0] = useState("");
  const [liquidityAmount1, setLiquidityAmount1] = useState("");
  const [liquidityPercentage, setLiquidityPercentage] = useState(0);
  const [isLiquidityProcessing, setIsLiquidityProcessing] = useState(false);
  const [liquidityError, setLiquidityError] = useState("");
  const [liquiditySuccess, setLiquiditySuccess] = useState("");

  // Get wallet address from Dynamic
  const walletAddress = primaryWallet?.address;

  // Fetch user pools with fallback to existing data
  const fetchUserPools = async () => {
    console.log("🔍 fetchUserPools called, walletAddress:", walletAddress);
    if (!walletAddress) {
      console.log("⚠️ No wallet address - cannot fetch pools");
      return;
    }

    try {
      setPoolsLoading(true);
      setPoolsError(null);

      console.log("🏊 Fetching user pools...");
      
      // Fetch real user positions from backend API
      console.log("📡 Fetching real user positions from backend...");
      const response = await fetch(`http://localhost:3001/api/liquidity/positions/${walletAddress}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const userPositions = await response.json();
      console.log("✅ Real API response received:", userPositions);
      console.log("📊 Positions count:", userPositions.positions?.positions?.length || 0);

      if (userPositions.positions && userPositions.positions.positions.length > 0) {
        console.log("🎯 Mapping positions to UI format...");
        // Map REAL positions from Goldsky to UserPool format
        const mappedPools = userPositions.positions.positions.map((position: any) => {
          const token0Address = position.token0?.id?.toLowerCase();
          const token1Address = position.token1?.id?.toLowerCase();
          
          const token0Info = TOKEN_MAPPING[token0Address] || {
            symbol: position.token0?.symbol || "UNKNOWN",
            name: position.token0?.name || "Unknown Token"
          };
          
          const token1Info = TOKEN_MAPPING[token1Address] || {
            symbol: position.token1?.symbol || "UNKNOWN", 
            name: position.token1?.name || "Unknown Token"
          };
          
          return {
            id: position.poolAddress || position.id || "",
            token0: {
              id: position.token0?.id || "",
              symbol: token0Info.symbol,
              name: token0Info.name
            },
            token1: {
              id: position.token1?.id || "",
              symbol: token1Info.symbol,
              name: token1Info.name
            },
            userLpBalance: ethers.formatEther(position.liquidity || "0"), // Convert from wei
            userLpPercentage: position.poolOwnership ? parseFloat(position.poolOwnership) * 100 : 0,
            reserve0: position.reserve0 || "0",
            reserve1: position.reserve1 || "0",
            totalSupply: position.totalSupply || "1",
            volumeUSD: position.volumeUSD || "0",
            txCount: "0",
            createdAtTimestamp: Math.floor(Date.now() / 1000).toString(),
            tvlUSD: position.valueUSD || 0,
            userTVL: position.valueUSD || 0
          };
        });

        console.log("✅ REAL Goldsky user pools mapped:", mappedPools);
        console.log("📊 Setting user pools with", mappedPools.length, "pools");
        setUserPools(mappedPools);
        return;
      }

      // No positions found in Goldsky
      console.log("📭 No liquidity positions found in Goldsky");
      console.log("🔍 Setting empty user pools array");
      setUserPools([]);
      
    } catch (err) {
      console.error("❌ Error fetching user pools:", err);
      setPoolsError("Failed to fetch liquidity positions from Goldsky");
      setUserPools([]); // No fallback - use REAL data only
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
          const assets = await fetchWalletIPAssets(walletAddress, primaryWallet);
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
    if (!walletAddress || !primaryWallet) return;
    
    setUnlockingTokens(ipAsset.ipId);
    setError(null);
    setSuccess(null);

    try {
      // Flow sesuai Story Protocol docs:
      // 1. Mint license token (triggers royalty vault deployment)
      // 2. Transfer royalty tokens dari IP Account ke user wallet
      
      console.log('📜 Step 1: Minting license token to trigger royalty vault...');
      
      // Coba beberapa license terms ID yang mungkin ada
      const licenseTermsIds = ["1", "2", "3", "10", "100"];
      let licenseResult = { success: false };
      
      for (const termsId of licenseTermsIds) {
        try {
          console.log(`🔄 Trying license terms ID: ${termsId}`);
          licenseResult = await mintLicenseToken(ipAsset.ipId, termsId, primaryWallet);
          
          if (licenseResult.success) {
            console.log(`✅ License token minted with terms ID: ${termsId}`);
            break;
          }
        } catch (termsError) {
          console.log(`❌ License terms ID ${termsId} failed:`, termsError instanceof Error ? termsError.message : 'Unknown error');
          continue;
        }
      }
      
      if (!licenseResult.success) {
        throw new Error('Failed to mint license token with any license terms ID');
      }
      
      setSuccess(`License token minted successfully! Transaction: ${licenseResult.txHash}`);
      
      // Wait untuk royalty vault deployment
      console.log('⏳ Waiting for royalty vault deployment...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Step 2: Transfer royalty tokens dari IP Account ke user wallet
      console.log('🔄 Step 2: Transferring royalty tokens from IP Account to your wallet...');
      
      const transferResult = await transferRoyaltyTokensFromIP(ipAsset.ipId, primaryWallet);
      
      if (transferResult.success) {
        setSuccess(prev => prev + `\n✅ Royalty tokens transferred to your wallet! Transaction: ${transferResult.txHash}`);
        
        // Wait lebih lama untuk transfer processing
        console.log('⏳ Waiting for tokens to appear in your wallet...');
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
        // Check token balance multiple times
        console.log('🔍 Checking your royalty token balance...');
        let balance = await getTokenBalance(walletAddress, ipAsset.royaltyVaultAddress);
        
        if (balance && parseFloat(balance.formattedBalance) > 0) {
          setTokenBalances(prev => ({
            ...prev,
            [ipAsset.ipId]: balance
          }));
          setSuccess(prev => prev + `\n💰 Your royalty token balance: ${balance.formattedBalance} ${balance.symbol}`);
          
          // Auto-claim all available revenue!
          console.log('💰 Auto-claiming all available revenue...');
          try {
            const claimResult = await claimRevenue(ipAsset.ipId, primaryWallet);
            if (claimResult.success) {
              setSuccess(prev => prev + `\n✅ All revenue claimed successfully! Transaction: ${claimResult.txHash}`);
            } else {
              setSuccess(prev => prev + `\n⚠️ Revenue claim failed: ${claimResult.error}`);
            }
          } catch (claimError) {
            console.log('Revenue claim error:', claimError);
            setSuccess(prev => prev + `\n⚠️ Could not auto-claim revenue: ${claimError instanceof Error ? claimError.message : 'Unknown error'}`);
          }
        } else {
          // Try again after 5 more seconds
          console.log('🔄 Balance still 0, trying again...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          balance = await getTokenBalance(walletAddress, ipAsset.royaltyVaultAddress);
          
          if (balance && parseFloat(balance.formattedBalance) > 0) {
            setTokenBalances(prev => ({
              ...prev,
              [ipAsset.ipId]: balance
            }));
            setSuccess(prev => prev + `\n💰 Your royalty token balance: ${balance.formattedBalance} ${balance.symbol}`);
            
            // Auto-claim all available revenue!
            console.log('💰 Auto-claiming all available revenue...');
            try {
              const claimResult = await claimRevenue(ipAsset.ipId, primaryWallet);
              if (claimResult.success) {
                setSuccess(prev => prev + `\n✅ All revenue claimed successfully! Transaction: ${claimResult.txHash}`);
              } else {
                setSuccess(prev => prev + `\n⚠️ Revenue claim failed: ${claimResult.error}`);
              }
            } catch (claimError) {
              console.log('Revenue claim error:', claimError);
              setSuccess(prev => prev + `\n⚠️ Could not auto-claim revenue: ${claimError instanceof Error ? claimError.message : 'Unknown error'}`);
            }
          } else {
            setSuccess(prev => prev + `\n⚠️ Tokens transferred but balance is still showing 0. 

This could mean:
• The tokens need more time to process (try refreshing)
• The token decimals are very small (check wallet directly)
• The transfer is still pending on the network

Transaction: ${transferResult.txHash}
Token Address: ${ipAsset.royaltyVaultAddress}

Try checking your wallet directly or refresh the page!`);
          }
        }
        
      } else {
        setSuccess(prev => prev + `\n⚠️ License minted but token transfer failed: ${transferResult.error}`);
      }
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to get royalty tokens');
    } finally {
      setUnlockingTokens(null);
    }
  };

  const handleClaimRevenue = async (ipAsset: IPAsset) => {
    if (!walletAddress || !primaryWallet) return;
    
    setClaimingRevenue(ipAsset.ipId);
    setError(null);
    setSuccess(null);

    try {
      console.log('💰 Claiming all revenue for IP:', ipAsset.ipId);
      
      const claimResult = await claimRevenue(ipAsset.ipId, primaryWallet);
      
      if (claimResult.success) {
        setSuccess(`All revenue claimed successfully! Transaction: ${claimResult.txHash}`);
        
        // Refresh token balance after claiming
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const balance = await getTokenBalance(walletAddress, ipAsset.royaltyVaultAddress);
        if (balance) {
          setTokenBalances(prev => ({
            ...prev,
            [ipAsset.ipId]: balance
          }));
          setSuccess(prev => prev + `\n💰 Updated balance: ${balance.formattedBalance} ${balance.symbol}`);
        }
      } else {
        setError(`Failed to claim revenue: ${claimResult.error}`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to claim revenue');
    } finally {
      setClaimingRevenue(null);
    }
  };

  const handleRegisterIPAsset = async () => {
    if (!walletAddress || !primaryWallet) {
      setError('Please connect your wallet first');
      return;
    }

    if (!ipTitle || !ipDescription || !ipImageUrl) {
      setError('Please fill in all IP asset fields');
      return;
    }

    setRegisteringIP(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🚀 Registering new IP Asset...');

      // Create IP metadata
      const ipMetadata = createSampleIPMetadata(
        ipTitle,
        ipDescription,
        ipImageUrl,
        walletAddress,
        'IP Creator'
      );

      // Create NFT metadata
      const nftMetadata = createSampleNFTMetadata(
        `${ipTitle} Ownership NFT`,
        `Ownership NFT for ${ipTitle}`,
        ipImageUrl
      );

      // Register IP Asset
      const result = await registerIPAsset(ipMetadata, nftMetadata, primaryWallet);

      if (result.success) {
        setSuccess(`IP Asset registered successfully!
          IP ID: ${result.ipId}
          Transaction: ${result.txHash}
          Royalty Vault: ${result.royaltyVaultAddress?.slice(0, 10)}...
          
          Your IP Asset is now ready for liquidity pool creation!`);

        // Reset form
        setIpTitle('');
        setIpDescription('');
        setIpImageUrl('');
        setShowRegistrationForm(false);

        // Refresh IP assets list
        const assets = await fetchWalletIPAssets(walletAddress, primaryWallet);
        setIpAssets(assets);

      } else {
        setError(result.error || 'Failed to register IP Asset');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to register IP Asset');
    } finally {
      setRegisteringIP(false);
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

  // Handle add liquidity to existing pool
  const handleAddLiquidityToPool = async () => {
    if (!isLoggedIn || !primaryWallet || !selectedPoolForLiquidity) {
      setLiquidityError("Please connect your wallet and select a pool");
      return;
    }

    if (!liquidityAmount0 || !liquidityAmount1 || parseFloat(liquidityAmount0) <= 0 || parseFloat(liquidityAmount1) <= 0) {
      setLiquidityError("Please enter valid amounts");
      return;
    }

    setIsLiquidityProcessing(true);
    setLiquidityError("");
    setLiquiditySuccess("");

    try {
      const userAddress = primaryWallet.address;
      
      // Get real token balances
      const [token0Balance, token1Balance] = await Promise.all([
        liquidityService.getTokenBalance(selectedPoolForLiquidity.token0.id, userAddress),
        liquidityService.getTokenBalance(selectedPoolForLiquidity.token1.id, userAddress)
      ]);

      // Check balances
      if (parseFloat(liquidityAmount0) > parseFloat(token0Balance.formattedBalance)) {
        throw new Error(`Insufficient ${selectedPoolForLiquidity.token0.symbol} balance`);
      }

      if (parseFloat(liquidityAmount1) > parseFloat(token1Balance.formattedBalance)) {
        throw new Error(`Insufficient ${selectedPoolForLiquidity.token1.symbol} balance`);
      }

      // Prepare add liquidity
      const result = await liquidityService.prepareAddLiquidity(
        selectedPoolForLiquidity.token0.id,
        selectedPoolForLiquidity.token1.id,
        liquidityAmount0,
        liquidityAmount1,
        userAddress,
        0.5
      );

      // Execute transaction using Dynamic wallet client
      const walletClient = await primaryWallet.getWalletClient();
      const txResponse = await walletClient.sendTransaction({
        to: result.transaction.to,
        data: result.transaction.data,
        value: result.transaction.value,
        gasLimit: result.transaction.gasLimit
      });

      console.log('✅ Liquidity added to existing pool:', txResponse);
      setLiquiditySuccess('Liquidity added successfully!');
      
      // Refresh pools data
      await fetchUserPools();
      
      // Reset form
      setLiquidityAmount0("");
      setLiquidityAmount1("");
      setSelectedPoolForLiquidity(null);

    } catch (err: any) {
      console.error("Add liquidity to pool failed:", err);
      setLiquidityError(err.message || "Failed to add liquidity");
    } finally {
      setIsLiquidityProcessing(false);
    }
  };

  // Handle remove liquidity from existing pool
  const handleRemoveLiquidityFromPool = async () => {
    if (!isLoggedIn || !primaryWallet || !selectedPoolForLiquidity) {
      setLiquidityError("Please connect your wallet and select a pool");
      return;
    }

    if (!liquidityAmount0 || parseFloat(liquidityAmount0) <= 0) {
      setLiquidityError("Please enter LP amount to remove");
      return;
    }

    setIsLiquidityProcessing(true);
    setLiquidityError("");
    setLiquiditySuccess("");

    try {
      const userAddress = primaryWallet.address;
      
      // Check user LP balance
      const userLPBalance = parseFloat(selectedPoolForLiquidity.userLpBalance || "0");
      if (parseFloat(liquidityAmount0) > userLPBalance) {
        throw new Error(`Insufficient LP tokens. You have ${userLPBalance} LP tokens`);
      }

      // Step 1: Check and approve LP tokens if needed
      console.log('🔍 Checking LP token allowance...');
      const approveResult = await liquidityService.approveLiquidityTokens(
        selectedPoolForLiquidity.token0.id,
        selectedPoolForLiquidity.token1.id,
        userAddress
      );

      if (!approveResult.approved) {
        console.log('📝 Approving LP tokens...');
        // Execute approve transaction
        const walletClient = await primaryWallet.getWalletClient();
        const approveTx = await walletClient.sendTransaction({
          to: approveResult.to,
          data: approveResult.data,
          value: approveResult.value,
          gasLimit: approveResult.gasLimit
        });
        
        console.log('✅ LP tokens approved:', approveTx);
        setLiquiditySuccess('LP tokens approved! Proceeding with remove liquidity...');
        
        // Wait a moment for approval to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Step 2: Prepare remove liquidity
      console.log('🔍 Preparing remove liquidity transaction...');
      const result = await liquidityService.prepareRemoveLiquidity(
        selectedPoolForLiquidity.token0.id,
        selectedPoolForLiquidity.token1.id,
        liquidityAmount0,
        userAddress,
        0.5
      );

      // Step 3: Execute remove liquidity transaction
      console.log('📝 Executing remove liquidity transaction...');
      const walletClient = await primaryWallet.getWalletClient();
      const txResponse = await walletClient.sendTransaction({
        to: result.transaction.to,
        data: result.transaction.data,
        value: result.transaction.value,
        gasLimit: result.transaction.gasLimit
      });

      console.log('✅ Liquidity removed from pool:', txResponse);
      setLiquiditySuccess('Liquidity removed successfully!');
      
      // Refresh pools data
      await fetchUserPools();
      
      // Reset form
      setLiquidityAmount0("");
      setLiquidityAmount1("");
      setSelectedPoolForLiquidity(null);

    } catch (err: any) {
      console.error("Remove liquidity from pool failed:", err);
      setLiquidityError(err.message || "Failed to remove liquidity");
    } finally {
      setIsLiquidityProcessing(false);
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

  // Format numbers for display
  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    if (num < 0.01 && num > 0) return num.toExponential(2); // Show very small numbers in scientific notation
    if (num < 1) return num.toFixed(6); // Show more decimals for small numbers
    return num.toFixed(2);
  };

  // Format timestamp
  const formatDate = (timestamp: string) => {
    return new Date(parseInt(timestamp) * 1000).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-purple-900 to-gray-900">
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #3b82f6;
          cursor: pointer;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #3b82f6;
          cursor: pointer;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
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
                          You need to get royalty tokens before creating a liquidity pool. This will create a license and transfer tokens to your wallet.
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
                            <Coins className="mr-2 h-4 w-4" />
                            Get Royalty Tokens
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
                <div className="space-y-6">
                  {/* Pool Cards with Add/Remove Liquidity */}
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
                              <span className="text-xs text-gray-600">Your LP Balance:</span>
                              <span className="text-xs font-medium text-blue-600">
                                {pool.userLpBalance || "0"} LP
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600">Your Share:</span>
                              <span className="text-xs font-medium text-purple-600">
                                {pool.userLpPercentage?.toFixed(2) || "0.00"}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600">Created:</span>
                              <span className="text-xs font-medium">
                                {formatDate(pool.createdAtTimestamp)}
                              </span>
                            </div>
                          </div>

                          {/* Add/Remove Liquidity Buttons */}
                          <div className="pt-2 border-t space-y-2">
                            <Button
                              onClick={() => {
                                setSelectedPoolForLiquidity(pool);
                                setLiquidityMode("add");
                                setLiquidityError("");
                                setLiquiditySuccess("");
                                setLiquidityPercentage(0);
                                setLiquidityAmount0("");
                                setLiquidityAmount1("");
                              }}
                              size="sm"
                              className="w-full"
                              variant="outline"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Liquidity
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedPoolForLiquidity(pool);
                                setLiquidityMode("remove");
                                setLiquidityError("");
                                setLiquiditySuccess("");
                                setLiquidityPercentage(0);
                                setLiquidityAmount0("");
                                setLiquidityAmount1("");
                              }}
                              size="sm"
                              className="w-full"
                              variant="outline"
                            >
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Remove Liquidity
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Add/Remove Liquidity Modal */}
                  {selectedPoolForLiquidity && (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            {liquidityMode === "add" ? <Plus className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                            {liquidityMode === "add" ? "Add" : "Remove"} Liquidity
                          </span>
                          <Button
                            onClick={() => setSelectedPoolForLiquidity(null)}
                            size="sm"
                            variant="ghost"
                          >
                            ✕
                          </Button>
                        </CardTitle>
                        <p className="text-sm text-blue-800">
                          {selectedPoolForLiquidity.token0?.symbol} / {selectedPoolForLiquidity.token1?.symbol} Pool
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Liquidity Error/Success */}
                        {liquidityError && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{liquidityError}</AlertDescription>
                          </Alert>
                        )}

                        {liquiditySuccess && (
                          <Alert className="bg-green-50 border-green-200">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">{liquiditySuccess}</AlertDescription>
                          </Alert>
                        )}

                        {liquidityMode === "add" ? (
                          <>
                            {/* Add Liquidity Form with Slider */}
                            <div className="space-y-4">
                              <div>
                                <Label className="flex items-center gap-2 mb-2">
                                  <Percent className="h-4 w-4" />
                                  Amount Percentage
                                </Label>
                                <div className="flex items-center gap-4">
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={liquidityPercentage}
                                    onChange={(e) => {
                                      const percentage = parseInt(e.target.value);
                                      setLiquidityPercentage(percentage);
                                      // Auto-calculate amounts based on percentage
                                      const maxAmount0 = 0.000000001; // Max WIP based on user's real balance
                                      const maxAmount1 = 100; // Max RT based on user's real balance
                                      setLiquidityAmount0((maxAmount0 * percentage / 100).toString());
                                      setLiquidityAmount1((maxAmount1 * percentage / 100).toString());
                                    }}
                                    className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer slider"
                                  />
                                  <div className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-lg min-w-[80px]">
                                    <span className="text-sm font-medium text-blue-800">{liquidityPercentage}%</span>
                                  </div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                  <span>0%</span>
                                  <span>25%</span>
                                  <span>50%</span>
                                  <span>75%</span>
                                  <span>100%</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>{selectedPoolForLiquidity.token0?.symbol} Amount</Label>
                                  <Input
                                    type="number"
                                    placeholder="0.0"
                                    value={liquidityAmount0}
                                    onChange={(e) => {
                                      setLiquidityAmount0(e.target.value);
                                      // Update percentage based on manual input
                                      const maxAmount0 = 0.000000001; // Max WIP based on user's real balance
                                      const percentage = Math.min(100, Math.round((parseFloat(e.target.value) || 0) / maxAmount0 * 100));
                                      setLiquidityPercentage(percentage);
                                    }}
                                  />
                                  <p className="text-xs text-gray-500 mt-1">Max: 0.000000001</p>
                                </div>
                                <div>
                                  <Label>{selectedPoolForLiquidity.token1?.symbol} Amount</Label>
                                  <Input
                                    type="number"
                                    placeholder="0.0"
                                    value={liquidityAmount1}
                                    onChange={(e) => {
                                      setLiquidityAmount1(e.target.value);
                                      // Update percentage based on manual input
                                      const maxAmount1 = 100; // Max RT based on user's real balance
                                      const percentage = Math.min(100, Math.round((parseFloat(e.target.value) || 0) / maxAmount1 * 100));
                                      setLiquidityPercentage(percentage);
                                    }}
                                  />
                                  <p className="text-xs text-gray-500 mt-1">Max: 100</p>
                                </div>
                              </div>

                              {/* Quick Percentage Buttons */}
                              <div className="flex gap-2">
                                {[25, 50, 75, 100].map((percent) => (
                                  <Button
                                    key={percent}
                                    variant={liquidityPercentage === percent ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                      setLiquidityPercentage(percent);
                                      setLiquidityAmount0((0.000000001 * percent / 100).toString());
                                      setLiquidityAmount1((100 * percent / 100).toString());
                                    }}
                                    className="flex-1"
                                  >
                                    {percent}%
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <Button
                              onClick={handleAddLiquidityToPool}
                              disabled={isLiquidityProcessing || liquidityPercentage === 0}
                              className="w-full"
                            >
                              {isLiquidityProcessing ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Adding Liquidity...
                                </>
                              ) : (
                                `Add ${liquidityPercentage}% Liquidity`
                              )}
                            </Button>
                          </>
                        ) : (
                          <>
                            {/* Remove Liquidity Form with Slider */}
                            <div className="space-y-4">
                              <div>
                                <Label className="flex items-center gap-2 mb-2">
                                  <Percent className="h-4 w-4" />
                                  LP Token Percentage
                                </Label>
                                <div className="flex items-center gap-4">
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={liquidityPercentage}
                                    onChange={(e) => {
                                      const percentage = parseInt(e.target.value);
                                      setLiquidityPercentage(percentage);
                                      // Auto-calculate LP amount based on percentage
                                      const maxLP = parseFloat(selectedPoolForLiquidity.userLpBalance || "0");
                                      setLiquidityAmount0((maxLP * percentage / 100).toString());
                                    }}
                                    className="flex-1 h-2 bg-red-200 rounded-lg appearance-none cursor-pointer slider"
                                  />
                                  <div className="flex items-center gap-2 bg-red-100 px-3 py-1 rounded-lg min-w-[80px]">
                                    <span className="text-sm font-medium text-red-800">{liquidityPercentage}%</span>
                                  </div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                  <span>0%</span>
                                  <span>25%</span>
                                  <span>50%</span>
                                  <span>75%</span>
                                  <span>100%</span>
                                </div>
                              </div>

                              <div>
                                <Label>LP Token Amount</Label>
                                <Input
                                  type="number"
                                  placeholder="0.0"
                                  value={liquidityAmount0}
                                  onChange={(e) => {
                                    setLiquidityAmount0(e.target.value);
                                    // Update percentage based on manual input
                                    const maxLP = parseFloat(selectedPoolForLiquidity.userLpBalance || "0");
                                    const percentage = Math.min(100, Math.round((parseFloat(e.target.value) || 0) / maxLP * 100));
                                    setLiquidityPercentage(percentage);
                                  }}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Available: {selectedPoolForLiquidity.userLpBalance || "0"} LP tokens
                                </p>
                              </div>

                              {/* Quick Percentage Buttons */}
                              <div className="flex gap-2">
                                {[25, 50, 75, 100].map((percent) => (
                                  <Button
                                    key={percent}
                                    variant={liquidityPercentage === percent ? "destructive" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                      setLiquidityPercentage(percent);
                                      const maxLP = parseFloat(selectedPoolForLiquidity.userLpBalance || "0");
                                      setLiquidityAmount0((maxLP * percent / 100).toString());
                                    }}
                                    className="flex-1"
                                  >
                                    {percent}%
                                  </Button>
                                ))}
                              </div>

                              {/* Estimated Returns */}
                              {liquidityPercentage > 0 && (
                                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                  <p className="text-sm font-medium text-orange-800 mb-1">Estimated Returns:</p>
                                  <div className="text-xs text-orange-700 space-y-1">
                                    <p>WIP: {(parseFloat(selectedPoolForLiquidity.reserve0 || "0") * liquidityPercentage / 100).toFixed(2)}</p>
                                    <p>RT: {(parseFloat(selectedPoolForLiquidity.reserve1 || "0") * liquidityPercentage / 100).toFixed(2)}</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            <Button
                              onClick={handleRemoveLiquidityFromPool}
                              disabled={isLiquidityProcessing || liquidityPercentage === 0}
                              className="w-full"
                              variant="destructive"
                            >
                              {isLiquidityProcessing ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Removing Liquidity...
                                </>
                              ) : (
                                `Remove ${liquidityPercentage}% Liquidity`
                              )}
                            </Button>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
