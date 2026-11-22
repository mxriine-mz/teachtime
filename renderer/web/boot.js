// Point d'entrée de la version web : installe window.api, puis lance l'interface commune.
import './web-api.js';
import '../app.js';

// Mode hors ligne et installation sur l'écran d'accueil.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('service worker', e));
}
