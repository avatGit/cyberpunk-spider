/** Délai de grâce après le démarrage du runtime : l'extension n'a peut-être pas encore écrit son signe de vie. */
export const GRACE_MS = 90_000;
/** Au-delà de ce délai sans signe de vie, on considère l'extension désinstallée/désactivée. */
export const STALE_MS = 10 * 60_000;

/**
 * L'extension est-elle « vivante » ? Elle réécrit un horodatage (`alive`) au démarrage puis toutes les 2 min.
 * Si elle est désinstallée ou désactivée (patch encore présent), le runtime s'arrête de lui-même.
 * `alive == null` (ancien format) ou sondage impossible : on ne cache jamais l'araignée à tort.
 */
export function extensionAlive(now: number, bootAt: number, alive: number | null, pollWorks: boolean): boolean {
  if (alive == null || !pollWorks) return true;
  if (now - bootAt < GRACE_MS) return true;
  return now - alive < STALE_MS;
}
