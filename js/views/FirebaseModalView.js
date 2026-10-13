/**
 * FirebaseModalView.js
 * Vista del Patrón MVC para guiar y conectar Firebase interactivamente:
 * - Guía paso a paso integrada con instrucciones visuales.
 * - Auto-detección y parseo inteligente de fragmentos pegados desde la consola de Firebase.
 * - Prueba de conectividad en vivo con diagnóstico de errores amigable.
 * - Accesibilidad WCAG 2.1 AA (atributos ARIA, foco accesible y retroalimentación clara).
 */

import { getSavedFirebaseConfig, saveFirebaseConfig, isFirebaseConfigValid } from '../config/firebaseConfig.js';

export class FirebaseModalView {
  constructor(storageModel, onConnectedCallback) {
    this.storageModel = storageModel;
    this.onConnectedCallback = onConnectedCallback;

    // Elementos del DOM
    this.modal = document.getElementById('firebase-modal');
    this.btnClose = document.getElementById('btn-close-firebase-modal');
    this.btnSave = document.getElementById('btn-save-firebase');
    this.btnTest = document.getElementById('btn-test-firebase');
    this.connectionResultAlert = document.getElementById('firebase-test-result');

    // Campos del formulario
    this.inputApiKey = document.getElementById('fb-api-key');
    this.inputAuthDomain = document.getElementById('fb-auth-domain');
    this.inputProjectId = document.getElementById('fb-project-id');
    this.inputStorageBucket = document.getElementById('fb-storage-bucket');
    this.inputMessagingSenderId = document.getElementById('fb-messaging-sender-id');
    this.inputAppId = document.getElementById('fb-app-id');
    this.pasteRawConfigArea = document.getElementById('fb-paste-raw');

    this.initEventListeners();
  }

  initEventListeners() {
    this.btnClose?.addEventListener('click', () => this.close());
    this.btnSave?.addEventListener('click', () => this.handleSave());
    this.btnTest?.addEventListener('click', () => this.handleTestConnection());

    // Parser inteligente: si el usuario pega todo el objeto `const firebaseConfig = { ... }`
    this.pasteRawConfigArea?.addEventListener('input', (e) => {
      this.parsePastedSnippet(e.target.value);
    });
  }

  /**
   * Abre el modal y carga los datos actuales si existen
   */
  open() {
    if (!this.modal) return;
    this.modal.classList.remove('hidden');
    this.modal.style.display = 'flex';
    this.modal.setAttribute('aria-hidden', 'false');

    // Cargar credenciales guardadas en los inputs
    const currentConfig = getSavedFirebaseConfig();
    if (this.inputApiKey) this.inputApiKey.value = currentConfig.apiKey || '';
    if (this.inputAuthDomain) this.inputAuthDomain.value = currentConfig.authDomain || '';
    if (this.inputProjectId) this.inputProjectId.value = currentConfig.projectId || '';
    if (this.inputStorageBucket) this.inputStorageBucket.value = currentConfig.storageBucket || '';
    if (this.inputMessagingSenderId) this.inputMessagingSenderId.value = currentConfig.messagingSenderId || '';
    if (this.inputAppId) this.inputAppId.value = currentConfig.appId || '';

    if (this.connectionResultAlert) {
      this.connectionResultAlert.classList.add('hidden');
      this.connectionResultAlert.style.display = 'none';
      this.connectionResultAlert.textContent = '';
    }

    try {
      this.inputProjectId?.focus();
    } catch (_) {}
  }

  /**
   * Cierra el modal
   */
  close() {
    if (!this.modal) return;
    this.modal.classList.add('hidden');
    this.modal.style.display = 'none';
    this.modal.setAttribute('aria-hidden', 'true');
  }


