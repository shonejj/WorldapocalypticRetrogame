/** Registers the generated service worker (production builds only). After the
 *  first visit every file is cached, so the game loads and runs fully offline. */
export function registerServiceWorker(onReady: (offlineReady: boolean) => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      if (reg.active) onReady(true);
      navigator.serviceWorker.ready.then(() => onReady(true));
    }).catch((err) => console.warn('[sw] registration failed', err));
  });
}
