"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Wallet,
  AlertCircle,
  Sparkles,
  Coins,
  TrendingUp,
  ArrowRight,
  ExternalLink,
  Crown,
  CheckCircle,
  Search,
  PlusCircle,
  Rocket,
} from "lucide-react";
import { useLaunches } from "@/hooks/useLaunches";
import { LaunchCard } from "@/components/LaunchCard";
import { formatMarketCap } from "@/lib/utils";
import { CategoryPills } from "@/components/marketplace/CategoryPills";
import { CompactIPCard } from "@/components/marketplace/CompactIPCard";
import { TransactionNotificationsContainer } from "@/components/notifications/TransactionNotification";
import Link from "next/link";
import {
  fetchWalletIPAssets,
  IPAsset,
  getTokenBalance,
  TokenBalance,
  SOVRY_LAUNCHPAD_ADDRESS,
} from "@/services/storyProtocolService";
import { launchpadService } from "@/services/launchpadService";
import {
  claimRevenue,
  mintLicenseToken,
  transferRoyaltyTokensFromIP,
} from "@/services/storyProtocolRegistration";
import { pinFileToIPFS, pinJSONToIPFS } from "@/services/pinataService";
import { supabase } from "@/lib/supabaseClient";

const CATEGORIES = [
  "All",
  "Meme",
  "AI Agent",
  "Gaming",
  "Music",
  "Art",
] as const;

type Category = (typeof CATEGORIES)[number];

