import { defineConfig, loadEnv } from "@wagmi/cli";
import { react } from "@wagmi/cli/plugins";
import routerArtifact from "../artifacts/contracts/SovryRouter.sol/SovryRouter.json" assert { type: "json" };

const env = loadEnv({ mode: process.env.NODE_ENV ?? "development" });

// Story Aeneid chain id
export const STORY_AENEID_CHAIN_ID = 1516;

const routerAddress = (env?.NEXT_PUBLIC_ROUTER_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

export default defineConfig({
  out: "src/generated/wagmi.ts",
  contracts: [
    {
      name: "SovryRouter",
      abi: routerArtifact.abi as any,
      address: {
        [STORY_AENEID_CHAIN_ID]: routerAddress,
      },
    },
  ],
  plugins: [react()],
});
