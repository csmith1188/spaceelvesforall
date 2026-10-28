/** Single site process. Game matches are child processes, not sim workers. */

export function workerCount() {
  return 1;
}

export function workerIndex() {
  return 0;
}

export function ownerBase() {
  return "";
}

export function pickLeastLoaded() {
  return 0;
}
