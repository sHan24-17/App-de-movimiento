/**
 * StorageModel.js
 * Modelo de persistencia híbrida:
 * - Soporte nativo para Firebase Realtime Database (RTDB) y Cloud Firestore.
 * - Sincronización transparente con la nube y persistencia offline garantizada con LocalStorage.
 * - Compatible tanto con protocolo http/https como file:/// (sin bloqueos CORS).
 */

import {
  getSavedFirebaseConfig,
  getDb,
  initializeFirebaseServices,
  isFirebaseConfigValid
} from '../config/firebaseConfig.js';

export const LOCAL_SESSIONS_KEY = 'cloudfire_saved_routes_v1';

export class StorageModel {
  constructor() {
    this.isOnline = navigator.onLine;
    this.hasFirebase = false;
    this.backendType = 'none'; // 'rtdb' | 'firestore' | 'none'
    this.activeRtdbUrl = '';

    // Escuchar cambios de conectividad de red
    window.addEventListener('online', () => { this.isOnline = true; });
    window.addEventListener('offline', () => { this.isOnline = false; });
  }

  /**
   * Obtiene la URL base de Realtime Database para la configuración dada
   * @param {Object} config 
   * @returns {string}
   */
  getRtdbUrl(config = getSavedFirebaseConfig()) {
    if (config?.databaseURL && config.databaseURL.trim() !== '') {
      return config.databaseURL.replace(/\/+$/, '');
    }
    if (config?.projectId && config.projectId.trim() !== '') {
      return `https://${config.projectId}-default-rtdb.firebaseio.com`;
    }
    return 'https://movimiento-en-tiempo-real-default-rtdb.firebaseio.com';
  }

  /**
   * Comprueba y activa la conexión con Firebase (prioriza Realtime Database y Firestore)
   * @returns {Promise<boolean>}
   */
  async checkAndInitFirebase() {
    const config = getSavedFirebaseConfig();
    if (!config) return false;

    // 1. Probar Firebase Realtime Database (activo y público en tu proyecto)
    const rtdbUrl = this.getRtdbUrl(config);
    try {
      const response = await fetch(`${rtdbUrl}/.json?shallow=true`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok || response.status === 200 || response.status === 401) {
        this.hasFirebase = true;
        this.backendType = 'rtdb';
        this.activeRtdbUrl = rtdbUrl;
        console.log('[StorageModel] Conectado exitosamente con Firebase Realtime Database:', rtdbUrl);
        return true;
      }
    } catch (rtdbErr) {
      console.info('[StorageModel] RTDB no respondió, verificando Firestore...');
    }

    // 2. Probar Cloud Firestore si RTDB no estuviera disponible
    try {
      if (isFirebaseConfigValid(config)) {
        const instance = await initializeFirebaseServices();
        if (instance && instance.db) {
          this.hasFirebase = true;
          this.backendType = 'firestore';
          console.log('[StorageModel] Conectado con Cloud Firestore');
          return true;
        }
      }
    } catch (fsErr) {
      console.warn('[StorageModel] Firestore no disponible o deshabilitado en GCP:', fsErr.message);
    }

    this.hasFirebase = false;
    this.backendType = 'none';
    return false;
  }

