/**
 * Server-authoritative ticket packages (PayPal USD + Digipog costs).
 * Clients may only submit packageId; never trust client prices or ticket counts.
 *
 * Digipog cost uses TICKET_PACK_COST / TICKET_PACK_SIZE as the per-ticket rate
 * (same env knobs as the legacy single Digipog pack).
 */

const PACKAGES = Object.freeze({
  pack_5: Object.freeze({
    id: "pack_5",
    label: "20 tickets",
    amountValue: "5.00",
    currency: "USD",
    tickets: 20,
  }),
  pack_20: Object.freeze({
    id: "pack_20",
    label: "100 tickets",
    amountValue: "20.00",
    currency: "USD",
    tickets: 100,
  }),
  pack_50: Object.freeze({
    id: "pack_50",
    label: "300 tickets",
    amountValue: "50.00",
    currency: "USD",
    tickets: 300,
  }),
});

function digipogUnitRate() {
  const size = Number(process.env.TICKET_PACK_SIZE);
  const cost = Number(process.env.TICKET_PACK_COST);
  const unitSize = Number.isInteger(size) && size > 0 ? size : 5;
  const unitCost = Number.isInteger(cost) && cost > 0 ? cost : 100;
  return unitCost / unitSize;
}

export function digipogsForTickets(tickets) {
  const n = Number(tickets);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.round(n * digipogUnitRate()));
}

export function listPaypalPackages() {
  return Object.values(PACKAGES);
}

export function getPaypalPackage(packageId) {
  const id = String(packageId || "").trim();
  return PACKAGES[id] || null;
}

/** Catalog row with Digipog price filled from env unit rate. */
export function getBuyPackage(packageId) {
  const pack = getPaypalPackage(packageId);
  if (!pack) return null;
  return Object.freeze({
    ...pack,
    digipogs: digipogsForTickets(pack.tickets),
  });
}

export function listBuyPackages() {
  return listPaypalPackages().map((pack) => getBuyPackage(pack.id));
}
