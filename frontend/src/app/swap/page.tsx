import SwapInterface from "../../components/swap/SwapInterface";
import { Navigation } from "../../components/navigation/Navigation";

export default function SwapPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/95">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
              Token Swap
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Swap tokens from available liquidity pools on Sovry DEX. 
            Real-time pricing based on pool reserves and AMM calculations.
          </p>
        </div>
        <SwapInterface />
      </main>
    </div>
  );
}
