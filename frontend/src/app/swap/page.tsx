import SwapInterface from "../../components/swap/SwapInterface";
import { Navigation } from "../../components/navigation/Navigation";

export default function SwapPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Token Swap
          </h1>
          <p className="text-lg text-white/80 max-w-3xl mx-auto">
            Swap tokens from available liquidity pools on Sovry DEX. 
            Real-time pricing based on pool reserves and AMM calculations.
          </p>
        </div>
        <SwapInterface />
      </main>
    </div>
  );
}
