/** Small built-in disposable / temporary email domain list. */

export const BUILTIN_DISPOSABLE_DOMAINS = Object.freeze([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "10minutemail.com",
  "10minutemail.net",
  "yopmail.com",
  "yopmail.fr",
  "trashmail.com",
  "trashmail.me",
  "discard.email",
  "discardmail.com",
  "mailnesia.com",
  "maildrop.cc",
  "getnada.com",
  "emailondeck.com",
  "throwaway.email",
  "fakeinbox.com",
  "mintemail.com",
  "moakt.com",
  "tmpmail.org",
  "tmpmail.net",
]);

export function emailDomain(email) {
  const s = String(email || "").trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at < 0) return null;
  const domain = s.slice(at + 1).trim();
  return domain || null;
}

export function isDisposableEmail(email, extraDomains = []) {
  const domain = emailDomain(email);
  if (!domain) return false;
  const extras = (extraDomains || []).map((d) => String(d).trim().toLowerCase()).filter(Boolean);
  const set = new Set([...BUILTIN_DISPOSABLE_DOMAINS, ...extras]);
  if (set.has(domain)) return true;
  // Match one subdomain level (mail.tempmail.com → tempmail.com).
  const parts = domain.split(".");
  if (parts.length > 2) {
    const parent = parts.slice(-2).join(".");
    if (set.has(parent)) return true;
  }
  return false;
}
