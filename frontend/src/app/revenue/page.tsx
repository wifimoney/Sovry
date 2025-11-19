import { RevenueClaiming } from "@/components/revenue/RevenueClaiming";
import { Navigation } from "@/components/navigation/Navigation";

export default function RevenuePage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Claim Your Revenue
          </h1>
          <p className="text-lg text-white/80 max-w-3xl mx-auto">
            Claim your collected revenue directly from IPRoyaltyVault. 
            View your earnings history and manage your IP asset revenue streams.
          </p>
        </div>
        <RevenueClaiming />
      </main>
    </div>
  );
}
