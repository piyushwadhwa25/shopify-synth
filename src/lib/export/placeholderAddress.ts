import { createRNG, nextInt, pickOne } from "../core/rng";

/** House / flat label prefixes for Indian-style street lines. */
const HOUSE_PREFIXES = ["House", "Flat", "Plot", "Villa"];

/** Generic road / locality names used in synthesized street lines. */
const ROAD_NAMES = [
  "MG Road",
  "Station Road",
  "Nehru Nagar",
  "Link Road",
  "Gandhi Road",
  "Park Street",
  "Main Road",
  "Ring Road",
];

/**
 * Builds a deterministic placeholder street line for a customer.
 * Same `customerId` always yields the same string (e.g. `"House 42, MG Road"`),
 * so billing/shipping street stay stable across that customer's orders.
 *
 * @param customerId - Shopify customer id used as the RNG seed.
 */
export function synthesizeStreetLine(customerId: number): string {
  const rng = createRNG(customerId);
  const prefix = pickOne(rng, HOUSE_PREFIXES);
  const houseNumber = nextInt(rng, 1, 999);
  const road = pickOne(rng, ROAD_NAMES);
  return `${prefix} ${houseNumber}, ${road}`;
}
