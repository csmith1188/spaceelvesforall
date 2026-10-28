/**
 * First-party referral attribution cookie (elves.ref) and browser id (elves.bid).
 */

import cookie from "cookie";
import { randomBytes } from "crypto";
import { httpsDeployment } from "../hardening.js";
import {
  BROWSER_ID_COOKIE,
  BROWSER_ID_COOKIE_MAX_AGE_MS,
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE_MS,
} from "./config.js";

function baseCookieOptions(thisUrl, maxAgeMs) {
  return {
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
    sameSite: "lax",
    httpOnly: true,
    secure: httpsDeployment(thisUrl),
  };
}

function parseCookies(req) {
  const header = req && req.headers && req.headers.cookie;
  return header ? cookie.parse(header) : {};
}

export function readReferralCodeCookie(req) {
  const parsed = parseCookies(req);
  const raw = parsed[REFERRAL_COOKIE];
  if (!raw) return null;
  const code = String(raw).trim().toUpperCase();
  return code || null;
}

export function writeReferralCodeCookie(res, code, thisUrl) {
  if (!res || typeof res.append !== "function") return;
  const value = String(code || "").trim().toUpperCase();
  if (!value) return;
  res.append(
    "Set-Cookie",
    cookie.serialize(REFERRAL_COOKIE, value, baseCookieOptions(thisUrl, REFERRAL_COOKIE_MAX_AGE_MS)),
  );
}

export function clearReferralCodeCookie(res, thisUrl) {
  if (!res || typeof res.append !== "function") return;
  res.append(
    "Set-Cookie",
    cookie.serialize(REFERRAL_COOKIE, "", {
      ...baseCookieOptions(thisUrl, 0),
      maxAge: 0,
    }),
  );
}

export function readBrowserIdCookie(req) {
  const parsed = parseCookies(req);
  const raw = parsed[BROWSER_ID_COOKIE];
  if (!raw) return null;
  const id = String(raw).trim();
  if (!/^[a-f0-9]{32,64}$/i.test(id)) return null;
  return id.toLowerCase();
}

export function ensureBrowserIdCookie(req, res, thisUrl) {
  const existing = readBrowserIdCookie(req);
  if (existing) return existing;
  const id = randomBytes(16).toString("hex");
  if (res && typeof res.append === "function") {
    res.append(
      "Set-Cookie",
      cookie.serialize(BROWSER_ID_COOKIE, id, baseCookieOptions(thisUrl, BROWSER_ID_COOKIE_MAX_AGE_MS)),
    );
  }
  return id;
}
