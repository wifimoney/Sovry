"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMarketCap } from "@/services/launchDataService";

export interface LaunchCardData {
  id: string;
  token: string;
  creator: string;
  createdAt: number;
  symbol?: string;
  name?: string;
  ipId?: string;
  imageUrl?: string;
  marketCap?: string;
  bondingProgress?: number;
  category?: string;
  currentPrice?: string;
}

interface LaunchCardProps {
  launch: LaunchCardData;
}

const categoryColors: Record<string, string> = {
  Art: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Music: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  Gaming: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Photography: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "3D Art": "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  "Commercial IP": "bg-green-500/10 text-green-600 border-green-500/20",
  "Personal IP": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "IP Asset": "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

export default function LaunchCard({ launch }: LaunchCardProps) {
  const address = launch.token || launch.id;
  const createdAtDate = launch.createdAt
    ? new Date(launch.createdAt * 1000)
    : null;
  
  const categoryColor = categoryColors[launch.category || "IP Asset"] || categoryColors["IP Asset"];
  const bondingProgress = launch.bondingProgress || 0;
  const displaySymbol = launch.symbol || address.slice(2, 6).toUpperCase();
  const displayName = launch.name || `Token ${address.slice(0, 6)}`;

  // Category emoji mapping
  const categoryEmoji: Record<string, string> = {
    Art: "🎨",
    Music: "🎵",
    Gaming: "🎮",
    Photography: "📷",
    "3D Art": "🎭",
    "Commercial IP": "💼",
    "Personal IP": "👤",
    "IP Asset": "📦",
    "AI Agent": "🤖",
    Meme: "😄",
  };

  const categoryEmojiIcon = categoryEmoji[launch.category || "IP Asset"] || "📦";

  return (
    <Link
      href={`/pool/${address}`}
      className="group relative rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
    >
      {/* Image Section - 16:9 Aspect Ratio */}
      <div className="relative w-full aspect-video bg-gradient-to-br from-indigo-500/40 via-purple-500/30 to-emerald-500/40 overflow-hidden">
        {launch.imageUrl || launch.ipId ? (
          <div className="absolute inset-0">
            <img
              src={launch.imageUrl || undefined}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
          </div>
        ) : (
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_60%)]" />
        )}
        
        {/* Badge - Top Left: Bonding Curve % in Hot Pink */}
        <div className="absolute top-3 left-3">
          <div className="px-3 py-1.5 rounded-lg bg-secondary/90 backdrop-blur-sm border border-secondary/50 shadow-lg">
            <span className="text-xs font-bold text-secondary-foreground">
              {Math.round(bondingProgress)}%
            </span>
          </div>
        </div>

        {/* Badge - Top Right: Category Icon in Glass Badge */}
        {launch.category && (
          <div className="absolute top-3 right-3">
            <div className="px-2.5 py-1.5 rounded-lg bg-card/80 backdrop-blur-sm border border-border">
              <span className="text-sm">{categoryEmojiIcon}</span>
            </div>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
      </div>

      {/* Footer - Minimal: Token Name and Ticker */}
      <div className="p-4 bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-zinc-50 truncate">
              {displayName}
            </div>
            <div className="text-xs text-zinc-400 font-mono">
              {displaySymbol}
            </div>
          </div>
          {/* Buy Button - Revealed on Hover */}
          <Button
            variant="buy"
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs px-4 py-1.5"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = `/pool/${address}`;
            }}
          >
            Buy
          </Button>
        </div>
      </div>
    </Link>
  );
}
