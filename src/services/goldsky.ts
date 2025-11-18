import { GraphQLClient, gql } from "graphql-request";
import CircuitBreaker from "opossum";
import { cacheGet, cacheSet } from "../config/redis";

const GOLDKSY_ENDPOINT = process.env.GOLDSKY_ENDPOINT || "";
if (!GOLDKSY_ENDPOINT) {
  console.warn("GOLDSKY_ENDPOINT is not set. Goldsky requests will fail until configured.");
}

const GOLDKSY_API_KEY = process.env.GOLDSKY_API_KEY;

const graphClient = new GraphQLClient(GOLDKSY_ENDPOINT, {
  headers: GOLDKSY_API_KEY ? { "x-api-key": GOLDKSY_API_KEY } : undefined,
});

type GoldskyPayload = {
  query: string;
  variables?: Record<string, unknown>;
};

const breaker = new CircuitBreaker(
  async (...args: [GoldskyPayload]) => {
    const [{ query, variables }] = args;
    return graphClient.request(query, variables);
  },
  {
    timeout: Number(process.env.GOLDSKY_TIMEOUT_MS || 5000),
    errorThresholdPercentage: 50,
    resetTimeout: Number(process.env.GOLDSKY_RESET_TIMEOUT_MS || 30000),
  }
);

/**
 * Executes a GraphQL query through Goldsky with circuit breaker & Redis fallback.
 */
export async function goldskyRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  cacheKey?: string,
  staleTtlSeconds = 300
): Promise<T> {
  try {
    const result = (await breaker.fire({ query, variables })) as T;
    if (cacheKey) {
      await cacheSet(cacheKey, result, staleTtlSeconds);
    }
    return result;
  } catch (error) {
    if (cacheKey) {
      const cached = await cacheGet<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }
    throw error;
  }
}

export { gql };
