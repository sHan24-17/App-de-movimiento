/**
 * firebaseConfig.js
 * Módulo de configuración e inicialización de Firebase Modular (v10+ / Firestore & Analytics)
 * Proyecto: movimiento-en-tiempo-real
 */

// Clave utilizada en localStorage para persistir credenciales de Firebase
export const FIREBASE_STORAGE_KEY = 'cloudfire_firebase_config_v1';

// Configuración oficial proporcionada por Firebase para tu proyecto
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDrBGSe9uQR31hlFefgbyGAKlZWyJph59E",
  authDomain: "movimiento-en-tiempo-real.firebaseapp.com",
  databaseURL: "https://movimiento-en-tiempo-real-default-rtdb.firebaseio.com",
  projectId: "movimiento-en-tiempo-real",
  storageBucket: "movimiento-en-tiempo-real.firebasestorage.app",
  messagingSenderId: "16486134972",
  appId: "1:16486134972:web:551d6396cbf83dc1684cb9",
  measurementId: "G-FYF5JKY13Z"
};

/**
 * Obtiene la configuración guardada o la predeterminada del proyecto
 * @returns {Object} Configuración activa de Firebase
 */
export function getSavedFirebaseConfig() {
  try {
    const saved = localStorage.getItem(FIREBASE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Si la guardada tiene datos válidos, la usamos
      if (parsed.projectId && parsed.apiKey && parsed.apiKey.trim() !== '') {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('[FirebaseConfig] Error al leer localStorage, usando configuración base:', error);
  }

  // Si no había guardada o estaba vacía, sincronizamos la base en localStorage
  try {
    localStorage.setItem(FIREBASE_STORAGE_KEY, JSON.stringify(DEFAULT_FIREBASE_CONFIG));
  } catch (_) {}

  return { ...DEFAULT_FIREBASE_CONFIG };
}

/**
 * Guarda una nueva configuración de Firebase en localStorage
 * @param {Object} config 
 */
export function saveFirebaseConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuración inválida');
  }
  localStorage.setItem(FIREBASE_STORAGE_KEY, JSON.stringify(config));
}

/**
 * Verifica si los campos mínimos requeridos de Firebase están presentes
 * @param {Object} config 
 * @returns {boolean}
 */
export function isFirebaseConfigValid(config = getSavedFirebaseConfig()) {
  return Boolean(
    config &&
    config.apiKey &&
    config.apiKey.trim() !== '' &&
    config.projectId &&
    config.projectId.trim() !== ''
  );
}

// Variables singleton para las instancias de Firebase
let firebaseAppInstance = null;
let firestoreDbInstance = null;
let firebaseAnalyticsInstance = null;

/**
 * Inicializa Firebase Modular (App, Firestore y Analytics)
 * @returns {Promise<{ app: any, db: any, analytics: any } | null>}
 */
export async function initializeFirebaseServices() {
  const config = getSavedFirebaseConfig();

  if (!isFirebaseConfigValid(config)) {
    console.info('[FirebaseConfig] Firebase no configurado aún.');
    return null;
  }

  try {
    // Importación dinámica de SDKs modulares oficiales vía CDN ESM de Google
    const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

    if (getApps().length === 0) {
      firebaseAppInstance = initializeApp(config);
    } else {
      firebaseAppInstance = getApp();
    }

    firestoreDbInstance = getFirestore(firebaseAppInstance);
    console.log('[FirebaseConfig] Cloud Firestore conectado con éxito para:', config.projectId);

    // Inicializar Analytics opcional si el entorno lo soporta
    if (config.measurementId) {
      try {
        const { getAnalytics, isSupported } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js');
        if (await isSupported()) {
          firebaseAnalyticsInstance = getAnalytics(firebaseAppInstance);
          console.log('[FirebaseConfig] Firebase Analytics inicializado');
        }
      } catch (anErr) {
        console.warn('[FirebaseConfig] Analytics no disponible en este entorno:', anErr.message);
      }
    }

    return {
      app: firebaseAppInstance,
      db: firestoreDbInstance,
      analytics: firebaseAnalyticsInstance
    };
  } catch (err) {
    console.error('[FirebaseConfig] Fallo al inicializar Firebase:', err);
    throw err;
  }
}

/**
 * Obtiene la instancia activa de Firestore
 * @returns {any}
 */
export function getDb() {
  return firestoreDbInstance;
}

/**
 * Obtiene la instancia activa de Firebase App
 * @returns {any}
 */
export function getApp() {
  return firebaseAppInstance;
}
