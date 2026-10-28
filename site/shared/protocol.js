/** Website build id. Native protocol gating is not used. */
export const PROTOCOL_VERSION = 1;
export const CLIENT_VERSION = "space-elves";

export function parseProtocol(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Always current. Packaged-client version checks are out of scope. */
export function isClientOutdated() {
  return false;
}
