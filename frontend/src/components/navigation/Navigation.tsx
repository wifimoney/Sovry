"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { WalletConnector } from "@/components/WalletConnector";
import { 
  TrendingUp, 
  Plus, 
  DollarSign, 
  BarChart3, 
  Menu, 
  X,
  Home,
  Palette,
  PieChart,
  Droplets,
  Database
} from "lucide-react";

const navigationItems = [
  {
    name: "Home",
    href: "/",
    icon: Home,
    description: "Overview and quick swap"
  },
  {
    name: "Swap",
    href: "/swap",
    icon: TrendingUp,
    description: "Trade WIP ↔ rIP tokens"
  },
  {
    name: "Portfolio",
    href: "/portfolio",
    icon: PieChart,
    description: "Track your IP investments"
  },
  {
    name: "Revenue",
    href: "/revenue",
    icon: DollarSign,
    description: "Claim your IP revenue"
  },
  {
    name: "Liquidity",
    href: "/liquidity",
    icon: Droplets,
    description: "Create pools from your IP assets"
  },
  {
    name: "Pools",
    href: "/pools",
    icon: Database,
    description: "View all liquidity pools"
  },
];

export function Navigation() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-black/40 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-white font-bold text-xl">Sovry DEX</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Wallet Connector */}
          <div className="hidden md:block">
            <WalletConnector />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-white hover:bg-white/10"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-black/60 backdrop-blur-md">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <div>
                    <div>{item.name}</div>
                    <div className="text-xs text-gray-400">{item.description}</div>
                  </div>
                </Link>
              );
            })}
            
            {/* Mobile Wallet Connector */}
            <div className="px-3 py-2 border-t border-white/10 mt-2">
              <WalletConnector />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