  /**
   * Extrae claves si el usuario pega código JS directo de la consola de Firebase
   * @param {string} text 
   */
  parsePastedSnippet(text) {
    if (!text || text.trim() === '') return;

    try {
      const extractField = (fieldName) => {
        const regex = new RegExp(`['"]?${fieldName}['"]?\\s*:\\s*['"]([^'"]+)['"]`, 'i');
        const match = text.match(regex);
        return match ? match[1] : '';
      };

      const apiKey = extractField('apiKey');
      const authDomain = extractField('authDomain');
      const projectId = extractField('projectId');
      const storageBucket = extractField('storageBucket');
      const messagingSenderId = extractField('messagingSenderId');
      const appId = extractField('appId');

      if (apiKey && this.inputApiKey) this.inputApiKey.value = apiKey;
      if (authDomain && this.inputAuthDomain) this.inputAuthDomain.value = authDomain;
      if (projectId && this.inputProjectId) this.inputProjectId.value = projectId;
      if (storageBucket && this.inputStorageBucket) this.inputStorageBucket.value = storageBucket;
      if (messagingSenderId && this.inputMessagingSenderId) this.inputMessagingSenderId.value = messagingSenderId;
      if (appId && this.inputAppId) this.inputAppId.value = appId;

      if (projectId) {
        this.showResultBadge(true, `¡Datos extraídos automáticamente para el proyecto "${projectId}"! Ahora puedes pulsar "Probar Conexión".`);
      }
    } catch (err) {
      console.warn('[FirebaseModalView] Error al auto-parsear snippet:', err);
    }
  }

  /**
   * Reúne la configuración desde los campos del formulario
   * @returns {Object}
   */
  getFormConfig() {
    return {
      apiKey: this.inputApiKey?.value.trim() || '',
      authDomain: this.inputAuthDomain?.value.trim() || '',
      projectId: this.inputProjectId?.value.trim() || '',
      storageBucket: this.inputStorageBucket?.value.trim() || '',
      messagingSenderId: this.inputMessagingSenderId?.value.trim() || '',
      appId: this.inputAppId?.value.trim() || ''
    };
  }

  /**
   * Prueba la conexión en vivo con Cloud Firestore
   */
  async handleTestConnection() {
    const config = this.getFormConfig();

    if (!config.apiKey || !config.projectId) {
      this.showResultBadge(false, 'Por favor completa al menos el "Project ID" y la "API Key".');
      return;
    }

    if (this.btnTest) {
      this.btnTest.disabled = true;
      this.btnTest.textContent = '⏳ Probando conexión...';
    }

    this.showResultBadge(true, 'Conectando a Firebase Firestore y verificando permisos...', 'info');

    const result = await this.storageModel.testFirebaseConnection(config);

    if (this.btnTest) {
      this.btnTest.disabled = false;
      this.btnTest.textContent = '🔍 Probar Conexión';
    }

    if (result.success) {
      this.showResultBadge(true, `✅ ${result.message}`);
    } else {
      this.showResultBadge(false, `❌ ${result.message}`);
    }
  }

  /**
   * Guarda la configuración e inicializa Firebase
   */
  async handleSave() {
    const config = this.getFormConfig();

    if (!isFirebaseConfigValid(config)) {
      this.showResultBadge(false, 'Configuración incompleta: Se requiere apiKey y projectId.');
      return;
    }

    try {
      saveFirebaseConfig(config);
      const isConnected = await this.storageModel.checkAndInitFirebase();

      if (this.onConnectedCallback) {
        this.onConnectedCallback(isConnected, config.projectId);
      }

      this.showResultBadge(true, 'Configuración guardada exitosamente.');
      setTimeout(() => {
        this.close();
      }, 1200);
    } catch (err) {
      this.showResultBadge(false, `Error al inicializar: ${err.message}`);
    }
  }

  /**
   * Muestra el mensaje de estado en el modal
   * @param {boolean} isSuccess 
   * @param {string} message 
   * @param {'success'|'error'|'info'} type 
   */
  showResultBadge(isSuccess, message, type = isSuccess ? 'success' : 'error') {
    if (!this.connectionResultAlert) return;

    this.connectionResultAlert.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-800', 'border-emerald-300', 'bg-rose-50', 'text-rose-800', 'border-rose-300', 'bg-blue-50', 'text-blue-800', 'border-blue-300');

    if (type === 'info') {
      this.connectionResultAlert.classList.add('bg-blue-50', 'text-blue-800', 'border-blue-300');
    } else if (isSuccess) {
      this.connectionResultAlert.classList.add('bg-emerald-50', 'text-emerald-800', 'border-emerald-300');
    } else {
      this.connectionResultAlert.classList.add('bg-rose-50', 'text-rose-800', 'border-rose-300');
    }

    this.connectionResultAlert.textContent = message;
  }
}
