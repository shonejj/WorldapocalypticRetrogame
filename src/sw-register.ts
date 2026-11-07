/** Register the generated service worker (production only). After one visit the game runs offline. */
export function registerServiceWorker(onReady: (ready: boolean) => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      if (reg.active) onReady(true);
      // this build booted: older offline caches are no longer needed
      navigator.serviceWorker.ready.then((r) => { onReady(true); r.active?.postMessage({ type: 'prune' }); });
    })
      .catch((e) => console.warn('[sw] registration failed', e));
  });
}
