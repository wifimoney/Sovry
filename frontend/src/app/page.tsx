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
    <div className="min-h-screen">
      <Navigation />
      
      {/* Hero Section - Trade IP, Earn Yield */}
      <section className="relative bg-linear-to-br from-blue-900 via-purple-900 to-pink-900 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Trade IP, Earn Yield
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              The first liquidity marketplace for Intellectual Property Assets on Story Protocol
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search IP assets by name or address..."
                  className="w-full px-6 py-4 pr-12 rounded-lg text-gray-900 placeholder-gray-500 bg-white/90 backdrop-blur-sm border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors">
                  Search
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4 justify-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-6 py-3">
                <span className="text-2xl font-bold">$2.5M</span>
                <span className="block text-sm">Total Value Locked</span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-6 py-3">
                <span className="text-2xl font-bold">$185K</span>
                <span className="block text-sm">Total Royalties Paid</span>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-6 py-3">
                <span className="text-2xl font-bold">{totalIPAssets.toLocaleString()}</span>
                <span className="block text-sm">Total IP Listed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Assets - Carousel 3 IP dengan APY tertinggi */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              🔥 Trending IP Assets
            </h2>
            <p className="text-lg text-gray-600">
              Highest APY yields this week
            </p>
          </div>
          
          {/* Carousel - Sort by APY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {featuredAssets
              .sort((a, b) => b.apy - a.apy)
              .slice(0, 3)
              .map((asset) => (
              <div key={asset.id} className="bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer relative">
                {/* APY Badge */}
                <div className="absolute top-3 right-3 bg-green-500/90 backdrop-blur-sm px-3 py-1 rounded-full z-10">
                  <span className="text-white text-xs font-bold">
                    {asset.apy}% APY
                  </span>
                </div>
                
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={asset.thumbnail || asset.image}
                    alt={asset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                
                {/* Info */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {asset.name}
                  </h3>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-500">{asset.category}</p>
                      <p className="text-lg font-bold text-gray-900">${asset.price}</p>
                    </div>
                    <button 
                      onClick={() => window.location.href = `/pool/${asset.address}`}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                    >
                      Trade
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All Pools Table */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              📊 All IP Pools
            </h2>
            <p className="text-lg text-gray-600">
              Complete list of tradable IP assets
            </p>
          </div>
          
          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Asset
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price ($WIP)
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      APY/Yield
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Volume 24h
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pools.map((pool, index) => (
                    <tr key={pool.address} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-linear-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                            {pool.token0Symbol?.charAt(0) || 'I'}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {pool.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {pool.token0Symbol}/{pool.token1Symbol}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          ${(Math.random() * 2 + 0.5).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {pool.apr}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${(pool.volume24hUSD / 1000).toFixed(1)}K
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => window.location.href = `/pool/${pool.address}`}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
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
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <SwapInterface />
        </div>
      </section>
    </div>
  );
}
