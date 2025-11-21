"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/navigation/Navigation";
import SwapInterface from "@/components/swap/SwapInterface";

// Fetch pools from backend API
async function fetchPools(first: number, skip: number) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/pools`);
    if (!response.ok) {
      return { pools: [] };
    }
    const data = await response.json();
    const pools = data.pools || [];
    return { pools: pools.slice(skip, skip + first) };
  } catch (error) {
    return { pools: [] };
  }
}

// Featured IP Assets Interface
interface FeaturedIPAsset {
  id: string;
  name: string;
  image: string;
  thumbnail?: string;
  apy: number;
  volume24h: number;
  price: number;
  description: string;
  category: string;
  address: string;
  owner?: string;
  tokenId?: string;
}

export default function Home() {
  const [pools, setPools] = useState<any[]>([]);
  const [totalIPAssets, setTotalIPAssets] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPools = async () => {
      try {
        const poolsData = await fetchPools(8, 0);
        if (poolsData && poolsData.pools) {
          setPools(poolsData.pools);
          setTotalIPAssets(poolsData.pools.length);
        }
      } catch (error) {
        // Continue with empty pools
      } finally {
        setLoading(false);
      }
    };

    loadPools();
  }, []);

  // Mock data for featured assets
  const featuredAssets: FeaturedIPAsset[] = [
    {
      id: "1",
      name: "Music Stem Collection Vol.1",
      image: "https://ttmbengqanqzfrkjajgk.supabase.co/storage/v1/object/public/images/pack-art/20874abc-latinpack.jpg",
      thumbnail: "https://ttmbengqanqzfrkjajgk.supabase.co/storage/v1/object/public/images/pack-art/20874abc-latinpack.jpg",
      apy: 15.8,
      volume24h: 125000,
      price: 0.85,
      description: "Professional music stems for producers",
      category: "Music",
      address: "0x7f06e1b57998E4E0c64340606e889E4E2313c4f6",
      owner: "0x1234...5678",
      tokenId: "1234"
    },
    {
      id: "2", 
      name: "Digital Art Pack #42",
      image: "https://cdn.pixabay.com/photo/2024/02/28/07/42/easter-8601492_640.jpg",
      thumbnail: "https://cdn.pixabay.com/photo/2024/02/28/07/42/easter-8601492_640.jpg",
      apy: 12.3,
      volume24h: 89000,
      price: 1.25,
      description: "Exclusive digital artwork collection",
      category: "Art",
      address: "0x7C846C15CF200Bc7ceF3df183f87E366091bfb24",
      owner: "0xabcd...efgh",
      tokenId: "5678"
    },
    {
      id: "3",
      name: "Game Asset Bundle",
      image: "https://cdn.pixabay.com/photo/2024/01/25/10/38/minecraft-8532000_640.png",
      thumbnail: "https://cdn.pixabay.com/photo/2024/01/25/10/38/minecraft-8532000_640.png",
      apy: 18.2,
      volume24h: 156000,
      price: 0.65,
      description: "Ready-to-use game development assets",
      category: "Gaming",
      address: "0xDef1234567890123456789012345678901234567",
      owner: "0x9876...5432",
      tokenId: "9012"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/95">
      <Navigation />
      
      {/* Hero Section - Trade IP, Earn Yield */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-6 mb-20">
          <h1 className="text-5xl md:text-6xl font-bold text-balance">
            Trade IP Assets
            <br />
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
              Earn Real Yield
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
            The premier decentralized exchange for IP Royalty Tokens. Access premium intellectual property investments
            with transparent yield generation.
          </p>
          
          {/* Stats */}
          <div className="flex flex-wrap gap-4 justify-center mt-8">
            <div className="glass-card px-6 py-4">
              <span className="text-2xl font-bold text-primary">$2.5M</span>
              <span className="block text-sm text-muted-foreground">Total Value Locked</span>
            </div>
            <div className="glass-card px-6 py-4">
              <span className="text-2xl font-bold text-primary">$185K</span>
              <span className="block text-sm text-muted-foreground">Total Royalties Paid</span>
            </div>
            <div className="glass-card px-6 py-4">
              <span className="text-2xl font-bold text-primary">{totalIPAssets.toLocaleString()}</span>
              <span className="block text-sm text-muted-foreground">Total IP Listed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Assets - Carousel 3 IP dengan APY tertinggi */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-8">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <h2 className="text-2xl font-bold">Trending Assets</h2>
          </div>
          
          {/* Carousel - Sort by APY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {featuredAssets
              .sort((a, b) => b.apy - a.apy)
              .slice(0, 3)
              .map((asset) => (
              <div key={asset.id} className="glass-card overflow-hidden hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 group cursor-pointer flex flex-col">
                {/* Image */}
                <div className="relative overflow-hidden h-40 bg-muted/30 flex items-center justify-center">
                  <img
                    src={asset.thumbnail || asset.image}
                    alt={asset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* APY Badge */}
                  <div className="absolute top-3 right-3 apy-badge">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    {asset.apy}%
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <h3 className="text-lg font-semibold">{asset.name}</h3>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Current Price</p>
                    <p className="text-2xl font-bold text-primary">${asset.price}</p>
                  </div>
                  <button 
                    onClick={() => window.location.href = `/pool/${asset.address}`}
                    className="accent-button text-sm py-2"
                  >
                    Trade
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All Pools Table */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">All IP Pools</h2>
            <p className="text-muted-foreground">Complete list of tradable IP assets</p>
          </div>
          
          {/* Table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border/30">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Asset
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Price ($WIP)
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      APY/Yield
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Volume 24h
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {pools.map((pool, index) => (
                    <tr key={pool.address} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-primary/30 to-primary/10 rounded-lg flex items-center justify-center text-primary font-bold border border-primary/30">
                            {pool.token0Symbol?.charAt(0) || 'I'}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-foreground">
                              {pool.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {pool.token0Symbol}/{pool.token1Symbol}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-foreground font-medium">
                          ${(Math.random() * 2 + 0.5).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="apy-badge">
                          {pool.apr}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        ${(pool.volume24hUSD / 1000).toFixed(1)}K
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => window.location.href = `/pool/${pool.address}`}
                          className="text-primary hover:text-primary/80 transition-colors font-semibold"
                        >
                          Trade →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Swap Interface */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SwapInterface />
        </div>
      </section>
    </div>
  );
}