export default function CreatePage() {
  const { primaryWallet } = useDynamicContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isConnected = !!primaryWallet;
  const walletAddress = primaryWallet?.address;

  const [ipAssets, setIpAssets] = useState<IPAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingPool, setCreatingPool] = useState<string | null>(null);
  const [launchStep, setLaunchStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedIP, setSelectedIP] = useState<string>("");
  const [tokenBalances, setTokenBalances] = useState<Record<string, TokenBalance>>({});
  const [unlockingTokens, setUnlockingTokens] = useState<string | null>(null);
  const [claimingRevenue, setClaimingRevenue] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbolLaunch, setTokenSymbolLaunch] = useState("");
  const [launchImageUrl, setLaunchImageUrl] = useState("");
  const [launchDescription, setLaunchDescription] = useState("");
  const [launchPercentage, setLaunchPercentage] = useState<number>(100);
  const [launchLogoFile, setLaunchLogoFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch trending launches
  const { launches: trendingLaunches, loading: trendingLoading } = useLaunches(5);

  // Transaction notifications state
  const [transactionNotifications, setTransactionNotifications] = useState<
    Array<{
      id: string;
      address: string;
      amount: string;
      token: string;
      isBuy: boolean;
    }>
  >([]);

  // Generate filler IP assets using NFT images - using stable IDs to prevent hydration errors
  const generateFillerIPAssets = useCallback((): IPAsset[] => {
    const fillerData = [
      {
        name: "Creepz Collection",
        description: "A unique collection of digital creatures with distinctive traits and personalities. Each Creepz is a one-of-a-kind NFT with its own story.",
        imageUrl: "/nft-images/Creep.png",
        category: "Art",
      },
      {
        name: "Cold Blooded Creepz",
        description: "Premium NFT collection featuring rare and exclusive Creepz characters. Part of the larger Creepz ecosystem.",
        imageUrl: "/nft-images/Creepz_04052022_Instagram @coldbloodedcreepz_nft.webp",
        category: "Art",
      },
      {
        name: "Meme Creators",
        description: "Celebrating the creators behind viral memes. This collection honors the artists and innovators of internet culture.",
        imageUrl: "/nft-images/NFT-creators-money-meme.jpg",
        category: "Meme",
      },
      {
        name: "Digital Art Masterpiece",
        description: "A stunning piece of digital art showcasing modern artistic expression through blockchain technology.",
        imageUrl: "/nft-images/0_1WJiB8mUJKcylomi.jpg",
        category: "Art",
      },
      {
        name: "Gaming Universe",
        description: "Immersive gaming experience tokenized as an IP asset. Represents characters, worlds, and gameplay mechanics.",
        imageUrl: "/nft-images/65217fd9e31608b8b6814492_-9ojwcB1tqVmdclia_Sx-oevPA3tjR3E4Y4Qtywk7fp90800zZijuZNz7dsIGPdmsNlpnfq3l1ayZSh1qWraCQqpIuIcNpEuRBg9tW96irdFURf6DDqWgjZ2EKAbqng6wgyhmrxb5fPt20yMRrWwpcg.png",
        category: "Gaming",
      },
      {
        name: "Anime Collection",
        description: "Premium anime-inspired NFT collection featuring iconic characters and original designs.",
        imageUrl: "/nft-images/FIJfBF6WUAINAAk.jpg",
        category: "Art",
      },
      {
        name: "Abstract Digital",
        description: "Abstract digital art collection exploring the boundaries between reality and digital expression.",
        imageUrl: "/nft-images/809E1643-B14A-4377-8A71-A17DB8C014C8.png",
        category: "Art",
      },
      {
        name: "3D Art Collection",
        description: "Three-dimensional digital art pieces showcasing advanced rendering techniques and creative vision.",
        imageUrl: "/nft-images/045A39D6-3381-473C-A1F1-FD9AE6408087.png",
        category: "Art",
      },
      {
        name: "Futuristic Design",
        description: "Cutting-edge design collection featuring futuristic aesthetics and innovative visual concepts.",
        imageUrl: "/nft-images/84CBC8C0-A37C-4F2F-A051-EBB94EC0B4F7.png",
        category: "Art",
      },
      {
        name: "Modern Art Piece",
        description: "Contemporary art piece representing the evolution of digital art in the blockchain era.",
        imageUrl: "/nft-images/D2945BEF-550C-481F-95FD-F645D1B4BAB6.png",
        category: "Art",
      },
    ];

    // Use deterministic IDs based on index to prevent hydration mismatches
    // Generate stable hex strings from index
    const generateStableId = (index: number, prefix: string) => {
      // Create a deterministic hex string from index
      const hex = index.toString(16).padStart(40, '0');
      return `${prefix}${hex}`;
    };

    return fillerData.map((data, index) => ({
      ipId: generateStableId(index, "0x"),
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl,
      owner: walletAddress || "0x0000000000000000000000000000000000000000",
      royaltyVaultAddress: generateStableId(index + 1000, "0x"), // Different prefix to avoid collisions
      hasRoyaltyTokens: index % 3 !== 0, // Some have tokens, some don't
      createdAt: new Date(Date.now() - index * 86400000).toISOString(), // Staggered dates
    }));
  }, [walletAddress]);

  // State for filler assets to ensure they're only generated on client
  const [fillerIPAssets, setFillerIPAssets] = useState<IPAsset[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Only generate filler assets on client side to prevent hydration errors
  useEffect(() => {
    setIsClient(true);
    if (ipAssets.length === 0 && !loading) {
      setFillerIPAssets(generateFillerIPAssets());
    }
  }, [ipAssets.length, loading, generateFillerIPAssets]);

  // Combine real assets with filler assets
  const displayIPAssets = ipAssets.length > 0 ? ipAssets : (loading || !isClient ? [] : fillerIPAssets);

  // Generate fake token balances for filler assets
  useEffect(() => {
    // Only generate balances for filler assets (when we have no real assets and not loading)
    if (ipAssets.length === 0 && !loading && fillerIPAssets.length > 0) {
      const fakeBalances: Record<string, TokenBalance> = {};
      fillerIPAssets.forEach((asset) => {
        if (asset.hasRoyaltyTokens) {
          // Use deterministic balance based on asset index to prevent hydration issues
          const assetIndex = fillerIPAssets.indexOf(asset);
          const deterministicBalance = ((assetIndex * 123.456 + 100) % 1000 + 100).toFixed(4);
          fakeBalances[asset.ipId] = {
            address: asset.royaltyVaultAddress,
            balance: deterministicBalance,
            decimals: 18,
            symbol: asset.name.slice(0, 4).toUpperCase() || "IP",
          };
        }
      });
      // Only update if we don't already have balances for these assets
      setTokenBalances((prev) => {
        const hasNewBalances = fillerIPAssets.some(asset => !prev[asset.ipId]);
        if (hasNewBalances) {
          return { ...prev, ...fakeBalances };
        }
        return prev;
      });
    }
  }, [fillerIPAssets, ipAssets.length, loading]);

  const handleLogoFileChange = (file: File | null) => {
    setLaunchLogoFile(file);
  };

  // Handle IP pre-selection from URL params (for Remix functionality)
  useEffect(() => {
    const ipIdParam = searchParams.get("ipId");
    if (ipIdParam && ipAssets.length > 0) {
      const matchingAsset = ipAssets.find((asset) => asset.ipId.toLowerCase() === ipIdParam.toLowerCase());
      if (matchingAsset) {
        setSelectedIP(matchingAsset.ipId);
      }
    }
  }, [searchParams, ipAssets]);

  // Auto-populate image from Story Protocol when IP is selected
  useEffect(() => {
    if (selectedIPAsset?.imageUrl) {
      setLaunchImageUrl(selectedIPAsset.imageUrl);
      // Clear manual upload when auto-populating from Story Protocol
      setLaunchLogoFile(null);
    }
  }, [selectedIP]);

  useEffect(() => {
    const fetchAssets = async () => {
      if (!isConnected || !walletAddress) return;
      setLoading(true);
      setError(null);
      try {
        const assets = await fetchWalletIPAssets(walletAddress, primaryWallet);
        setIpAssets(assets);

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
    };

    fetchAssets();
  }, [isConnected, walletAddress, primaryWallet]);

  const handleUnlockTokens = async (ipAsset: IPAsset) => {
    if (!walletAddress || !primaryWallet) return;

    setUnlockingTokens(ipAsset.ipId);
    setError(null);
    setSuccess(null);

    try {
      // 1. Mint license token (triggers royalty vault deployment)
      // 2. Transfer royalty tokens from IP Account to user wallet
      const licenseTermsIds = ["1", "2", "3", "10", "100"];
      let licenseResult: { success: boolean; txHash?: string } = { success: false };

      for (const termsId of licenseTermsIds) {
        try {
          licenseResult = await mintLicenseToken(ipAsset.ipId, termsId, primaryWallet);
          if (licenseResult.success && licenseResult.txHash) break;
        } catch {
          continue;
        }
      }

      if (!licenseResult.success || !licenseResult.txHash) {
        throw new Error("Failed to mint license token with any license terms ID");
      }

      setSuccess(`License token minted successfully! Transaction: ${licenseResult.txHash}`);

      // Wait for royalty vault deployment
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Transfer royalty tokens from IP Account to wallet
      const transferResult = await transferRoyaltyTokensFromIP(ipAsset.ipId, primaryWallet);

      if (transferResult.success) {
        setSuccess((prev) =>
          (prev || "") + `\n✅ Royalty tokens transferred to your wallet! Transaction: ${transferResult.txHash}`
        );

        // Wait for tokens to appear
        await new Promise((resolve) => setTimeout(resolve, 10000));

        let balance = await getTokenBalance(walletAddress, ipAsset.royaltyVaultAddress);
        if (balance && parseFloat(balance.balance) > 0) {
          setTokenBalances((prev) => ({ ...prev, [ipAsset.ipId]: balance }));
          setSuccess((prev) =>
            (prev || "") + `\n💰 Your royalty token balance: ${balance.balance} ${balance.symbol}`
          );

          // Auto-claim all available revenue
          try {
            const claimResult = await claimRevenue(ipAsset.ipId, primaryWallet);
            if (claimResult.success) {
              setSuccess((prev) =>
                (prev || "") + `\n✅ All revenue claimed successfully! Transaction: ${claimResult.txHash}`
              );
            }
          } catch (claimError) {
            setSuccess((prev) =>
              (prev || "") +
              `\n⚠️ Could not auto-claim revenue: ${
                claimError instanceof Error ? claimError.message : "Unknown error"
              }`
            );
          }
        }
      } else {
        setSuccess((prev) =>
          (prev || "") + `\n⚠️ License minted but token transfer failed: ${transferResult.error}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get royalty tokens");
    } finally {
      setUnlockingTokens(null);
    }
  };

  const handleCreatePool = async (ipAsset: IPAsset) => {
    try {
      setCreatingPool(ipAsset.ipId);
      setLaunchStep(3);
      setError(null);
      setSuccess(null);

      if (!primaryWallet) {
        throw new Error("Please connect your wallet first");
      }

      const nameForLaunch = tokenName || ipAsset.name || "IP Token";
      let symbolForLaunch = tokenSymbolLaunch;
      if (!symbolForLaunch) {
        const base = ipAsset.name || "IP";
        const cleaned = base.replace(/[^A-Za-z0-9]/g, "");
        symbolForLaunch = (cleaned || "IP").slice(0, 10).toUpperCase();
      }

      const result = await launchpadService.launchOnBondingCurve(
        ipAsset.royaltyVaultAddress,
        primaryWallet,
        nameForLaunch,
        symbolForLaunch,
        launchPercentage,
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to launch on bonding curve");
      }

      let metadataUri: string | null = null;
      try {
        // Use Story Protocol image as primary source, manual upload as override
        let imageUrl = "";
        if (launchLogoFile) {
          // Manual upload takes precedence
          const imageRes = await pinFileToIPFS(launchLogoFile, launchLogoFile.name);
          imageUrl = imageRes.gatewayUrl;
        } else if (launchImageUrl.trim()) {
          // Use Story Protocol image
          imageUrl = launchImageUrl.trim();
        } else if (ipAsset.imageUrl) {
          // Fallback to IP asset image
          imageUrl = ipAsset.imageUrl;
        }

        const metadata = {
          name: nameForLaunch,
          symbol: symbolForLaunch,
          description:
            launchDescription || selectedIPAsset?.description || "",
          image: imageUrl || undefined,
          attributes: [
            {
              trait_type: "Royalty Token",
              value: ipAsset.royaltyVaultAddress,
            },
            {
              trait_type: "IP ID",
              value: ipAsset.ipId,
            },
          ],
        };

        const metaRes = await pinJSONToIPFS(
          metadata,
          `${symbolForLaunch || nameForLaunch}-wrapper`
        );
        metadataUri = metaRes.uri;

        if (supabase) {
          await supabase.from("launches").insert({
            royalty_token_address: ipAsset.royaltyVaultAddress.toLowerCase(),
            creator_address: walletAddress?.toLowerCase() || null,
            name: nameForLaunch,
            symbol: symbolForLaunch,
            description: launchDescription || null,
            image_url: imageUrl || null,
            metadata_uri: metadataUri,
          });
        }
      } catch (metaError) {
        console.error("Failed to persist wrapper metadata", metaError);
      }

      setLaunchStep(4);
      let lockMessage = "";
      if (walletAddress) {
        try {
          const lockInfo = await launchpadService.getRoyaltyLockInfo(
            ipAsset.royaltyVaultAddress,
            walletAddress
          );
          if (lockInfo) {
            const scale = Math.pow(10, lockInfo.decimals || 18);
            const locked = Number(lockInfo.locked) / scale;
            const remaining = Number(lockInfo.creatorBalance) / scale;
            lockMessage =
              `\nLocked: ${locked.toFixed(4)} ${lockInfo.symbol}, ` +
              `Remaining: ${remaining.toFixed(4)} ${lockInfo.symbol}`;
          }
        } catch (e) {
          console.error("Failed to load royalty lock info", e);
        }
      }

      setSuccess(
        `Token launched on Sovry Launchpad!` +
          `\nApprove Tx: ${result.approveTxHash}` +
          `\nLaunch Tx: ${result.launchTxHash}` +
          `\nLaunchpad contract: ${SOVRY_LAUNCHPAD_ADDRESS.slice(0, 10)}...` +
          (lockMessage || "")
      );

      setSelectedIP("");

      setTimeout(() => {
        router.push("/profile?tab=liquidity");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch on bonding curve");
    } finally {
      setCreatingPool(null);
      setLaunchStep(null);
    }
  };

  const selectedIPAsset = displayIPAssets.find((asset) => asset.ipId === selectedIP);
  const selectedTokenBalance = selectedIPAsset ? tokenBalances[selectedIPAsset.ipId] : null;
  const needsUnlock = selectedIPAsset
    ? selectedTokenBalance
      ? Number(selectedTokenBalance.balance) <= 0.000001
      : true
    : false;

  // TEMPORARILY BYPASSED: MetaMask check to view registration page
  // if (!isConnected) {
  //   return (
  //     <div className="max-w-md mx-auto">
  //           <Card className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-6">
  //             <CardHeader>
  //               <CardTitle className="flex items-center gap-2 text-lg font-semibold text-zinc-50">
  //                 <Wallet className="h-5 w-5" />
  //                 Connect EVM Wallet
  //               </CardTitle>
  //             </CardHeader>
  //             <CardContent className="space-y-4">
  //               <Alert>
  //                 <AlertCircle className="h-4 w-4" />
  //                 <AlertDescription>
  //                   Connect your EVM wallet to register IP assets and launch royalty tokens.
  //                 </AlertDescription>
  //               </Alert>

  //               <Alert variant="destructive">
  //                 <AlertCircle className="h-4 w-4" />
  //                 <AlertDescription>
  //                   <div className="space-y-2">
  //                     <p className="font-semibold">MetaMask Extension Not Detected</p>
  //                     <p>Please install MetaMask browser extension first:</p>
  //                     <div className="flex items-center gap-2">
  //                       <ExternalLink className="h-4 w-4" />
  //                       <a
  //                         href="https://metamask.io/download/"
  //                         target="_blank"
  //                         rel="noopener noreferrer"
  //                         className="text-[#39FF14] hover:underline"
  //                       >
  //                         Download MetaMask
  //                       </a>
  //                     </div>
  //                     <p className="text-xs">After installation, refresh this page</p>
  //                   </div>
  //                 </AlertDescription>
  //               </Alert>
  //             </CardContent>
  //           </Card>
  //         </div>
  //   );
  // }

  // Filter trending launches by category
  const filteredTrendingLaunches = trendingLaunches.filter((launch) => {
    if (selectedCategory === "All") return true;
    return launch.category === selectedCategory;
  });

  // Generate fake transaction notifications
  useEffect(() => {
    if (filteredTrendingLaunches.length > 0) {
      const generateNotification = () => {
        const launch = filteredTrendingLaunches[Math.floor(Math.random() * filteredTrendingLaunches.length)];
        const addresses = [
          "0x3385a3d8b",
          "0x921b8e0f",
          "0x0a70ec85",
          "0x4f2a1b9c",
          "0x7e3d5f2a",
          "0x2c8f1a4d",
          "0x9b3e7c2f",
          "0x5d1a8e3b",
        ];
        // More varied amounts for realism
        const amounts = [
          "0", "0.1", "0.5", "1.2", "2.5", "5.0", "12.3", "25.7", 
          "54.5", "89.7", "123.4", "256.8", "512.3", "1024.5"
        ];
        const isBuy = Math.random() > 0.5;
        const token = launch.symbol || launch.name?.slice(0, 5).toUpperCase() || "TOKEN";

        return {
          id: `tx-${Date.now()}-${Math.random()}`,
          address: addresses[Math.floor(Math.random() * addresses.length)],
          amount: amounts[Math.floor(Math.random() * amounts.length)],
          token,
          isBuy,
        };
      };

      // Generate initial notifications
      const initialNotifications = Array.from({ length: 3 }, generateNotification);
      setTransactionNotifications(initialNotifications);

      // Add new notifications periodically
      const interval = setInterval(() => {
        setTransactionNotifications((prev) => {
          const newNotification = generateNotification();
          return [...prev.slice(-4), newNotification]; // Keep max 5 notifications
        });
      }, 10000); // Every 10 seconds

      return () => clearInterval(interval);
    }
  }, [filteredTrendingLaunches]);

  return (
    <div className="relative min-h-screen px-4 md:px-6 py-8 sm:py-12 bg-gradient-to-b from-zinc-950 via-purple-950/20 to-blue-950/20">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Glowing purple lines on right side */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10">
          <div className="absolute right-0 top-1/4 w-full h-px bg-gradient-to-l from-purple-500 via-pink-500 to-transparent blur-sm" />
          <div className="absolute right-0 top-1/2 w-2/3 h-px bg-gradient-to-l from-purple-400 via-pink-400 to-transparent blur-md" />
          <div className="absolute right-0 top-3/4 w-1/2 h-px bg-gradient-to-l from-purple-500 via-pink-500 to-transparent blur-sm" />
          <div className="absolute right-0 top-1/3 w-3/4 h-px bg-gradient-to-l from-purple-600 via-pink-600 to-transparent blur-lg opacity-20" />
        </div>
        {/* Texture overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Search Bar Section */}
        <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-4 sm:p-6">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search for or create an IP to remix (e.g. Spinning Cat)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-zinc-900 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-sovry-green focus:border-transparent"
            />
          </div>
          {/* Category Pills */}
          <div className="mt-4">
            <CategoryPills
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          </div>
        </div>

        {/* Hero */}
        <div className="text-center mb-8 space-y-4">
          <div className="inline-flex items-center px-4 py-2 bg-sovry-green/10 rounded-full border border-sovry-green/30">
            <Sparkles className="w-4 h-4 text-sovry-green mr-2" />
            <span className="text-sm font-medium text-sovry-green uppercase tracking-wide">Create & Launch IP Tokens</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-50 tracking-tight">
            Turn Your IP Into a Liquid Asset
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed max-w-2xl mx-auto">
            Register new IP assets on Story Protocol, mint royalty tokens, and launch them on a bonding curve via SovryLaunchpad.
          </p>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="mb-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {success && (
          <div className="mb-6">
            <Alert>
              <CheckCircle className="h-4 w-4 text-sovry-green" />
              <AlertDescription className="whitespace-pre-line">{success}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Trending IPs Section */}
        <section className="space-y-4 sm:space-y-6 relative">
          <header className="flex items-center gap-2">
            <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-sovry-green" />
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-50">Trending IPs</h2>
          </header>
          {trendingLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-zinc-800 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-zinc-800 rounded w-1/3" />
                      <div className="h-3 bg-zinc-800 rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTrendingLaunches.length === 0 ? (
            <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-sm text-zinc-400">No trending IPs found yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTrendingLaunches.map((launch, index) => {
                const image = launch.imageUrl || "/placeholder-ip.png";
                const name = launch.name || launch.symbol || "Unknown IP";
                const creator = launch.creator || "0x0000000000000000000000000000000000000000";
                const category = launch.category || "Art";
                const marketCap = launch.marketCap;
                const tokenAddress = launch.token || launch.id;
                
                // Generate deterministic fake data based on index for consistency
                // Remix counts: 1-10 range, varied distribution
                const remixCount = ((index * 7 + 3) % 10) + 1; // 1-10 range
                // Scores: 71-85 range, varied distribution
                const score = 71 + ((index * 5 + 2) % 15); // 71-85 range

                return (
                  <CompactIPCard
                    key={tokenAddress}
                    ipId={tokenAddress}
                    name={name}
                    imageUrl={image}
                    creator={creator}
                    category={category}
                    marketCap={marketCap}
                    remixCount={remixCount}
                    score={score}
                    tokenAddress={tokenAddress}
                  />
                );
              })}
            </div>
          )}

          {/* Transaction Notifications */}
          <TransactionNotificationsContainer
            notifications={transactionNotifications}
            onDismiss={(id) =>
              setTransactionNotifications((prev) => prev.filter((n) => n.id !== id))
            }
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* IP Assets List */}
          <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-sovry-green/20 rounded-lg border border-sovry-green/30">
                <Crown className="h-5 w-5 text-sovry-green" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-50">Your IP Assets</h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-sovry-green" />
                <span className="ml-3 text-zinc-400">Fetching IP assets...</span>
              </div>
            ) : displayIPAssets.length === 0 ? (
              <div className="p-6 bg-zinc-800/30 border border-zinc-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-zinc-400" />
                  <p className="text-zinc-400">No IP assets with royalty tokens found</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {displayIPAssets.map((ipAsset) => {
                  const tokenBalance = tokenBalances[ipAsset.ipId];
                  const hasTokens = tokenBalance && Number(tokenBalance.balance) > 0.000001;
                  return (
                    <div
                      key={ipAsset.ipId}
                      className={`p-4 bg-zinc-900/50 backdrop-blur-sm border rounded-xl cursor-pointer transition-all duration-300 relative ${
                        selectedIP === ipAsset.ipId
                          ? "border-sovry-green/50 bg-sovry-green/10"
                          : "border-zinc-800 hover:border-sovry-pink/50 hover:bg-sovry-pink/5 hover:scale-105 hover:shadow-xl hover:shadow-sovry-pink/30"
                      }`}
                      onClick={() => setSelectedIP(ipAsset.ipId)}
                    >
                      {/* Pink Glow Animation on Hover */}
                      {selectedIP !== ipAsset.ipId && (
                        <div className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-all duration-500 pointer-events-none">
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-sovry-pink/30 via-sovry-pink/20 to-sovry-pink/10 blur-2xl" 
                               style={{
                                 animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                               }}
                          />
                          <div className="absolute inset-0 rounded-xl border-2 border-sovry-pink/50 shadow-[0_0_20px_rgba(255,16,240,0.5)]" />
                        </div>
                      )}
                      <div className="flex items-start gap-3 relative z-10">
                        {/* IP Image Preview */}
                        {ipAsset.imageUrl && (
                          <div className="flex-shrink-0 relative group/image">
                            <img
                              src={ipAsset.imageUrl}
                              alt={ipAsset.name}
                              className="w-16 h-16 rounded-lg object-cover border border-zinc-800/50 group-hover/image:border-sovry-pink/50 transition-all duration-300"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                              }}
                            />
                            {/* Pink glow on image hover */}
                            <div className="absolute inset-0 rounded-lg opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 pointer-events-none">
                              <div className="absolute inset-0 rounded-lg bg-sovry-pink/20 blur-md" />
                            </div>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 relative z-10">
                          <div className="flex items-center space-x-2 mb-2 flex-wrap gap-2">
                            <h3 className="font-semibold text-zinc-50 truncate">{ipAsset.name}</h3>
                            {hasTokens && (
                              <div className="px-2 py-1 bg-sovry-green/20 rounded-full border border-sovry-green/30 flex-shrink-0">
                                <span className="text-xs text-sovry-green font-semibold uppercase tracking-wider">Ready</span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">{ipAsset.description}</p>
                          <div className="mt-2 text-xs text-muted-foreground">
                            <p>IP ID: {ipAsset.ipId.slice(0, 10)}...</p>
                            <p>Royalty Vault: {ipAsset.royaltyVaultAddress.slice(0, 10)}...</p>
                          </div>

                          {tokenBalance && (
                            <div className="mt-3 p-3 bg-zinc-800/30 rounded-lg border border-zinc-700">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-1 bg-sovry-green/20 rounded border border-sovry-green/30">
                                    <Coins className="h-3 w-3 text-sovry-green" />
                                  </div>
                                  <span className="text-sm font-medium text-zinc-50">
                                    {tokenBalance.balance} {tokenBalance.symbol}
                                  </span>
                                </div>
                                {hasTokens ? (
                                  <div className="px-2 py-1 bg-sovry-green/20 rounded-full border border-sovry-green/30">
                                    <span className="text-xs text-sovry-green font-semibold uppercase tracking-wider">Available</span>
                                  </div>
                                ) : (
                                  <div className="px-2 py-1 bg-sovry-pink/20 rounded-full border border-sovry-pink/30">
                                    <span className="text-xs text-sovry-pink font-semibold uppercase tracking-wider">Needs Unlock</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create / Launch Form (only launch existing IP assets) */}
          <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-sovry-green/20 rounded-lg border border-sovry-green/30">
                <TrendingUp className="h-5 w-5 text-sovry-green" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-50">Launch Existing IP</h2>
            </div>

            {/* Other Available IPs to Launch */}
            {!selectedIPAsset && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-400 mb-4">
                  Browse and select an IP asset to launch, or choose one from your assets on the left.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-2">
                  {displayIPAssets.slice(0, 6).map((ipAsset) => {
                    const tokenBalance = tokenBalances[ipAsset.ipId];
                    const hasTokens = tokenBalance && Number(tokenBalance.balance) > 0.000001;
                    return (
                      <div
                        key={ipAsset.ipId}
                        className="p-3 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl cursor-pointer transition-all duration-300 relative group hover:scale-105"
                        onClick={() => setSelectedIP(ipAsset.ipId)}
                      >
                        {/* Pink Glow Animation on Hover */}
                        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none">
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-sovry-pink/30 via-sovry-pink/20 to-sovry-pink/10 blur-xl" 
                               style={{
                                 animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                               }}
                          />
                          <div className="absolute inset-0 rounded-xl border-2 border-sovry-pink/50 shadow-[0_0_15px_rgba(255,16,240,0.4)]" />
                        </div>
                        <div className="flex items-start gap-3 relative z-10">
                          {/* IP Image Preview */}
                          {ipAsset.imageUrl && (
                            <div className="flex-shrink-0 relative group/image">
                              <img
                                src={ipAsset.imageUrl}
                                alt={ipAsset.name}
                                className="w-12 h-12 rounded-lg object-cover border border-zinc-800/50 group-hover/image:border-sovry-pink/50 transition-all duration-300"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                }}
                              />
                              {/* Pink glow on image hover */}
                              <div className="absolute inset-0 rounded-lg opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 pointer-events-none">
                                <div className="absolute inset-0 rounded-lg bg-sovry-pink/20 blur-md" />
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0 relative z-10">
                            <div className="flex items-center space-x-2 mb-1 flex-wrap gap-1">
                              <h3 className="font-semibold text-zinc-50 truncate text-sm">{ipAsset.name}</h3>
                              {hasTokens && (
                                <div className="px-1.5 py-0.5 bg-sovry-green/20 rounded-full border border-sovry-green/30 flex-shrink-0">
                                  <span className="text-[10px] text-sovry-green font-semibold uppercase tracking-wider">Ready</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-1">{ipAsset.description}</p>
                            {tokenBalance && (
                              <div className="flex items-center gap-1 mt-1">
                                <Coins className="h-3 w-3 text-sovry-green" />
                                <span className="text-xs font-medium text-zinc-50">
                                  {tokenBalance.balance} {tokenBalance.symbol}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {displayIPAssets.length > 6 && (
                  <p className="text-xs text-zinc-500 text-center mt-2">
                    Showing 6 of {displayIPAssets.length} available IPs. Select one to launch.
                  </p>
                )}
              </div>
            )}

            {/* Selected IP + Launch */}
            {selectedIPAsset ? (
              <div className="space-y-4">
                <div className="p-4 bg-sovry-green/10 border border-sovry-green/30 rounded-xl">
                  <h3 className="font-medium text-sovry-green mb-3">Selected IP Asset</h3>
                  <div className="flex items-start gap-4">
                    {/* IP Image Preview */}
                    {selectedIPAsset.imageUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={selectedIPAsset.imageUrl}
                          alt={selectedIPAsset.name}
                          className="w-24 h-24 rounded-lg object-cover border-2 border-sovry-green/30"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-sovry-green font-medium mb-1">{selectedIPAsset.name}</p>
                      <p className="text-xs text-zinc-400">
                        Royalty Token: {selectedIPAsset.royaltyVaultAddress.slice(0, 10)}...
                      </p>
                      {selectedIPAsset.imageUrl && (
                        <p className="text-xs text-zinc-500 mt-2">
                          ✓ Image loaded from Story Protocol
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-sovry-green/10 border border-sovry-green/30 rounded-xl">
                  <h3 className="font-medium text-sovry-green mb-2">Story Protocol Pair Details</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Royalty Token + WIP pair on SovryRouter will be created automatically when this launch graduates to
                    the DEX.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-zinc-800/30 border border-sovry-green/30 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Sparkles className="h-4 w-4 text-sovry-green" />
                      <p className="text-sm font-medium text-sovry-green">Launch on SovryLaunchpad</p>
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Launch your royalty token on a bonding curve. No need to provide initial IP liquidity – SovryLaunchpad
                      handles curve mechanics and graduation to DEX.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm font-medium uppercase tracking-wide">Token Name (for DEX)</Label>
                      <Input
                        value={tokenName}
                        onChange={(e) => setTokenName(e.target.value)}
                        placeholder={selectedIPAsset.name || "Super Meme"}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm font-medium uppercase tracking-wide">Token Symbol</Label>
                      <Input
                        value={tokenSymbolLaunch}
                        onChange={(e) => setTokenSymbolLaunch(e.target.value.toUpperCase().slice(0, 10))}
                        placeholder="MEME"
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3"
                      />
                    </div>
                  </div>

                  {/* Image Preview Section */}
                  {selectedIPAsset.imageUrl && (
                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm font-medium uppercase tracking-wide">Token Logo Preview</Label>
                      <div className="relative">
                        <img
                          src={launchImageUrl || selectedIPAsset.imageUrl}
                          alt="Token logo preview"
                          className="w-full h-32 rounded-lg object-cover border border-zinc-800 bg-zinc-900/40"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = selectedIPAsset.imageUrl || "/placeholder-ip.png";
                          }}
                        />
                        {launchLogoFile && (
                          <div className="absolute top-2 right-2 px-2 py-1 bg-sovry-green/90 rounded text-xs text-black font-medium">
                            Custom Upload
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        Using image from Story Protocol. You can override with a custom image below if needed.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm font-medium uppercase tracking-wide">
                        Custom Logo (optional override)
                      </Label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0] || null;
                          if (file) {
                            handleLogoFileChange(file);
                          }
                        }}
                        onClick={() => logoInputRef.current?.click()}
                        className="h-20 border border-dashed border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-400 flex items-center cursor-pointer bg-zinc-900 hover:border-zinc-600 transition-colors"
                      >
                        <span className="truncate">
                          {launchLogoFile
                            ? launchLogoFile.name
                            : selectedIPAsset.imageUrl
                            ? "Click to override with custom image"
                            : "Drag & drop image here, or click to browse"}
                        </span>
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleLogoFileChange(e.target.files?.[0] || null)
                        }
                      />
                      {launchLogoFile && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setLaunchLogoFile(null);
                            setLaunchImageUrl(selectedIPAsset?.imageUrl || "");
                          }}
                        >
                          Reset to Story Protocol image
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm font-medium uppercase tracking-wide">Token Description (optional)</Label>
                      <Input
                        value={launchDescription}
                        onChange={(e) => setLaunchDescription(e.target.value)}
                        placeholder="Short description for this wrapped IP token"
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-zinc-400">
                      <span>Percentage to Launch</span>
                      <span className="font-medium text-zinc-50">{launchPercentage}%</span>
                    </div>
                    <Slider
                      value={[launchPercentage]}
                      min={1}
                      max={100}
                      step={1}
                      onValueChange={(v) => setLaunchPercentage(v[0] ?? 1)}
                    />
                    <p className="text-xs text-zinc-500">
                      You are selling {launchPercentage}% of your IP rights. You keep {100 - launchPercentage}% in your wallet.
                    </p>
                  </div>

                  {needsUnlock && (
                    <div className="space-y-4">
                      <div className="p-4 bg-zinc-800/30 border border-sovry-pink/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Coins className="h-5 w-5 text-sovry-pink" />
                          <div>
                            <p className="text-sm font-medium text-sovry-pink">Royalty Tokens Required</p>
                            <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                              Get royalty tokens before launching. This will mint a license, deploy the vault, and transfer
                              royalty tokens to your wallet.
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleUnlockTokens(selectedIPAsset)}
                        disabled={unlockingTokens === selectedIPAsset.ipId}
                        variant="default"
                        className="w-full"
                      >
                        {unlockingTokens === selectedIPAsset.ipId ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Getting Royalty Tokens...
                          </>
                        ) : (
                          <>
                            <Coins className="mr-2 h-4 w-4" />
                            Get Royalty Tokens
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={() => handleCreatePool(selectedIPAsset)}
                    disabled={creatingPool === selectedIPAsset.ipId || needsUnlock}
                    variant="default"
                    className="w-full"
                  >
                    {creatingPool === selectedIPAsset.ipId ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Launching on Bonding Curve...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Launch on Bonding Curve
                      </>
                    )}
                  </Button>

                  <div className="mt-4 space-y-2 text-sm text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 font-medium">1.</span>
                      <CheckCircle className="h-3 w-3 text-sovry-green" />
                      <span>IP Asset Registered (from Story Protocol)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 font-medium">2.</span>
                      {needsUnlock ? (
                        unlockingTokens === selectedIPAsset.ipId ? (
                          <Loader2 className="h-3 w-3 animate-spin text-sovry-green" />
                        ) : (
                          <span className="text-sovry-green">⏳</span>
                        )
                      ) : (
                        <CheckCircle className="h-3 w-3 text-sovry-green" />
                      )}
                      <span>Minting Royalty Tokens / unlock token</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 font-medium">3.</span>
                      {creatingPool === selectedIPAsset.ipId && launchStep === 3 ? (
                        <Loader2 className="h-3 w-3 animate-spin text-sovry-green" />
                      ) : launchStep !== null && launchStep > 3 ? (
                        <CheckCircle className="h-3 w-3 text-sovry-green" />
                      ) : (
                        <span className="text-sovry-green">⏳</span>
                      )}
                      <span>Approving Launchpad...</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 font-medium">4.</span>
                      {creatingPool === selectedIPAsset.ipId && launchStep === 4 ? (
                        <Loader2 className="h-3 w-3 animate-spin text-sovry-green" />
                      ) : launchStep !== null && launchStep >= 4 ? (
                        <CheckCircle className="h-3 w-3 text-sovry-green" />
                      ) : (
                        <span className="text-sovry-green">⏳</span>
                      )}
                      <span>
                        Launching Market...
                        {creatingPool === selectedIPAsset.ipId && launchStep === 4 && (
                          <span className="ml-1">🚀</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-xl text-center text-sm text-zinc-400">
                Select an IP asset on the left to launch it on SovryLaunchpad.
              </div>
            )}
          </div>
        </div>

        {/* Register IP Link */}
        <div className="mt-8 text-center">
          <Link
            href="https://story.foundation/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sovry-green hover:text-sovry-green/80 hover:underline transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Don't see your IP? Register an IP now.</span>
          </Link>
        </div>
      </div>
    </div>
  );
}