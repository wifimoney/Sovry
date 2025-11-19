"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Navigation } from "@/components/navigation/Navigation";
import SwapInterface from "@/components/swap/SwapInterface";

// Pool Detail Interface
interface PoolDetail {
  id: string;
  address: string;
  token0: {
    symbol: string;
    name: string;
    address: string;
  };
  token1: {
    symbol: string;
    name: string;
    address: string;
  };
  ipAsset?: {
    id: string;
    name: string;
    description: string;
    image: string;
    thumbnail: string;
    owner: string;
    tokenId: string;
    licenseTerms: {
      commercialUse: boolean;
      derivativesAllowed: boolean;
      commercialRevShare: number;
      royaltyPolicy: string;
      transferable: boolean;
      uri: string;
    };
    metadata: {
      title: string;
      description: string;
      image: string;
      attributes: Array<{
        trait_type: string;
        value: string;
      }>;
    };
  };
  stats: {
    volume24h: number;
    volume7d: number;
    apr: number;
    tvl: number;
    fees24h: number;
    price: number;
    priceChange24h: number;
  };
}

export default function PoolDetailPage() {
  const params = useParams();
  const poolAddress = params.address as string;
  
  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPoolDetail();
  }, [poolAddress]);

  const fetchPoolDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock data - akan diganti dengan real API call
      const mockPool: PoolDetail = {
        id: poolAddress,
        address: poolAddress,
        token0: {
          symbol: "WIP",
          name: "Wrapped IP Token",
          address: "0x1234...5678"
        },
        token1: {
          symbol: "rIP-MUSIC-001",
          name: "Music Stem Collection Vol.1",
          address: "0xabcd...efgh"
        },
        ipAsset: {
          id: "0x9876...5432",
          name: "Music Stem Collection Vol.1",
          description: "Professional music stems for producers including melodies, basslines, and drum patterns. All stems are royalty-free for commercial use with proper attribution.",
          image: "https://ttmbengqanqzfrkjajgk.supabase.co/storage/v1/object/public/images/pack-art/20874abc-latinpack.jpg",
          thumbnail: "https://ttmbengqanqzfrkjajgk.supabase.co/storage/v1/object/public/images/pack-art/20874abc-latinpack.jpg",
          owner: "0x1234...5678",
          tokenId: "1234",
          licenseTerms: {
            commercialUse: true,
            derivativesAllowed: true,
            commercialRevShare: 10,
            royaltyPolicy: "Story Protocol Royalty Standard",
            transferable: true,
            uri: "https://storyprotocol.xyz/license/1234"
          },
          metadata: {
            title: "Music Stem Collection Vol.1",
            description: "Professional music stems for producers",
            image: "https://ttmbengqanqzfrkjajgk.supabase.co/storage/v1/object/public/images/pack-art/20874abc-latinpack.jpg",
            attributes: [
              { trait_type: "Genre", value: "Latin, Pop, Dance" },
              { trait_type: "Tempo", value: "96-120 BPM" },
              { trait_type: "Key", value: "Various" },
              { trait_type: "Stem Count", value: "12" },
              { trait_type: "File Format", value: "WAV 24-bit" },
              { trait_type: "License", value: "Commercial" }
            ]
          }
        },
        stats: {
          volume24h: 125000,
          volume7d: 890000,
          apr: 15.8,
          tvl: 2500000,
          fees24h: 1250,
          price: 0.85,
          priceChange24h: 12.5
        }
      };
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setPool(mockPool);
    } catch (error) {
      console.error("Error fetching pool detail:", error);
      setError("Failed to load pool details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading pool analysis...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Pool Not Found
            </h3>
            <p className="text-gray-600 mb-6">{error || "This pool doesn't exist or has been removed."}</p>
            <button 
              onClick={() => window.history.back()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button 
              onClick={() => window.history.back()}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
              <div className="w-8 h-8 bg-green-500 rounded-full -ml-2"></div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {pool.token0.symbol} / {pool.token1.symbol}
            </h1>
          </div>
          
          {/* Pool Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">TVL</div>
              <div className="text-xl font-bold text-gray-900">
                ${(pool.stats.tvl / 1000000).toFixed(2)}M
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">24h Volume</div>
              <div className="text-xl font-bold text-gray-900">
                ${(pool.stats.volume24h / 1000).toFixed(1)}K
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">APR</div>
              <div className="text-xl font-bold text-green-600">
                {pool.stats.apr}%
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Price</div>
              <div className="text-xl font-bold text-gray-900">
                ${pool.stats.price}
              </div>
              <div className={`text-sm ${pool.stats.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pool.stats.priceChange24h >= 0 ? '+' : ''}{pool.stats.priceChange24h}%
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Analysis */}
          <div>
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                🔍 IP Asset Analysis
              </h2>
              
              {/* Large IP Image */}
              <div className="mb-6">
                <img
                  src={pool.ipAsset?.image}
                  alt={pool.ipAsset?.name}
                  className="w-full h-80 object-cover rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder-ip.png';
                  }}
                />
              </div>

              {/* Metadata */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {pool.ipAsset?.metadata.title}
                </h3>
                <p className="text-gray-600 mb-4">
                  {pool.ipAsset?.metadata.description}
                </p>
                
                {/* Asset Details */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-500">Owner</div>
                    <div className="font-mono text-sm text-gray-900">
                      {pool.ipAsset?.owner}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Token ID</div>
                    <div className="font-mono text-sm text-gray-900">
                      #{pool.ipAsset?.tokenId}
                    </div>
                  </div>
                </div>
              </div>

              {/* PIL Terms - Legal Foundation */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  ⚖️ License Terms (Legal Foundation)
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Commercial Use</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      pool.ipAsset?.licenseTerms.commercialUse 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {pool.ipAsset?.licenseTerms.commercialUse ? 'Allowed' : 'Restricted'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Derivatives Allowed</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      pool.ipAsset?.licenseTerms.derivativesAllowed 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {pool.ipAsset?.licenseTerms.derivativesAllowed ? 'Yes' : 'No'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Royalty Share</span>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {pool.ipAsset?.licenseTerms.commercialRevShare}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Transferable</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      pool.ipAsset?.licenseTerms.transferable 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {pool.ipAsset?.licenseTerms.transferable ? 'Yes' : 'No'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Royalty Policy</span>
                    <span className="text-xs text-gray-600 max-w-xs text-right">
                      {pool.ipAsset?.licenseTerms.royaltyPolicy}
                    </span>
                  </div>
                  
                  {pool.ipAsset?.licenseTerms.uri && (
                    <div className="pt-2 border-t border-gray-200">
                      <a 
                        href={pool.ipAsset.licenseTerms.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                      >
                        📄 View Full License Document
                        <span>→</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Attributes */}
            {pool.ipAsset?.metadata.attributes && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🏷️ Asset Attributes
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {pool.ipAsset.metadata.attributes.map((attr, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">{attr.trait_type}</div>
                      <div className="text-sm font-medium text-gray-900">{attr.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Trading */}
          <div>
            {/* Swap Interface */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                💱 Trade {pool.token0.symbol} / {pool.token1.symbol}
              </h2>
              <SwapInterface />
            </div>

            {/* Pool Performance */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📈 Pool Performance
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">7d Volume</span>
                  <span className="font-medium text-gray-900">
                    ${(pool.stats.volume7d / 1000).toFixed(1)}K
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">24h Fees</span>
                  <span className="font-medium text-gray-900">
                    ${pool.stats.fees24h}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Fee APR</span>
                  <span className="font-medium text-green-600">
                    {((pool.stats.fees24h * 365) / pool.stats.tvl * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Investment Thesis */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                💡 Investment Thesis
              </h3>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  <strong>Revenue Potential:</strong> This IP asset generates royalties through commercial licensing with a {pool.ipAsset?.licenseTerms.commercialRevShare}% share rate.
                </p>
                <p>
                  <strong>Market Demand:</strong> {pool.ipAsset?.metadata.attributes.find(a => a.trait_type === 'Genre')?.value} content shows strong trading volume with ${(pool.stats.volume24h / 1000).toFixed(1)}K in 24h.
                </p>
                <p>
                  <strong>Legal Protection:</strong> Full commercial rights and derivative permissions provide flexible monetization options.
                </p>
                <p>
                  <strong>Yield Opportunity:</strong> Current APR of {pool.stats.apr}% includes both trading fees and potential royalty distributions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}