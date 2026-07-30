export function registerServiceWorker() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/tecnico/',
      })

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            dispatchEvent(new CustomEvent('sw-update-available'))
          }
        })
      })
    } catch (error) {
      console.error('Error registrando Service Worker:', error)
    }
  })
}
