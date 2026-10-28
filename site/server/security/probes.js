/**
 * Common automated-scanner / exploit probe path prefixes.
 * Exact or prefix match against req.path (lowercased).
 */

const PROBE_PREFIXES = Object.freeze([
  "/wp-admin",
  "/wp-login",
  "/wordpress",
  "/phpmyadmin",
  "/pma",
  "/adminer",
  "/graphql",
  "/graphiql",
  "/.env",
  "/.git",
  "/.aws",
  "/actuator",
  "/vendor/phpunit",
  "/cgi-bin",
  "/xmlrpc.php",
  "/manager/html",
  "/solr",
  "/jenkins",
  "/console",
  "/debug/default",
  "/_ignition",
  "/telescope",
  "/server-status",
  "/server-info",
  "/owa",
  "/autodiscover",
  "/hnap1",
  "/boaform",
  "/shell",
  "/eval-stdin",
  "/vendor/laravel",
]);

/** Known MOTL application path prefixes (not treated as "unknown"). */
const APP_PREFIXES = Object.freeze([
  "/games",
  "/play",
  "/play3d",
  "/login",
  "/logout",
  "/signup",
  "/verify",
  "/forgot",
  "/reset",
  "/profile",
  "/account",
  "/buy",
  "/tickets",
  "/scores",
  "/wiki",
  "/rules",
  "/news",
  "/unsubscribe",
  "/admin",
  "/api",
  "/webhooks",
  "/suggest",
  "/suggestion",
  "/css",
  "/js",
  "/img",
  "/shared",
  "/vendor",
  "/bgm",
  "/manifest",
  "/favicon",
  "/icons",
  "/socket.io",
]);

export function isProbePath(pathname) {
  const path = String(pathname || "").toLowerCase().split("?")[0];
  if (!path) return false;
  for (const prefix of PROBE_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}.`)) {
      return true;
    }
  }
  if (/^\/(wp-|xmlrpc|phpmyadmin|pma|eval-stdin)/i.test(path)) return true;
  if (/\.(php|asp|aspx|jsp|cgi)$/i.test(path)) return true;
  return false;
}

export function isKnownAppPath(pathname) {
  const path = String(pathname || "").split("?")[0];
  if (path === "/" || path === "") return true;
  const lower = path.toLowerCase();
  for (const prefix of APP_PREFIXES) {
    if (lower === prefix || lower.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

/** First two path segments for diversity counting, e.g. /a/b/c → /a/b */
export function pathPrefixKey(pathname) {
  const parts = String(pathname || "/").split("?").shift().split("/").filter(Boolean);
  if (!parts.length) return "/";
  return `/${parts.slice(0, 2).join("/").toLowerCase()}`;
}

export { PROBE_PREFIXES, APP_PREFIXES };
