/**
 * app.js
 * Punto de entrada principal (Bootstrap) de la aplicación.
 * Arquitectura MVC en JavaScript ES6+ Modular.
 */

import { AppController } from './controllers/AppController.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Cloudfire Tracker] Inicializando aplicación móvil...');
  const app = new AppController();
  window.cloudfireApp = app;
  window.cloudfireOpenFirebaseModal = () => app.firebaseModalView.open();

  app.init().catch((err) => {
    console.error('[Cloudfire Tracker] Error durante la inicialización:', err);
  });
});

