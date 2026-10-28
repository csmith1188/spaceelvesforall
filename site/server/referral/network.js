/** Coarse network bucketing for signup velocity (not geo). */

export function networkKeyFromIp(ip) {
  const raw = String(ip || "").trim();
  if (!raw) return null;
  if (raw.includes(":")) {
    // IPv6: use first 4 hextets (/64-ish).
    const cleaned = raw.replace(/^\[|\]$/g, "").toLowerCase();
    const parts = cleaned.split(":");
    if (parts.length < 4) return `v6:${cleaned}`;
    return `v6:${parts.slice(0, 4).join(":")}`;
  }
  const parts = raw.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p))) {
    return `v4:${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  return `raw:${raw.slice(0, 80)}`;
}
