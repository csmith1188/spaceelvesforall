export const LOBBY_PASSWORD_MAX = 32;

export const MATCH_TYPES = Object.freeze([
  { id: "ForHonorMP", label: "For Honor", seats: 2 },
  { id: "ForEver", label: "For Ever", seats: 4 },
]);

export function normalizeLobbyPassword(raw) {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  return s.slice(0, LOBBY_PASSWORD_MAX);
}

export function defaultMatchOptions() {
  return { matchType: "ForHonorMP" };
}

export function normalizeMatchOptions(raw) {
  const id = raw && raw.matchType === "ForEver" ? "ForEver" : "ForHonorMP";
  return { matchType: id };
}

export function matchTypeSeats(matchType) {
  return matchType === "ForEver" ? 4 : 2;
}

export function matchOptionsSummary(opts) {
  const o = normalizeMatchOptions(opts || {});
  const row = MATCH_TYPES.find((t) => t.id === o.matchType) || MATCH_TYPES[0];
  return {
    matchType: row.id,
    matchLabel: row.label,
    seats: row.seats,
    mapLabel: row.label,
    layoutLabel: row.id === "ForEver" ? "Co-op" : "Duel",
    speedLabel: "—",
    fogEnabled: false,
    fortsEnabled: false,
    baseGps: null,
  };
}
