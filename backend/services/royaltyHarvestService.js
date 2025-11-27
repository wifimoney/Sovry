const { ethers } = require('ethers');

const RPC_PROVIDER_URL = process.env.RPC_PROVIDER_URL || process.env.AENEID_RPC_URL || 'https://aeneid.storyrpc.io';
const LAUNCHPAD_ADDRESS = process.env.SOVRY_LAUNCHPAD_ADDRESS;
const HARVEST_PRIVATE_KEY = process.env.HARVESTER_PRIVATE_KEY || process.env.PRIVATE_KEY;

const LAUNCHPAD_ABI = [
  'function getAllLaunchedTokens() view returns (address[])',
  'function harvestAndPump(address wrapperToken, address ancestorIpId, address[] childIpIds, address[] royaltyPolicies, address[] currencyTokens) external',
];

let provider;
let signer;

function getProvider() {
  if (!provider) {
    provider = new ethers.providers.JsonRpcProvider(RPC_PROVIDER_URL);
  }
  return provider;
}

function getSigner() {
  if (!signer) {
    const p = getProvider();
    if (!HARVEST_PRIVATE_KEY) {
      throw new Error('HARVESTER_PRIVATE_KEY or PRIVATE_KEY is not set in environment');
    }
    signer = new ethers.Wallet(HARVEST_PRIVATE_KEY, p);
  }
  return signer;
}

function getRoyaltyParams() {
  const ancestorIpId = process.env.ROYALTY_ANCESTOR_IP_ID;
  const childIpIds = process.env.ROYALTY_CHILD_IP_IDS
    ? process.env.ROYALTY_CHILD_IP_IDS.split(',').map((a) => a.trim()).filter(Boolean)
    : [];
  const royaltyPolicies = process.env.ROYALTY_POLICIES
    ? process.env.ROYALTY_POLICIES.split(',').map((a) => a.trim()).filter(Boolean)
    : [];
  const currencyTokens = process.env.ROYALTY_CURRENCY_TOKENS
    ? process.env.ROYALTY_CURRENCY_TOKENS.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  return {
    ancestorIpId,
    childIpIds,
    royaltyPolicies,
    currencyTokens,
  };
}

async function runRoyaltyHarvestCycle() {
  try {
    if (!LAUNCHPAD_ADDRESS) {
      console.warn('[HARVEST] SOVRY_LAUNCHPAD_ADDRESS is not set; skipping harvest cycle');
      return { success: false, error: 'SOVRY_LAUNCHPAD_ADDRESS not set' };
    }

    const { ancestorIpId, childIpIds, royaltyPolicies, currencyTokens } = getRoyaltyParams();

    if (!ancestorIpId || currencyTokens.length === 0) {
      console.warn('[HARVEST] Royalty parameters are not fully configured; skipping harvest cycle');
      return { success: false, error: 'Royalty parameters not configured' };
    }

    const s = getSigner();
    const p = getProvider();

    const contract = new ethers.Contract(LAUNCHPAD_ADDRESS, LAUNCHPAD_ABI, s);

    console.log('[HARVEST] Fetching all launched tokens from SovryLaunchpad');
    const tokens = await contract.getAllLaunchedTokens();

    if (!tokens || tokens.length === 0) {
      console.log('[HARVEST] No launched tokens found; nothing to harvest');
      return { success: true, processed: 0, harvested: 0, skipped: 0 };
    }

    const gasPrice = await p.getGasPrice();

    let processed = 0;
    let harvested = 0;
    let skipped = 0;

    for (const wrapperToken of tokens) {
      processed += 1;
      try {
        console.log(`[HARVEST] Checking token ${wrapperToken}`);

        const gasEstimate = await contract.estimateGas.harvestAndPump(
          wrapperToken,
          ancestorIpId,
          childIpIds,
          royaltyPolicies,
          currencyTokens,
        );

        const gasCost = gasEstimate.mul(gasPrice);
        console.log(
          `[HARVEST] Estimated gas for harvestAndPump on ${wrapperToken}: ${gasEstimate.toString()} (cost wei: ${gasCost.toString()})`,
        );

        const tx = await contract.harvestAndPump(
          wrapperToken,
          ancestorIpId,
          childIpIds,
          royaltyPolicies,
          currencyTokens,
          {
            gasLimit: gasEstimate.mul(110).div(100),
          },
        );

        console.log(`[HARVEST] Sent harvestAndPump tx for ${wrapperToken}: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(
          `[HARVEST] Harvest tx confirmed for ${wrapperToken}: status=${receipt.status}, gasUsed=${receipt.gasUsed.toString()}`,
        );

        harvested += 1;
      } catch (error) {
        skipped += 1;
        console.warn(
          `[HARVEST] Skipping token ${wrapperToken} due to error (likely no royalties or invalid params):`,
          error && error.message ? error.message : error,
        );
      }
    }

    console.log(
      `[HARVEST] Harvest cycle completed. processed=${processed}, harvested=${harvested}, skipped=${skipped}`,
    );

    return { success: true, processed, harvested, skipped };
  } catch (error) {
    console.error('[HARVEST] Error in royalty harvest cycle:', error);
    return {
      success: false,
      error: error && error.message ? error.message : 'Unknown error in harvest cycle',
    };
  }
}

module.exports = {
  runRoyaltyHarvestCycle,
};
