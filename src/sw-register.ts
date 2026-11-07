/** Register the generated service worker (production only). After one visit the game runs offline. */
export function registerServiceWorker(onReady: (ready: boolean) => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => { if (reg.active) onReady(true); navigator.serviceWorker.ready.then(() => onReady(true)); })
      .catch((e) => console.warn('[sw] registration failed', e));
  });
}