  /**
   * Prueba una configuración de Firebase en vivo
   * @param {Object} config 
   * @returns {Promise<{ success: boolean, message: string, latencyMs?: number }>}
   */
  async testFirebaseConnection(config) {
    const startTime = Date.now();
    const rtdbUrl = this.getRtdbUrl(config);

    // Prueba 1: Realtime Database
    try {
      const testKey = `_ping_${Date.now()}`;
      const pingUrl = `${rtdbUrl}/_connection_test/${testKey}.json`;

      const writeRes = await fetch(pingUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ping: 'ok', timestamp: Date.now() })
      });

      if (writeRes.ok) {
        // Limpiar ping
        try {
          await fetch(pingUrl, { method: 'DELETE' });
        } catch (_) {}

        const latencyMs = Date.now() - startTime;
        this.hasFirebase = true;
        this.backendType = 'rtdb';
        this.activeRtdbUrl = rtdbUrl;

        return {
          success: true,
          message: `¡Conexión exitosa a Firebase Realtime Database! Proyecto: ${config.projectId || 'activo'}. Latencia: ${latencyMs}ms.`,
          latencyMs
        };
      }
    } catch (_) {}

    // Prueba 2: Cloud Firestore
    try {
      const { initializeApp, deleteApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const { getFirestore, doc, setDoc, getDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

      const tempAppName = 'test_conn_' + Date.now();
      const testApp = initializeApp(config, tempAppName);
      const testDb = getFirestore(testApp);

      const testDocRef = doc(testDb, '_connection_test', 'ping');
      await setDoc(testDocRef, { timestamp: Date.now(), status: 'OK' });
      await deleteDoc(testDocRef);
      await deleteApp(testApp);

      const latencyMs = Date.now() - startTime;
      this.hasFirebase = true;
      this.backendType = 'firestore';

      return {
        success: true,
        message: `¡Conexión exitosa a Cloud Firestore! Latencia: ${latencyMs}ms.`,
        latencyMs
      };
    } catch (err) {
      console.error('[StorageModel] Error al probar conexión de Firebase:', err);
      let errorHelp = err.message;
      if (err.message.includes('SERVICE_DISABLED') || err.message.includes('has not been used')) {
        errorHelp = 'La API de Firestore no está activada en la consola de Firebase. Sin embargo, Realtime Database está disponible.';
      } else if (err.message.includes('permission-denied')) {
        errorHelp = 'Permiso denegado. Revisa las Reglas de tu base de datos en la consola de Firebase (allow read, write: if true).';
      }
      return {
        success: false,
        message: `Error al conectar: ${errorHelp}`
      };
    }
  }

  /**
   * Guarda una sesión completa de ruta tanto en LocalStorage como en Firebase
   * @param {Object} sessionSummary Resumen de ruta producido por TrackingModel
   * @param {Array<Object>} mediaItems Lista de fotos o audios capturados en ruta
   * @returns {Promise<{ id: string, syncedFirebase: boolean }>}
   */
  async saveRouteSession(sessionSummary, mediaItems = []) {
    const sessionId = 'route_' + Date.now();
    const payload = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      summary: sessionSummary,
      mediaCount: mediaItems.length,
      media: mediaItems.map(m => ({
        id: m.id,
        type: m.type,
        dataUrl: m.dataUrl || null,
        audioBlobUrl: m.audioBlobUrl || null,
        location: m.location,
        timestamp: m.timestamp,
        note: m.note || ''
      }))
    };

    // 1. Persistencia local inmediata (resiliencia offline)
    this.saveToLocalStorage(payload);

    // 2. Persistencia en la nube de Firebase si está conectado
    let syncedFirebase = false;

    if (this.hasFirebase && this.isOnline) {
      // Caso A: Firebase Realtime Database
      if (this.backendType === 'rtdb' || this.activeRtdbUrl) {
        try {
          const rtdbUrl = this.activeRtdbUrl || this.getRtdbUrl();
          const targetUrl = `${rtdbUrl}/tracking_sessions/${sessionId}.json`;

          const res = await fetch(targetUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            syncedFirebase = true;
            console.log('[StorageModel] Sesión guardada exitosamente en Firebase Realtime Database:', sessionId);
          }
        } catch (rtdbSaveErr) {
          console.warn('[StorageModel] Fallo guardado en RTDB:', rtdbSaveErr);
        }
      }

      // Caso B: Cloud Firestore
      if (!syncedFirebase && this.backendType === 'firestore') {
        const db = getDb();
        if (db) {
          try {
            const { collection, setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
            const sessionRef = doc(collection(db, 'tracking_sessions'), sessionId);
            await setDoc(sessionRef, payload);
            syncedFirebase = true;
            console.log('[StorageModel] Sesión guardada exitosamente en Cloud Firestore:', sessionId);
          } catch (fsSaveErr) {
            console.warn('[StorageModel] Fallo guardado en Firestore:', fsSaveErr);
          }
        }
      }
    }

    return { id: sessionId, syncedFirebase };
  }

  /**
   * Guarda la sesión en el array de sesiones de LocalStorage
   * @param {Object} payload 
   */
  saveToLocalStorage(payload) {
    try {
      const existing = this.getLocalSessions();
      existing.unshift(payload);
      // Mantener las últimas 30 sesiones en el almacenamiento móvil
      const trimmed = existing.slice(0, 30);
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(trimmed));
    } catch (err) {
      console.error('[StorageModel] Fallo al guardar en LocalStorage:', err);
    }
  }

  /**
   * Obtiene todas las sesiones guardadas localmente
   * @returns {Array<Object>}
   */
  getLocalSessions() {
    try {
      const data = localStorage.getItem(LOCAL_SESSIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.warn('[StorageModel] Error leyendo sesiones locales:', err);
      return [];
    }
  }

  deleteLocalSession(sessionId) {
    return this.deleteSession(sessionId);
  }

  /**
   * Elimina una sesión del historial local y remoto
   * @param {string} sessionId 
   */
  async deleteSession(sessionId) {
    // 1. Eliminar local
    const list = this.getLocalSessions().filter(s => s.id !== sessionId);
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(list));

    // 2. Eliminar remoto si aplica
    if (this.hasFirebase && this.isOnline) {
      if (this.backendType === 'rtdb' || this.activeRtdbUrl) {
        try {
          const rtdbUrl = this.activeRtdbUrl || this.getRtdbUrl();
          await fetch(`${rtdbUrl}/tracking_sessions/${sessionId}.json`, { method: 'DELETE' });
        } catch (_) {}
      }
    }

    return list;
  }

  /**
   * Obtiene sesiones remotas desde Firebase
   * @returns {Promise<Array<Object>>}
   */
  async getRemoteSessions() {
    if (!this.hasFirebase || !this.isOnline) return [];

    if (this.backendType === 'rtdb' || this.activeRtdbUrl) {
      try {
        const rtdbUrl = this.activeRtdbUrl || this.getRtdbUrl();
        const res = await fetch(`${rtdbUrl}/tracking_sessions.json`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            return Object.values(data).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          }
        }
      } catch (err) {
        console.warn('[StorageModel] Error leyendo sesiones remotas de RTDB:', err);
      }
    }

    return [];
  }
}
