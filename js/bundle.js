(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // pag cloudfire/js/models/TrackingModel.js
  var TrackingModel = class {
    constructor() {
      this.RADIO_TIERRA_METROS = 63710088e-1;
      this.isTracking = false;
      this.isPaused = false;
      this.isReversed = false;
      this.startTime = null;
      this.pausedTime = null;
      this.totalPausedDuration = 0;
      this.totalDistanceMeters = 0;
      this.currentSpeedKmh = 0;
      this.averageSpeedKmh = 0;
      this.maxSpeedKmh = 0;
      this.currentLocation = null;
      this.previousLocation = null;
      this.pathHistory = [];
      this.destination = null;
      this.etaSeconds = null;
      this.MAX_ACCURACY_THRESHOLD_METERS = 35;
      this.MIN_MOVEMENT_DELTA_METERS = 2;
      this.listeners = [];
    }
    /**
     * Suscribe una función para escuchar cambios del modelo
     * @param {Function} callback 
     */
    subscribe(callback) {
      this.listeners.push(callback);
    }
    /**
     * Notifica a todos los observadores registrados
     * @param {string} eventName 
     * @param {Object} data 
     */
    notify(eventName, data = {}) {
      this.listeners.forEach((listener) => {
        try {
          listener(eventName, { model: this, ...data });
        } catch (err) {
          console.error("[TrackingModel] Error en listener:", err);
        }
      });
    }
    /**
     * Inicia o reanuda el rastreo
     */
    start() {
      if (!this.isTracking) {
        this.isTracking = true;
        this.isPaused = false;
        this.startTime = Date.now();
        this.totalPausedDuration = 0;
        this.notify("trackingStarted");
      } else if (this.isPaused) {
        this.resume();
      }
    }
    /**
     * Pausa el rastreo temporalmente
     */
    pause() {
      if (this.isTracking && !this.isPaused) {
        this.isPaused = true;
        this.pausedTime = Date.now();
        this.notify("trackingPaused");
      }
    }
    /**
     * Reanuda el rastreo tras una pausa
     */
    resume() {
      if (this.isTracking && this.isPaused) {
        this.isPaused = false;
        if (this.pausedTime) {
          this.totalPausedDuration += Date.now() - this.pausedTime;
          this.pausedTime = null;
        }
        this.notify("trackingResumed");
      }
    }
    /**
     * Detiene el rastreo y consolida la ruta
     */
    stop() {
      if (this.isTracking) {
        this.isTracking = false;
        this.isPaused = false;
        this.notify("trackingStopped", {
          summary: this.getSummary()
        });
      }
    }
    /**
     * Reinicia todos los valores para una nueva sesión
     */
    reset() {
      this.isTracking = false;
      this.isPaused = false;
      this.isReversed = false;
      this.startTime = null;
      this.pausedTime = null;
      this.totalPausedDuration = 0;
      this.totalDistanceMeters = 0;
      this.currentSpeedKmh = 0;
      this.averageSpeedKmh = 0;
      this.maxSpeedKmh = 0;
      this.currentLocation = null;
      this.previousLocation = null;
      this.pathHistory = [];
      this.destination = null;
      this.etaSeconds = null;
      this.notify("trackingReset");
    }
    /**
     * Procesa una lectura cruda de la API de Geolocalización con filtros de alta exactitud
     * @param {GeolocationPosition} position 
     * @returns {boolean} True si la posición fue admitida por los filtros de exactitud
     */
    processRawPosition(position) {
      const coords = position.coords;
      const timestamp = position.timestamp || Date.now();
      const rawAccuracy = coords.accuracy || 999;
      if (rawAccuracy > this.MAX_ACCURACY_THRESHOLD_METERS && this.pathHistory.length > 2) {
        console.warn(`[TrackingModel] Descartada lectura por baja exactitud: \xB1${rawAccuracy.toFixed(1)}m`);
        return false;
      }
      const currentLat = coords.latitude;
      const currentLng = coords.longitude;
      let heading = coords.heading;
      if (heading === null || isNaN(heading) || heading < 0) {
        if (this.previousLocation) {
          heading = this.calculateBearing(
            this.previousLocation.lat,
            this.previousLocation.lng,
            currentLat,
            currentLng
          );
        } else {
          heading = 0;
        }
      }
      const newLocation = {
        lat: currentLat,
        lng: currentLng,
        accuracy: rawAccuracy,
        altitude: coords.altitude || 0,
        speed: coords.speed !== null && !isNaN(coords.speed) ? Math.max(0, coords.speed) : 0,
        heading,
        timestamp
      };
      if (!this.isTracking) {
        this.currentLocation = newLocation;
        this.notify("locationUpdated", { location: newLocation, deltaDistance: 0 });
        return true;
      }
      if (this.isPaused) {
        this.currentLocation = newLocation;
        this.notify("locationUpdated", { location: newLocation, deltaDistance: 0 });
        return true;
      }
      if (!this.previousLocation) {
        this.previousLocation = newLocation;
        this.currentLocation = newLocation;
        this.pathHistory.push(newLocation);
        this.notify("locationUpdated", { location: newLocation, deltaDistance: 0 });
        return true;
      }
      const deltaDistance = this.calculateHaversineDistance(
        this.previousLocation.lat,
        this.previousLocation.lng,
        currentLat,
        currentLng
      );
      if (deltaDistance < this.MIN_MOVEMENT_DELTA_METERS) {
        this.currentSpeedKmh = 0;
        this.currentLocation = newLocation;
        this.notify("locationUpdated", { location: newLocation, deltaDistance: 0 });
        return false;
      }
      this.totalDistanceMeters += deltaDistance;
      let speedMps = newLocation.speed;
      const timeDeltaSeconds = (timestamp - this.previousLocation.timestamp) / 1e3;
      if ((speedMps === 0 || isNaN(speedMps)) && timeDeltaSeconds > 0) {
        speedMps = deltaDistance / timeDeltaSeconds;
      }
      this.currentSpeedKmh = Math.max(0, speedMps * 3.6);
      if (this.currentSpeedKmh > this.maxSpeedKmh) {
        this.maxSpeedKmh = this.currentSpeedKmh;
      }
      const elapsedSeconds = this.getElapsedSeconds();
      if (elapsedSeconds > 0) {
        this.averageSpeedKmh = this.totalDistanceMeters / elapsedSeconds * 3.6;
      }
      this.previousLocation = newLocation;
      this.currentLocation = newLocation;
      this.pathHistory.push(newLocation);
      this.recalculateEta();
      this.notify("locationUpdated", {
        location: newLocation,
        deltaDistance
      });
      return true;
    }
    /**
     * Fórmula Geodésica de Haversine con precisión milimétrica
     * @param {number} lat1 
     * @param {number} lon1 
     * @param {number} lat2 
     * @param {number} lon2 
     * @returns {number} Distancia en metros
     */
    calculateHaversineDistance(lat1, lon1, lat2, lon2) {
      const toRad = (angle) => angle * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const rLat1 = toRad(lat1);
      const rLat2 = toRad(lat2);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return this.RADIO_TIERRA_METROS * c;
    }
    /**
     * Calcula el rumbo o ángulo azimutal en grados (0 a 360) entre dos puntos geográficos
     * @param {number} lat1 
     * @param {number} lon1 
     * @param {number} lat2 
     * @param {number} lon2 
     * @returns {number} Ángulo en grados
     */
    calculateBearing(lat1, lon1, lat2, lon2) {
      const toRad = (angle) => angle * Math.PI / 180;
      const toDeg = (angle) => angle * 180 / Math.PI;
      const rLat1 = toRad(lat1);
      const rLat2 = toRad(lat2);
      const dLon = toRad(lon2 - lon1);
      const y = Math.sin(dLon) * Math.cos(rLat2);
      const x = Math.cos(rLat1) * Math.sin(rLat2) - Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);
      let brng = toDeg(Math.atan2(y, x));
      return (brng + 360) % 360;
    }
    /**
     * Establece un destino manual para calcular distancia y tiempo estimado (ETA)
     * @param {number} lat 
     * @param {number} lng 
     * @param {string} name 
     */
    setDestination(lat, lng, name = "Destino seleccionado") {
      this.destination = { lat, lng, name };
      this.recalculateEta();
      this.notify("destinationUpdated", { destination: this.destination, etaSeconds: this.etaSeconds });
    }
    /**
     * Limpia el destino seleccionado
     */
    clearDestination() {
      this.destination = null;
      this.etaSeconds = null;
      this.notify("destinationCleared");
    }
    /**
     * Alterna el Modo Reversible:
     * Permite invertir el trayecto recorrido para guiar al usuario de regreso
     * por los mismos puntos exactos hasta el punto de inicio original.
     */
    toggleReverseMode() {
      if (this.pathHistory.length < 2) {
        throw new Error("Se requieren al menos 2 puntos registrados para invertir la ruta.");
      }
      this.isReversed = !this.isReversed;
      if (this.isReversed) {
        const originPoint = this.pathHistory[0];
        this.destination = {
          lat: originPoint.lat,
          lng: originPoint.lng,
          name: "Punto de Inicio (Ruta Inversa)"
        };
      }
      this.recalculateEta();
      this.notify("reverseModeToggled", {
        isReversed: this.isReversed,
        reversePath: this.getReversedPath(),
        destination: this.destination,
        etaSeconds: this.etaSeconds
      });
      return this.isReversed;
    }
    /**
     * Devuelve la lista de puntos invertida (desde el más reciente hasta el punto cero)
     * @returns {Array<Object>}
     */
    getReversedPath() {
      return [...this.pathHistory].reverse();
    }
    /**
     * Deshace el último punto de la ruta registrada (mecanismo reversible / undo)
     */
    undoLastPoint() {
      if (this.pathHistory.length <= 1) {
        return false;
      }
      const removed = this.pathHistory.pop();
      let recalculateTotal = 0;
      for (let i = 1; i < this.pathHistory.length; i++) {
        recalculateTotal += this.calculateHaversineDistance(
          this.pathHistory[i - 1].lat,
          this.pathHistory[i - 1].lng,
          this.pathHistory[i].lat,
          this.pathHistory[i].lng
        );
      }
      this.totalDistanceMeters = recalculateTotal;
      this.previousLocation = this.pathHistory[this.pathHistory.length - 1];
      this.recalculateEta();
      this.notify("pointUndone", { removed, currentCount: this.pathHistory.length });
      return true;
    }
    /**
     * Recalcula el ETA (Tiempo estimado de llegada)
     * Si la velocidad actual es baja, utiliza la velocidad promedio o un ritmo a pie seguro (4.5 km/h)
     */
    recalculateEta() {
      if (!this.destination || !this.currentLocation) {
        this.etaSeconds = null;
        return;
      }
      const remainingDistanceMeters = this.calculateHaversineDistance(
        this.currentLocation.lat,
        this.currentLocation.lng,
        this.destination.lat,
        this.destination.lng
      );
      let effectiveSpeedMps = this.currentSpeedKmh / 3.6;
      if (effectiveSpeedMps < 0.5) {
        effectiveSpeedMps = this.averageSpeedKmh / 3.6;
      }
      if (effectiveSpeedMps < 0.5) {
        effectiveSpeedMps = 1.25;
      }
      this.etaSeconds = Math.round(remainingDistanceMeters / effectiveSpeedMps);
    }
    /**
     * Devuelve los segundos reales transcurridos descontando pausas
     * @returns {number}
     */
    getElapsedSeconds() {
      if (!this.startTime) return 0;
      const now = this.isPaused ? this.pausedTime : Date.now();
      const elapsedMs = now - this.startTime - this.totalPausedDuration;
      return Math.max(0, Math.floor(elapsedMs / 1e3));
    }
    /**
     * Obtiene la distancia restante al destino actual (en metros)
     * @returns {number|null}
     */
    getRemainingDistanceMeters() {
      if (!this.destination || !this.currentLocation) return null;
      return this.calculateHaversineDistance(
        this.currentLocation.lat,
        this.currentLocation.lng,
        this.destination.lat,
        this.destination.lng
      );
    }
    /**
     * Retorna un resumen estructurado de la sesión para persistencia
     * @returns {Object}
     */
    getSummary() {
      return {
        startTime: this.startTime,
        endTime: Date.now(),
        elapsedSeconds: this.getElapsedSeconds(),
        totalDistanceMeters: Math.round(this.totalDistanceMeters * 100) / 100,
        totalDistanceKm: Math.round(this.totalDistanceMeters / 1e3 * 100) / 100,
        averageSpeedKmh: Math.round(this.averageSpeedKmh * 10) / 10,
        maxSpeedKmh: Math.round(this.maxSpeedKmh * 10) / 10,
        pointsCount: this.pathHistory.length,
        isReversed: this.isReversed,
        path: this.pathHistory.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          altitude: p.altitude,
          speed: p.speed,
          accuracy: p.accuracy,
          heading: p.heading,
          timestamp: p.timestamp
        }))
      };
    }
  };

  // pag cloudfire/js/models/MediaModel.js
  var MediaModel = class {
    constructor() {
      this.cameraStream = null;
      this.mediaRecorder = null;
      this.audioChunks = [];
      this.isRecordingAudio = false;
      this.mediaItems = [];
      this.audioCtx = null;
    }
    /**
     * Inicializa de forma perezosa el contexto Web Audio
     */
    getAudioContext() {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    }
    /**
     * Genera un tono acústico asistivo (WCAG 2.1 AA)
     * @param {number} frequency Frecuencia en Hertz
     * @param {number} duration Duración en segundos
     * @param {'sine'|'triangle'|'square'} type 
     */
    playTone(frequency = 440, duration = 0.2, type = "sine") {
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {
        console.warn("[MediaModel] No se pudo reproducir tono asistivo:", e);
      }
    }
    /**
     * Sonido asistivo de inicio de viaje
     */
    playStartChime() {
      this.playTone(523.25, 0.15);
      setTimeout(() => this.playTone(659.25, 0.15), 120);
      setTimeout(() => this.playTone(783.99, 0.25), 240);
    }
    /**
     * Sonido asistivo de detención de viaje
     */
    playStopChime() {
      this.playTone(783.99, 0.15);
      setTimeout(() => this.playTone(659.25, 0.15), 120);
      setTimeout(() => this.playTone(523.25, 0.25), 240);
    }
    /**
     * Sonido de punto de interés capturado
     */
    playSnapshotChime() {
      this.playTone(880, 0.12, "triangle");
    }
    /**
     * Inicia la cámara trasera preferentemente (dispositivo móvil)
     * @param {HTMLVideoElement} videoElement Elemento de video receptor
     * @returns {Promise<MediaStream>}
     */
    async startCamera(videoElement) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("La API MediaDevices no es soportada por este navegador.");
      }
      this.stopCamera();
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          // Cámara trasera ideal para fotos en camino
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoElement) {
          videoElement.srcObject = this.cameraStream;
          await videoElement.play();
        }
        return this.cameraStream;
      } catch (err) {
        console.warn("[MediaModel] Fallo c\xE1mara trasera, intentando cualquier c\xE1mara:", err);
        this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoElement) {
          videoElement.srcObject = this.cameraStream;
          await videoElement.play();
        }
        return this.cameraStream;
      }
    }
    /**
     * Detiene los tracks de la cámara
     */
    stopCamera() {
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach((track) => track.stop());
        this.cameraStream = null;
      }
    }
    /**
     * Captura una foto desde el stream de video con marca de agua geotagueada
     * @param {HTMLVideoElement} videoElement 
     * @param {Object} currentLocation { lat, lng, speed, accuracy, timestamp }
     * @param {string} userNote Nota textual opcional
     * @returns {Object} Información de la foto guardada
     */
    capturePhotoFromVideo(videoElement, currentLocation, userNote = "") {
      if (!videoElement || videoElement.videoWidth === 0) {
        throw new Error("El stream de video no est\xE1 listo para captura.");
      }
      const canvas = document.createElement("canvas");
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      if (currentLocation) {
        const bannerHeight = 44;
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
        ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        const geoText = `GPS: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)} | \xB1${currentLocation.accuracy.toFixed(1)}m`;
        const timeText = (/* @__PURE__ */ new Date()).toLocaleTimeString();
        ctx.fillText(`${geoText} - ${timeText}`, 14, canvas.height - 16);
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const mediaItem = {
        id: "photo_" + Date.now(),
        type: "photo",
        dataUrl,
        location: currentLocation ? { ...currentLocation } : null,
        timestamp: Date.now(),
        note: userNote || "Evidencia fotogr\xE1fica en ruta"
      };
      this.mediaItems.push(mediaItem);
      this.playSnapshotChime();
      return mediaItem;
    }
    /**
     * Inicia la grabación de un memo de voz geotagueado con la API MediaRecorder
     * @returns {Promise<boolean>}
     */
    async startAudioRecording() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("La API MediaDevices de audio no es soportada.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else {
          mimeType = "";
        }
      }
      const options = mimeType ? { mimeType } : {};
      this.mediaRecorder = new MediaRecorder(stream, options);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      this.mediaRecorder.start();
      this.isRecordingAudio = true;
      this.playTone(660, 0.1);
      return true;
    }
    /**
     * Detiene la grabación de audio y genera el objeto de audio geotagueado
     * @param {Object} currentLocation 
     * @param {string} userNote 
     * @returns {Promise<Object>}
     */
    async stopAudioRecording(currentLocation, userNote = "") {
      return new Promise((resolve, reject) => {
        if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
          reject(new Error("No hay grabaci\xF3n activa de audio."));
          return;
        }
        this.mediaRecorder.onstop = () => {
          const mimeType = this.mediaRecorder.mimeType || "audio/webm";
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          const audioUrl = URL.createObjectURL(audioBlob);
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const base64Audio = reader.result;
            const audioItem = {
              id: "audio_" + Date.now(),
              type: "audio",
              dataUrl: base64Audio,
              audioBlobUrl: audioUrl,
              location: currentLocation ? { ...currentLocation } : null,
              timestamp: Date.now(),
              note: userNote || "Nota de voz en recorrido"
            };
            this.mediaItems.push(audioItem);
            this.isRecordingAudio = false;
            this.playTone(440, 0.15);
            this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
            resolve(audioItem);
          };
        };
        this.mediaRecorder.stop();
      });
    }
    /**
     * Limpia la lista de medios de la sesión
     */
    clearSessionMedia() {
      this.mediaItems = [];
      this.stopCamera();
    }
  };

  // pag cloudfire/js/config/firebaseConfig.js
  var FIREBASE_STORAGE_KEY = "cloudfire_firebase_config_v1";
  var DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDrBGSe9uQR31hlFefgbyGAKlZWyJph59E",
    authDomain: "movimiento-en-tiempo-real.firebaseapp.com",
    databaseURL: "https://movimiento-en-tiempo-real-default-rtdb.firebaseio.com",
    projectId: "movimiento-en-tiempo-real",
    storageBucket: "movimiento-en-tiempo-real.firebasestorage.app",
    messagingSenderId: "16486134972",
    appId: "1:16486134972:web:551d6396cbf83dc1684cb9",
    measurementId: "G-FYF5JKY13Z"
  };
  function getSavedFirebaseConfig() {
    try {
      const saved = localStorage.getItem(FIREBASE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.projectId && parsed.apiKey && parsed.apiKey.trim() !== "") {
          return parsed;
        }
      }
    } catch (error) {
      console.warn("[FirebaseConfig] Error al leer localStorage, usando configuraci\xF3n base:", error);
    }
    try {
      localStorage.setItem(FIREBASE_STORAGE_KEY, JSON.stringify(DEFAULT_FIREBASE_CONFIG));
    } catch (_) {
    }
    return { ...DEFAULT_FIREBASE_CONFIG };
  }
  function saveFirebaseConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Configuraci\xF3n inv\xE1lida");
    }
    localStorage.setItem(FIREBASE_STORAGE_KEY, JSON.stringify(config));
  }
  function isFirebaseConfigValid(config = getSavedFirebaseConfig()) {
    return Boolean(
      config && config.apiKey && config.apiKey.trim() !== "" && config.projectId && config.projectId.trim() !== ""
    );
  }
  var firebaseAppInstance = null;
  var firestoreDbInstance = null;
  var firebaseAnalyticsInstance = null;
  async function initializeFirebaseServices() {
    const config = getSavedFirebaseConfig();
    if (!isFirebaseConfigValid(config)) {
      console.info("[FirebaseConfig] Firebase no configurado a\xFAn.");
      return null;
    }
    try {
      const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      if (getApps().length === 0) {
        firebaseAppInstance = initializeApp(config);
      } else {
        firebaseAppInstance = getApp();
      }
      firestoreDbInstance = getFirestore(firebaseAppInstance);
      console.log("[FirebaseConfig] Cloud Firestore conectado con \xE9xito para:", config.projectId);
      if (config.measurementId) {
        try {
          const { getAnalytics, isSupported } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js");
          if (await isSupported()) {
            firebaseAnalyticsInstance = getAnalytics(firebaseAppInstance);
            console.log("[FirebaseConfig] Firebase Analytics inicializado");
          }
        } catch (anErr) {
          console.warn("[FirebaseConfig] Analytics no disponible en este entorno:", anErr.message);
        }
      }
      return {
        app: firebaseAppInstance,
        db: firestoreDbInstance,
        analytics: firebaseAnalyticsInstance
      };
    } catch (err) {
      console.error("[FirebaseConfig] Fallo al inicializar Firebase:", err);
      throw err;
    }
  }
  function getDb() {
    return firestoreDbInstance;
  }

  // pag cloudfire/js/models/StorageModel.js
  var LOCAL_SESSIONS_KEY = "cloudfire_saved_routes_v1";
  var StorageModel = class {
    constructor() {
      this.isOnline = navigator.onLine;
      this.hasFirebase = false;
      this.backendType = "none";
      this.activeRtdbUrl = "";
      window.addEventListener("online", () => {
        this.isOnline = true;
      });
      window.addEventListener("offline", () => {
        this.isOnline = false;
      });
    }
    /**
     * Obtiene la URL base de Realtime Database para la configuración dada
     * @param {Object} config 
     * @returns {string}
     */
    getRtdbUrl(config = getSavedFirebaseConfig()) {
      if (config?.databaseURL && config.databaseURL.trim() !== "") {
        return config.databaseURL.replace(/\/+$/, "");
      }
      if (config?.projectId && config.projectId.trim() !== "") {
        return `https://${config.projectId}-default-rtdb.firebaseio.com`;
      }
      return "https://movimiento-en-tiempo-real-default-rtdb.firebaseio.com";
    }
    /**
     * Comprueba y activa la conexión con Firebase (prioriza Realtime Database y Firestore)
     * @returns {Promise<boolean>}
     */
    async checkAndInitFirebase() {
      const config = getSavedFirebaseConfig();
      if (!config) return false;
      const rtdbUrl = this.getRtdbUrl(config);
      try {
        const response = await fetch(`${rtdbUrl}/.json?shallow=true`, {
          method: "GET",
          headers: { "Accept": "application/json" }
        });
        if (response.ok || response.status === 200 || response.status === 401) {
          this.hasFirebase = true;
          this.backendType = "rtdb";
          this.activeRtdbUrl = rtdbUrl;
          console.log("[StorageModel] Conectado exitosamente con Firebase Realtime Database:", rtdbUrl);
          return true;
        }
      } catch (rtdbErr) {
        console.info("[StorageModel] RTDB no respondi\xF3, verificando Firestore...");
      }
      try {
        if (isFirebaseConfigValid(config)) {
          const instance = await initializeFirebaseServices();
          if (instance && instance.db) {
            this.hasFirebase = true;
            this.backendType = "firestore";
            console.log("[StorageModel] Conectado con Cloud Firestore");
            return true;
          }
        }
      } catch (fsErr) {
        console.warn("[StorageModel] Firestore no disponible o deshabilitado en GCP:", fsErr.message);
      }
      this.hasFirebase = false;
      this.backendType = "none";
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
      try {
        const testKey = `_ping_${Date.now()}`;
        const pingUrl = `${rtdbUrl}/_connection_test/${testKey}.json`;
        const writeRes = await fetch(pingUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ping: "ok", timestamp: Date.now() })
        });
        if (writeRes.ok) {
          try {
            await fetch(pingUrl, { method: "DELETE" });
          } catch (_) {
          }
          const latencyMs = Date.now() - startTime;
          this.hasFirebase = true;
          this.backendType = "rtdb";
          this.activeRtdbUrl = rtdbUrl;
          return {
            success: true,
            message: `\xA1Conexi\xF3n exitosa a Firebase Realtime Database! Proyecto: ${config.projectId || "activo"}. Latencia: ${latencyMs}ms.`,
            latencyMs
          };
        }
      } catch (_) {
      }
      try {
        const { initializeApp, deleteApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
        const { getFirestore, doc, setDoc, getDoc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
        const tempAppName = "test_conn_" + Date.now();
        const testApp = initializeApp(config, tempAppName);
        const testDb = getFirestore(testApp);
        const testDocRef = doc(testDb, "_connection_test", "ping");
        await setDoc(testDocRef, { timestamp: Date.now(), status: "OK" });
        await deleteDoc(testDocRef);
        await deleteApp(testApp);
        const latencyMs = Date.now() - startTime;
        this.hasFirebase = true;
        this.backendType = "firestore";
        return {
          success: true,
          message: `\xA1Conexi\xF3n exitosa a Cloud Firestore! Latencia: ${latencyMs}ms.`,
          latencyMs
        };
      } catch (err) {
        console.error("[StorageModel] Error al probar conexi\xF3n de Firebase:", err);
        let errorHelp = err.message;
        if (err.message.includes("SERVICE_DISABLED") || err.message.includes("has not been used")) {
          errorHelp = "La API de Firestore no est\xE1 activada en la consola de Firebase. Sin embargo, Realtime Database est\xE1 disponible.";
        } else if (err.message.includes("permission-denied")) {
          errorHelp = "Permiso denegado. Revisa las Reglas de tu base de datos en la consola de Firebase (allow read, write: if true).";
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
      const sessionId = "route_" + Date.now();
      const payload = {
        id: sessionId,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        timestamp: Date.now(),
        summary: sessionSummary,
        mediaCount: mediaItems.length,
        media: mediaItems.map((m) => ({
          id: m.id,
          type: m.type,
          dataUrl: m.dataUrl || null,
          audioBlobUrl: m.audioBlobUrl || null,
          location: m.location,
          timestamp: m.timestamp,
          note: m.note || ""
        }))
      };
      this.saveToLocalStorage(payload);
      let syncedFirebase = false;
      if (this.hasFirebase && this.isOnline) {
        if (this.backendType === "rtdb" || this.activeRtdbUrl) {
          try {
            const rtdbUrl = this.activeRtdbUrl || this.getRtdbUrl();
            const targetUrl = `${rtdbUrl}/tracking_sessions/${sessionId}.json`;
            const res = await fetch(targetUrl, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            if (res.ok) {
              syncedFirebase = true;
              console.log("[StorageModel] Sesi\xF3n guardada exitosamente en Firebase Realtime Database:", sessionId);
            }
          } catch (rtdbSaveErr) {
            console.warn("[StorageModel] Fallo guardado en RTDB:", rtdbSaveErr);
          }
        }
        if (!syncedFirebase && this.backendType === "firestore") {
          const db = getDb();
          if (db) {
            try {
              const { collection, setDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
              const sessionRef = doc(collection(db, "tracking_sessions"), sessionId);
              await setDoc(sessionRef, payload);
              syncedFirebase = true;
              console.log("[StorageModel] Sesi\xF3n guardada exitosamente en Cloud Firestore:", sessionId);
            } catch (fsSaveErr) {
              console.warn("[StorageModel] Fallo guardado en Firestore:", fsSaveErr);
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
        const trimmed = existing.slice(0, 30);
        localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(trimmed));
      } catch (err) {
        console.error("[StorageModel] Fallo al guardar en LocalStorage:", err);
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
        console.warn("[StorageModel] Error leyendo sesiones locales:", err);
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
      const list = this.getLocalSessions().filter((s) => s.id !== sessionId);
      localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(list));
      if (this.hasFirebase && this.isOnline) {
        if (this.backendType === "rtdb" || this.activeRtdbUrl) {
          try {
            const rtdbUrl = this.activeRtdbUrl || this.getRtdbUrl();
            await fetch(`${rtdbUrl}/tracking_sessions/${sessionId}.json`, { method: "DELETE" });
          } catch (_) {
          }
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
      if (this.backendType === "rtdb" || this.activeRtdbUrl) {
        try {
          const rtdbUrl = this.activeRtdbUrl || this.getRtdbUrl();
          const res = await fetch(`${rtdbUrl}/tracking_sessions.json`);
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data === "object") {
              return Object.values(data).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            }
          }
        } catch (err) {
          console.warn("[StorageModel] Error leyendo sesiones remotas de RTDB:", err);
        }
      }
      return [];
    }
  };

  // pag cloudfire/js/views/MapView.js
  var MapView = class {
    constructor(mapContainerId, onMapClickCallback) {
      this.containerId = mapContainerId;
      this.onMapClickCallback = onMapClickCallback;
      this.map = null;
      this.userMarker = null;
      this.accuracyCircle = null;
      this.routePolyline = null;
      this.reversePolyline = null;
      this.destinationMarker = null;
      this.mediaMarkers = [];
      this.isFollowUser = true;
      this.lastHeading = 0;
    }
    /**
     * Inicializa el mapa real con Leaflet, OpenStreetMap y Satélite Esri
     * @param {number} defaultLat Latitud inicial (ej: Bogotá, Colombia)
     * @param {number} defaultLng Longitud inicial
     * @param {number} defaultZoom Zoom inicial
     */
    async init(defaultLat = 4.60971, defaultLng = -74.08175, defaultZoom = 17) {
      const mapContainer = document.getElementById(this.containerId);
      if (!mapContainer) {
        console.error(`[MapView] No se encontr\xF3 el contenedor del mapa: #${this.containerId}`);
        return;
      }
      if (typeof L === "undefined") {
        console.warn("[MapView] Leaflet no detectado en ventana global, esperando script...");
        await this.ensureLeafletLoaded();
      }
      if (this.map) {
        try {
          this.map.remove();
        } catch (_) {
        }
      }
      const streetsLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
      });
      const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Sat\xE9lite Real de Alta Fidelidad"
      });
      const voyagerLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: "&copy; CartoDB &copy; OpenStreetMap"
      });
      this.map = L.map(this.containerId, {
        center: [defaultLat, defaultLng],
        zoom: defaultZoom,
        layers: [streetsLayer],
        zoomControl: false
        // Lo colocamos en una esquina óptima para móviles
      });
      L.control.zoom({ position: "topright" }).addTo(this.map);
      const baseMaps = {
        "\u{1F5FA}\uFE0F Calles Reales": streetsLayer,
        "\u{1F6F0}\uFE0F Sat\xE9lite Real": satelliteLayer,
        "\u{1F3D9}\uFE0F Cartograf\xEDa Clara": voyagerLayer
      };
      L.control.layers(baseMaps, null, { position: "topright" }).addTo(this.map);
      this.routePolyline = L.polyline([], {
        color: "#2563eb",
        weight: 6,
        opacity: 0.9,
        smoothFactor: 1
      }).addTo(this.map);
      this.reversePolyline = L.polyline([], {
        color: "#f59e0b",
        weight: 5,
        opacity: 0.95,
        dashArray: "8, 12"
      }).addTo(this.map);
      this.map.on("click", (e) => {
        if (this.onMapClickCallback && e.latlng) {
          this.onMapClickCallback(e.latlng.lat, e.latlng.lng);
        }
      });
      this.map.on("dragstart", () => {
        this.isFollowUser = false;
        this.onFollowStateChanged(false);
      });
      setTimeout(() => {
        this.map.invalidateSize();
      }, 200);
      console.log("[MapView] Mapa interactivo real cargado con \xE9xito (OpenStreetMap + Sat\xE9lite Esri).");
    }
    /**
     * Garantiza que la librería Leaflet se descargue si no está en el head
     */
    async ensureLeafletLoaded() {
      if (typeof L !== "undefined") return Promise.resolve();
      return new Promise((resolve, reject) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
      });
    }
    /**
     * Notifica cuando el usuario interactúa manualmente con el mapa
     */
    onFollowStateChanged(isFollowing) {
      const btn = document.getElementById("btn-recenter");
      if (btn) {
        if (isFollowing) {
          btn.classList.add("hidden");
        } else {
          btn.classList.remove("hidden");
        }
      }
    }
    /**
     * Crea el HTML del icono con efecto radar y flecha de rumbo
     * @param {number} heading Rumbo en grados (0-360)
     * @returns {L.DivIcon}
     */
    createUserIcon(heading = 0) {
      const headingStyle = `transform: rotate(${heading}deg) translateY(-8px);`;
      return L.divIcon({
        className: "user-marker-leaflet-wrapper",
        html: `
        <div class="user-marker-container">
          <div class="user-marker-pulse" aria-hidden="true"></div>
          <div class="user-marker-heading" style="${headingStyle}" aria-hidden="true"></div>
          <div class="user-marker-core" title="Tu ubicaci\xF3n en el mapa real"></div>
        </div>
      `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });
    }
    /**
     * Crea o actualiza el marcador dinámico de usuario
     * @param {Object} location { lat, lng, accuracy, heading }
     */
    updateUserLocation(location) {
      if (!this.map || !location) return;
      const latLng = [location.lat, location.lng];
      const heading = typeof location.heading === "number" && !isNaN(location.heading) ? location.heading : this.lastHeading;
      this.lastHeading = heading;
      if (!this.userMarker) {
        this.userMarker = L.marker(latLng, {
          icon: this.createUserIcon(heading),
          zIndexOffset: 1e3
        }).addTo(this.map);
        this.accuracyCircle = L.circle(latLng, {
          radius: Math.max(5, location.accuracy || 10),
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          weight: 1.5
        }).addTo(this.map);
        this.map.setView(latLng, 18);
      } else {
        this.userMarker.setLatLng(latLng);
        const headingEl = this.userMarker.getElement()?.querySelector(".user-marker-heading");
        if (headingEl) {
          headingEl.style.transform = `rotate(${heading}deg) translateY(-8px)`;
        }
        if (this.accuracyCircle) {
          this.accuracyCircle.setLatLng(latLng);
          this.accuracyCircle.setRadius(Math.max(5, location.accuracy || 10));
        }
        if (this.isFollowUser) {
          this.map.panTo(latLng);
        }
      }
    }
    /**
     * Agrega un nuevo punto a la polilínea del recorrido
     * @param {Object} location 
     */
    addPathPoint(location) {
      if (this.routePolyline && location) {
        this.routePolyline.addLatLng([location.lat, location.lng]);
      }
    }
    /**
     * Actualiza el trazado completo de la ruta
     * @param {Array<Object>} pathHistory 
     */
    setPath(pathHistory) {
      if (!this.routePolyline) return;
      const latLngs = pathHistory.map((p) => [p.lat, p.lng]);
      this.routePolyline.setLatLngs(latLngs);
    }
    /**
     * Actualiza el trazado de la ruta de retorno (Modo Reversible)
     * @param {Array<Object>} reversedPath 
     * @param {boolean} visible 
     */
    setReversedPath(reversedPath, visible = true) {
      if (!this.reversePolyline) return;
      if (visible && reversedPath && reversedPath.length > 0) {
        const latLngs = reversedPath.map((p) => [p.lat, p.lng]);
        this.reversePolyline.setLatLngs(latLngs);
      } else {
        this.reversePolyline.setLatLngs([]);
      }
    }
    /**
     * Fija o remueve el marcador de destino en el mapa
     * @param {Object|null} destination { lat, lng, name }
     */
    setDestinationMarker(destination) {
      if (!this.map) return;
      if (!destination) {
        if (this.destinationMarker) {
          this.map.removeLayer(this.destinationMarker);
          this.destinationMarker = null;
        }
        return;
      }
      const latLng = [destination.lat, destination.lng];
      const destinationIcon = L.divIcon({
        className: "dest-marker-wrapper",
        html: `
        <div style="font-size: 26px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4)); text-align: center; transform: translate(-50%, -100%);">
          \u{1F4CD}
        </div>
      `,
        iconSize: [30, 30],
        iconAnchor: [0, 0]
      });
      if (!this.destinationMarker) {
        this.destinationMarker = L.marker(latLng, {
          icon: destinationIcon,
          title: destination.name || "Destino seleccionado"
        }).addTo(this.map);
      } else {
        this.destinationMarker.setLatLng(latLng);
      }
    }
    /**
     * Agrega un marcador multimedia sobre el mapa (foto o audio) con popup interactivo
     * @param {Object} mediaItem 
     */
    addMediaMarker(mediaItem) {
      if (!this.map || !mediaItem.location) return;
      const isPhoto = mediaItem.type === "photo";
      const latLng = [mediaItem.location.lat, mediaItem.location.lng];
      const iconHtml = isPhoto ? `<div style="background-color: #10b981; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">\u{1F4F7}</div>` : `<div style="background-color: #8b5cf6; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">\u{1F3A4}</div>`;
      const mediaIcon = L.divIcon({
        className: "media-marker-wrapper",
        html: iconHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      const marker = L.marker(latLng, {
        icon: mediaIcon,
        title: isPhoto ? "Foto en ruta" : "Nota de voz"
      }).addTo(this.map);
      let popupContent = `
      <div style="max-width: 230px; font-family: sans-serif; padding: 4px;">
        <h4 style="margin: 0 0 4px 0; font-weight: bold; font-size: 0.9rem; color: #0f172a;">${isPhoto ? "\u{1F4F7} Foto en ruta" : "\u{1F3A4} Nota de voz"}</h4>
        <p style="margin: 0 0 6px 0; font-size: 0.8rem; color: #64748b;">${new Date(mediaItem.timestamp).toLocaleTimeString()}</p>
        <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #1e293b;">${mediaItem.note || ""}</p>
    `;
      if (isPhoto && mediaItem.dataUrl) {
        popupContent += `<img src="${mediaItem.dataUrl}" alt="Evidencia en ruta" style="width: 100%; border-radius: 6px; max-height: 140px; object-fit: cover;" />`;
      } else if (!isPhoto && mediaItem.audioBlobUrl) {
        popupContent += `<audio controls src="${mediaItem.audioBlobUrl}" style="width: 100%; height: 36px; margin-top: 4px;"></audio>`;
      }
      popupContent += `</div>`;
      marker.bindPopup(popupContent);
      this.mediaMarkers.push(marker);
    }
    /**
     * Limpia trazados y marcadores del mapa para reiniciar la sesión
     */
    clearMapRoute() {
      if (this.routePolyline) {
        this.routePolyline.setLatLngs([]);
      }
      if (this.reversePolyline) {
        this.reversePolyline.setLatLngs([]);
      }
      if (this.destinationMarker) {
        this.map.removeLayer(this.destinationMarker);
        this.destinationMarker = null;
      }
      this.mediaMarkers.forEach((m) => this.map.removeLayer(m));
      this.mediaMarkers = [];
    }
    /**
     * Recentra el mapa en la ubicación del usuario
     * @param {Object} location 
     */
    recenterOnUser(location) {
      if (this.map && location) {
        this.isFollowUser = true;
        const latLng = [location.lat, location.lng];
        this.map.panTo(latLng);
        this.map.setZoom(18);
        this.onFollowStateChanged(true);
      }
    }
  };

  // pag cloudfire/js/views/DashboardView.js
  var DashboardView = class {
    constructor() {
      this.statDistance = document.getElementById("stat-distance");
      this.statElapsedTime = document.getElementById("stat-elapsed-time");
      this.statSpeed = document.getElementById("stat-speed");
      this.statAvgSpeed = document.getElementById("stat-avg-speed");
      this.statEta = document.getElementById("stat-eta");
      this.statEtaLabel = document.getElementById("stat-eta-label");
      this.statAccuracy = document.getElementById("stat-accuracy");
      this.statAccuracyBadge = document.getElementById("stat-accuracy-badge");
      this.btnStart = document.getElementById("btn-start");
      this.btnPause = document.getElementById("btn-pause");
      this.btnStop = document.getElementById("btn-stop");
      this.btnReverse = document.getElementById("btn-reverse");
      this.btnMedia = document.getElementById("btn-media");
      this.btnHistory = document.getElementById("btn-history");
      this.btnUndo = document.getElementById("btn-undo");
      this.trackingStatusBadge = document.getElementById("tracking-status-badge");
      this.firebaseStatusBadge = document.getElementById("firebase-status-badge");
      this.a11yAnnouncer = document.getElementById("a11y-announcer");
      this.timerInterval = null;
    }
    /**
     * Anuncia un cambio de estado al lector de pantalla de forma accesible
     * @param {string} message 
     */
    announce(message) {
      if (this.a11yAnnouncer) {
        this.a11yAnnouncer.textContent = "";
        setTimeout(() => {
          this.a11yAnnouncer.textContent = message;
        }, 50);
      }
    }
    /**
     * Actualiza las métricas en vivo en el panel
     * @param {import('../models/TrackingModel.js').TrackingModel} model 
     */
    updateTelemetry(model) {
      if (this.statDistance) {
        const meters = model.totalDistanceMeters;
        if (meters < 1e3) {
          this.statDistance.textContent = `${Math.round(meters)} m`;
        } else {
          this.statDistance.textContent = `${(meters / 1e3).toFixed(2)} km`;
        }
      }
      if (this.statSpeed) {
        this.statSpeed.textContent = `${model.currentSpeedKmh.toFixed(1)} km/h`;
      }
      if (this.statAvgSpeed) {
        this.statAvgSpeed.textContent = `Prom: ${model.averageSpeedKmh.toFixed(1)} km/h`;
      }
      if (this.statAccuracy && model.currentLocation) {
        const acc = model.currentLocation.accuracy;
        this.statAccuracy.textContent = `\xB1${acc.toFixed(0)}m`;
        if (this.statAccuracyBadge) {
          if (acc <= 10) {
            this.statAccuracyBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300";
            this.statAccuracyBadge.title = "Se\xF1al satelital \xF3ptima";
          } else if (acc <= 25) {
            this.statAccuracyBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300";
            this.statAccuracyBadge.title = "Se\xF1al satelital moderada";
          } else {
            this.statAccuracyBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300";
            this.statAccuracyBadge.title = "Se\xF1al satelital con dispersi\xF3n";
          }
        }
      }
      if (this.statEta) {
        if (model.etaSeconds !== null && model.destination) {
          this.statEta.textContent = this.formatDuration(model.etaSeconds);
          if (this.statEtaLabel) {
            this.statEtaLabel.textContent = model.isReversed ? "Tiempo de Retorno (ETA)" : "Tiempo Aprox. al Destino";
          }
        } else {
          this.statEta.textContent = "--:--";
          if (this.statEtaLabel) {
            this.statEtaLabel.textContent = "Tiempo Aprox. (Fija un punto)";
          }
        }
      }
      if (this.btnUndo) {
        this.btnUndo.disabled = model.pathHistory.length < 2;
      }
    }
    /**
     * Inicia el temporizador en pantalla
     * @param {import('../models/TrackingModel.js').TrackingModel} model 
     */
    startTimer(model) {
      this.stopTimer();
      this.timerInterval = setInterval(() => {
        if (this.statElapsedTime) {
          const seconds = model.getElapsedSeconds();
          this.statElapsedTime.textContent = this.formatTimeHHMMSS(seconds);
        }
      }, 1e3);
    }
    /**
     * Detiene el temporizador visual
     */
    stopTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }
    /**
     * Actualiza el estado visual de los botones según el ciclo de vida del rastreo
     * @param {'idle'|'tracking'|'paused'} state 
     */
    setTrackingState(state) {
      if (!this.btnStart || !this.btnPause || !this.btnStop) return;
      if (state === "idle") {
        this.btnStart.classList.remove("hidden");
        this.btnStart.textContent = "\u25B6 Iniciar Viaje";
        this.btnStart.setAttribute("aria-label", "Iniciar registro de recorrido");
        this.btnPause.classList.add("hidden");
        this.btnStop.classList.add("hidden");
        if (this.trackingStatusBadge) {
          this.trackingStatusBadge.textContent = "En Espera";
          this.trackingStatusBadge.className = "px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700";
        }
      } else if (state === "tracking") {
        this.btnStart.classList.add("hidden");
        this.btnPause.classList.remove("hidden");
        this.btnPause.textContent = "\u23F8 Pausar";
        this.btnPause.setAttribute("aria-label", "Pausar recorrido temporalmente");
        this.btnStop.classList.remove("hidden");
        if (this.trackingStatusBadge) {
          this.trackingStatusBadge.textContent = "\u25CF En Movimiento";
          this.trackingStatusBadge.className = "px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse";
        }
      } else if (state === "paused") {
        this.btnStart.classList.add("hidden");
        this.btnPause.classList.remove("hidden");
        this.btnPause.textContent = "\u25B6 Reanudar";
        this.btnPause.setAttribute("aria-label", "Reanudar recorrido");
        this.btnStop.classList.remove("hidden");
        if (this.trackingStatusBadge) {
          this.trackingStatusBadge.textContent = "\u23F8 En Pausa";
          this.trackingStatusBadge.className = "px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800";
        }
      }
    }
    /**
     * Actualiza la apariencia del botón Reversible
     * @param {boolean} isReversed 
     */
    updateReverseButton(isReversed) {
      if (!this.btnReverse) return;
      if (isReversed) {
        this.btnReverse.classList.add("bg-amber-600", "text-white", "hover:bg-amber-700", "border-amber-700");
        this.btnReverse.classList.remove("bg-white", "text-slate-700", "hover:bg-slate-100", "border-slate-300");
        this.btnReverse.setAttribute("aria-pressed", "true");
        this.btnReverse.innerHTML = `<span>\u{1F504}</span><span>Retorno Activo</span>`;
        this.announce("Modo Reversible activado. Guiando trayecto de retorno al punto de inicio.");
      } else {
        this.btnReverse.classList.remove("bg-amber-600", "text-white", "hover:bg-amber-700", "border-amber-700");
        this.btnReverse.classList.add("bg-white", "text-slate-700", "hover:bg-slate-100", "border-slate-300");
        this.btnReverse.setAttribute("aria-pressed", "false");
        this.btnReverse.innerHTML = `<span>\u{1F504}</span><span>Invertir Ruta</span>`;
        this.announce("Modo Reversible desactivado.");
      }
    }
    /**
     * Actualiza el badge de conexión con Firebase
     * @param {boolean} isConnected 
     * @param {string} projectName 
     */
    updateFirebaseStatus(isConnected, projectName = "") {
      if (!this.firebaseStatusBadge) return;
      if (isConnected) {
        this.firebaseStatusBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300";
        this.firebaseStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span><span>Firebase: Conectado</span>`;
        this.firebaseStatusBadge.title = `Sincronizando con Cloud Firestore (${projectName || "Activo"})`;
      } else {
        this.firebaseStatusBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300";
        this.firebaseStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span><span>Persistencia Local (Sin Firebase)</span>`;
        this.firebaseStatusBadge.title = "Pulsa para conectar Cloud Firestore";
      }
    }
    /**
     * Convierte segundos en formato legible HH:MM:SS
     * @param {number} totalSeconds 
     * @returns {string}
     */
    formatTimeHHMMSS(totalSeconds) {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor(totalSeconds % 3600 / 60);
      const seconds = totalSeconds % 60;
      return [
        hours.toString().padStart(2, "0"),
        minutes.toString().padStart(2, "0"),
        seconds.toString().padStart(2, "0")
      ].join(":");
    }
    /**
     * Formatea una duración en minutos o segundos para ETA
     * @param {number} totalSeconds 
     * @returns {string}
     */
    formatDuration(totalSeconds) {
      if (totalSeconds < 60) {
        return `${totalSeconds} s`;
      }
      const minutes = Math.floor(totalSeconds / 60);
      const remainingSec = totalSeconds % 60;
      if (minutes < 60) {
        return `${minutes} min ${remainingSec > 0 ? remainingSec + "s" : ""}`;
      }
      const hours = Math.floor(minutes / 60);
      const remMin = minutes % 60;
      return `${hours} h ${remMin} min`;
    }
  };

  // pag cloudfire/js/views/MediaView.js
  var MediaView = class {
    constructor(mediaModel) {
      this.model = mediaModel;
      this.cameraModal = document.getElementById("camera-modal");
      this.cameraVideo = document.getElementById("camera-video");
      this.btnCapturePhoto = document.getElementById("btn-capture-photo");
      this.btnCloseCamera = document.getElementById("btn-close-camera");
      this.photoNoteInput = document.getElementById("photo-note-input");
      this.photoPreviewContainer = document.getElementById("photo-preview-container");
      this.photoPreviewImg = document.getElementById("photo-preview-img");
      this.audioModal = document.getElementById("audio-modal");
      this.btnRecordAudio = document.getElementById("btn-record-audio");
      this.btnStopAudio = document.getElementById("btn-stop-audio");
      this.btnCloseAudio = document.getElementById("btn-close-audio");
      this.audioTimer = document.getElementById("audio-timer");
      this.audioNoteInput = document.getElementById("audio-note-input");
      this.audioPlayer = document.getElementById("audio-player");
      this.audioRecordingIndicator = document.getElementById("audio-recording-indicator");
      this.audioInterval = null;
      this.audioStartTime = 0;
    }
    /**
     * Abre el modal de la cámara e inicializa el stream de video
     * @param {Object} currentLocation 
     */
    async openCameraModal(currentLocation) {
      if (!this.cameraModal) return;
      this.currentLocation = currentLocation;
      this.cameraModal.classList.remove("hidden");
      this.cameraModal.setAttribute("aria-hidden", "false");
      if (this.photoPreviewContainer) this.photoPreviewContainer.classList.add("hidden");
      if (this.cameraVideo) this.cameraVideo.classList.remove("hidden");
      if (this.photoNoteInput) this.photoNoteInput.value = "";
      try {
        await this.model.startCamera(this.cameraVideo);
        this.btnCapturePhoto?.focus();
      } catch (err) {
        alert(`No se pudo acceder a la c\xE1mara: ${err.message}. Comprueba los permisos de tu dispositivo.`);
        this.closeCameraModal();
      }
    }
    /**
     * Cierra el modal de la cámara y libera el hardware
     */
    closeCameraModal() {
      if (!this.cameraModal) return;
      this.model.stopCamera();
      this.cameraModal.classList.add("hidden");
      this.cameraModal.setAttribute("aria-hidden", "true");
    }
    /**
     * Captura la foto y muestra la vista previa antes de confirmar
     * @returns {Object|null}
     */
    captureSnapshot() {
      if (!this.cameraVideo) return null;
      const note = this.photoNoteInput ? this.photoNoteInput.value.trim() : "";
      try {
        const photoItem = this.model.capturePhotoFromVideo(
          this.cameraVideo,
          this.currentLocation,
          note
        );
        if (this.photoPreviewImg && this.photoPreviewContainer) {
          this.photoPreviewImg.src = photoItem.dataUrl;
          this.photoPreviewContainer.classList.remove("hidden");
          this.cameraVideo.classList.add("hidden");
        }
        return photoItem;
      } catch (e) {
        alert(`Error al capturar imagen: ${e.message}`);
        return null;
      }
    }
    /**
     * Abre el modal para grabar notas de voz
     * @param {Object} currentLocation 
     */
    openAudioModal(currentLocation) {
      if (!this.audioModal) return;
      this.currentLocation = currentLocation;
      this.audioModal.classList.remove("hidden");
      this.audioModal.setAttribute("aria-hidden", "false");
      if (this.audioNoteInput) this.audioNoteInput.value = "";
      if (this.audioPlayer) {
        this.audioPlayer.src = "";
        this.audioPlayer.classList.add("hidden");
      }
      if (this.audioTimer) this.audioTimer.textContent = "00:00";
      if (this.btnRecordAudio) this.btnRecordAudio.disabled = false;
      if (this.btnStopAudio) this.btnStopAudio.disabled = true;
      if (this.audioRecordingIndicator) this.audioRecordingIndicator.classList.add("hidden");
    }
    /**
     * Cierra el modal de notas de voz
     */
    closeAudioModal() {
      if (!this.audioModal) return;
      this.stopAudioTimer();
      this.audioModal.classList.add("hidden");
      this.audioModal.setAttribute("aria-hidden", "true");
    }
    /**
     * Comienza la grabación de audio
     */
    async startRecordingAudio() {
      try {
        await this.model.startAudioRecording();
        if (this.btnRecordAudio) this.btnRecordAudio.disabled = true;
        if (this.btnStopAudio) this.btnStopAudio.disabled = false;
        if (this.audioRecordingIndicator) this.audioRecordingIndicator.classList.remove("hidden");
        this.audioStartTime = Date.now();
        this.audioInterval = setInterval(() => {
          const sec = Math.floor((Date.now() - this.audioStartTime) / 1e3);
          const mm = Math.floor(sec / 60).toString().padStart(2, "0");
          const ss = (sec % 60).toString().padStart(2, "0");
          if (this.audioTimer) this.audioTimer.textContent = `${mm}:${ss}`;
        }, 500);
      } catch (err) {
        alert(`Error de audio: ${err.message}`);
      }
    }
    /**
     * Detiene la grabación y muestra el reproductor
     * @returns {Promise<Object|null>}
     */
    async stopRecordingAudio() {
      this.stopAudioTimer();
      const note = this.audioNoteInput ? this.audioNoteInput.value.trim() : "";
      try {
        const audioItem = await this.model.stopAudioRecording(this.currentLocation, note);
        if (this.audioPlayer && audioItem.audioBlobUrl) {
          this.audioPlayer.src = audioItem.audioBlobUrl;
          this.audioPlayer.classList.remove("hidden");
        }
        if (this.btnRecordAudio) this.btnRecordAudio.disabled = false;
        if (this.btnStopAudio) this.btnStopAudio.disabled = true;
        if (this.audioRecordingIndicator) this.audioRecordingIndicator.classList.add("hidden");
        return audioItem;
      } catch (err) {
        alert(`Error al procesar audio: ${err.message}`);
        return null;
      }
    }
    stopAudioTimer() {
      if (this.audioInterval) {
        clearInterval(this.audioInterval);
        this.audioInterval = null;
      }
    }
  };

  // pag cloudfire/js/views/FirebaseModalView.js
  var FirebaseModalView = class {
    constructor(storageModel, onConnectedCallback) {
      this.storageModel = storageModel;
      this.onConnectedCallback = onConnectedCallback;
      this.modal = document.getElementById("firebase-modal");
      this.btnClose = document.getElementById("btn-close-firebase-modal");
      this.btnSave = document.getElementById("btn-save-firebase");
      this.btnTest = document.getElementById("btn-test-firebase");
      this.connectionResultAlert = document.getElementById("firebase-test-result");
      this.inputApiKey = document.getElementById("fb-api-key");
      this.inputAuthDomain = document.getElementById("fb-auth-domain");
      this.inputProjectId = document.getElementById("fb-project-id");
      this.inputStorageBucket = document.getElementById("fb-storage-bucket");
      this.inputMessagingSenderId = document.getElementById("fb-messaging-sender-id");
      this.inputAppId = document.getElementById("fb-app-id");
      this.pasteRawConfigArea = document.getElementById("fb-paste-raw");
      this.initEventListeners();
    }
    initEventListeners() {
      this.btnClose?.addEventListener("click", () => this.close());
      this.btnSave?.addEventListener("click", () => this.handleSave());
      this.btnTest?.addEventListener("click", () => this.handleTestConnection());
      this.pasteRawConfigArea?.addEventListener("input", (e) => {
        this.parsePastedSnippet(e.target.value);
      });
    }
    /**
     * Abre el modal y carga los datos actuales si existen
     */
    open() {
      if (!this.modal) return;
      this.modal.classList.remove("hidden");
      this.modal.style.display = "flex";
      this.modal.setAttribute("aria-hidden", "false");
      const currentConfig = getSavedFirebaseConfig();
      if (this.inputApiKey) this.inputApiKey.value = currentConfig.apiKey || "";
      if (this.inputAuthDomain) this.inputAuthDomain.value = currentConfig.authDomain || "";
      if (this.inputProjectId) this.inputProjectId.value = currentConfig.projectId || "";
      if (this.inputStorageBucket) this.inputStorageBucket.value = currentConfig.storageBucket || "";
      if (this.inputMessagingSenderId) this.inputMessagingSenderId.value = currentConfig.messagingSenderId || "";
      if (this.inputAppId) this.inputAppId.value = currentConfig.appId || "";
      if (this.connectionResultAlert) {
        this.connectionResultAlert.classList.add("hidden");
        this.connectionResultAlert.style.display = "none";
        this.connectionResultAlert.textContent = "";
      }
      try {
        this.inputProjectId?.focus();
      } catch (_) {
      }
    }
    /**
     * Cierra el modal
     */
    close() {
      if (!this.modal) return;
      this.modal.classList.add("hidden");
      this.modal.style.display = "none";
      this.modal.setAttribute("aria-hidden", "true");
    }
    /**
     * Extrae claves si el usuario pega código JS directo de la consola de Firebase
     * @param {string} text 
     */
    parsePastedSnippet(text) {
      if (!text || text.trim() === "") return;
      try {
        const extractField = (fieldName) => {
          const regex = new RegExp(`['"]?${fieldName}['"]?\\s*:\\s*['"]([^'"]+)['"]`, "i");
          const match = text.match(regex);
          return match ? match[1] : "";
        };
        const apiKey = extractField("apiKey");
        const authDomain = extractField("authDomain");
        const projectId = extractField("projectId");
        const storageBucket = extractField("storageBucket");
        const messagingSenderId = extractField("messagingSenderId");
        const appId = extractField("appId");
        if (apiKey && this.inputApiKey) this.inputApiKey.value = apiKey;
        if (authDomain && this.inputAuthDomain) this.inputAuthDomain.value = authDomain;
        if (projectId && this.inputProjectId) this.inputProjectId.value = projectId;
        if (storageBucket && this.inputStorageBucket) this.inputStorageBucket.value = storageBucket;
        if (messagingSenderId && this.inputMessagingSenderId) this.inputMessagingSenderId.value = messagingSenderId;
        if (appId && this.inputAppId) this.inputAppId.value = appId;
        if (projectId) {
          this.showResultBadge(true, `\xA1Datos extra\xEDdos autom\xE1ticamente para el proyecto "${projectId}"! Ahora puedes pulsar "Probar Conexi\xF3n".`);
        }
      } catch (err) {
        console.warn("[FirebaseModalView] Error al auto-parsear snippet:", err);
      }
    }
    /**
     * Reúne la configuración desde los campos del formulario
     * @returns {Object}
     */
    getFormConfig() {
      return {
        apiKey: this.inputApiKey?.value.trim() || "",
        authDomain: this.inputAuthDomain?.value.trim() || "",
        projectId: this.inputProjectId?.value.trim() || "",
        storageBucket: this.inputStorageBucket?.value.trim() || "",
        messagingSenderId: this.inputMessagingSenderId?.value.trim() || "",
        appId: this.inputAppId?.value.trim() || ""
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
        this.btnTest.textContent = "\u23F3 Probando conexi\xF3n...";
      }
      this.showResultBadge(true, "Conectando a Firebase Firestore y verificando permisos...", "info");
      const result = await this.storageModel.testFirebaseConnection(config);
      if (this.btnTest) {
        this.btnTest.disabled = false;
        this.btnTest.textContent = "\u{1F50D} Probar Conexi\xF3n";
      }
      if (result.success) {
        this.showResultBadge(true, `\u2705 ${result.message}`);
      } else {
        this.showResultBadge(false, `\u274C ${result.message}`);
      }
    }
    /**
     * Guarda la configuración e inicializa Firebase
     */
    async handleSave() {
      const config = this.getFormConfig();
      if (!isFirebaseConfigValid(config)) {
        this.showResultBadge(false, "Configuraci\xF3n incompleta: Se requiere apiKey y projectId.");
        return;
      }
      try {
        saveFirebaseConfig(config);
        const isConnected = await this.storageModel.checkAndInitFirebase();
        if (this.onConnectedCallback) {
          this.onConnectedCallback(isConnected, config.projectId);
        }
        this.showResultBadge(true, "Configuraci\xF3n guardada exitosamente.");
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
    showResultBadge(isSuccess, message, type = isSuccess ? "success" : "error") {
      if (!this.connectionResultAlert) return;
      this.connectionResultAlert.classList.remove("hidden", "bg-emerald-50", "text-emerald-800", "border-emerald-300", "bg-rose-50", "text-rose-800", "border-rose-300", "bg-blue-50", "text-blue-800", "border-blue-300");
      if (type === "info") {
        this.connectionResultAlert.classList.add("bg-blue-50", "text-blue-800", "border-blue-300");
      } else if (isSuccess) {
        this.connectionResultAlert.classList.add("bg-emerald-50", "text-emerald-800", "border-emerald-300");
      } else {
        this.connectionResultAlert.classList.add("bg-rose-50", "text-rose-800", "border-rose-300");
      }
      this.connectionResultAlert.textContent = message;
    }
  };

  // pag cloudfire/js/views/HistoryModalView.js
  var HistoryModalView = class {
    constructor(storageModel, onSelectRouteCallback) {
      this.storageModel = storageModel;
      this.onSelectRouteCallback = onSelectRouteCallback;
      this.modal = document.getElementById("history-modal");
      this.btnClose = document.getElementById("btn-close-history-modal");
      this.sessionsListContainer = document.getElementById("history-sessions-list");
      this.btnClose?.addEventListener("click", () => this.close());
    }
    /**
     * Abre el modal y renderiza las sesiones guardadas
     */
    async open() {
      if (!this.modal) return;
      this.modal.classList.remove("hidden");
      this.modal.setAttribute("aria-hidden", "false");
      await this.renderSessions();
    }
    /**
     * Cierra el modal
     */
    close() {
      if (!this.modal) return;
      this.modal.classList.add("hidden");
      this.modal.setAttribute("aria-hidden", "true");
    }
    /**
     * Renderiza el listado de sesiones
     */
    async renderSessions() {
      if (!this.sessionsListContainer) return;
      let sessions = this.storageModel.getLocalSessions();
      if (this.storageModel.hasFirebase && this.storageModel.isOnline) {
        try {
          const remoteSessions = await this.storageModel.getRemoteSessions();
          if (remoteSessions && remoteSessions.length > 0) {
            const ids = new Set(sessions.map((s) => s.id));
            remoteSessions.forEach((r) => {
              if (!ids.has(r.id)) {
                sessions.push(r);
              }
            });
            sessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          }
        } catch (_) {
        }
      }
      if (sessions.length === 0) {
        this.sessionsListContainer.innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <p class="text-4xl mb-2">\u{1F5FA}\uFE0F</p>
          <p class="font-medium">No hay rutas guardadas a\xFAn.</p>
          <p class="text-sm text-slate-400 mt-1">Inicia un recorrido con el bot\xF3n "Iniciar Viaje" y gu\xE1rdalo al terminar.</p>
        </div>
      `;
        return;
      }
      this.sessionsListContainer.innerHTML = sessions.map((session, index) => {
        const summary = session.summary || {};
        const dateFormatted = new Date(session.timestamp).toLocaleDateString("es-ES", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        const dist = summary.totalDistanceKm ? `${summary.totalDistanceKm} km` : `${Math.round(summary.totalDistanceMeters || 0)} m`;
        const timeMin = Math.round((summary.elapsedSeconds || 0) / 60);
        return `
        <article class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Ruta #${sessions.length - index}</span>
              <time class="text-xs text-slate-500" datetime="${session.createdAt}">${dateFormatted}</time>
            </div>
            <div class="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-800">
              <span>\u{1F4CD} ${dist}</span>
              <span>\u23F1\uFE0F ${timeMin} min</span>
              <span>\u26A1 ${summary.averageSpeedKmh || 0} km/h prom</span>
              ${session.mediaCount ? `<span>\u{1F4F7} ${session.mediaCount} evidencias</span>` : ""}
            </div>
          </div>
          <div class="flex items-center gap-2 pt-2 md:pt-0">
            <button type="button" data-session-id="${session.id}" class="btn-load-route flex-1 md:flex-initial px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              Cargar en Mapa
            </button>
            <button type="button" data-delete-id="${session.id}" class="btn-delete-route px-3 py-1.5 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors" title="Eliminar del historial">
              \u{1F5D1}\uFE0F
            </button>
          </div>
        </article>
      `;
      }).join("");
      this.sessionsListContainer.querySelectorAll(".btn-load-route").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-session-id");
          const session = sessions.find((s) => s.id === id);
          if (session && this.onSelectRouteCallback) {
            this.onSelectRouteCallback(session);
            this.close();
          }
        });
      });
      this.sessionsListContainer.querySelectorAll(".btn-delete-route").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-delete-id");
          if (confirm("\xBFDeseas eliminar este registro de ruta?")) {
            this.storageModel.deleteLocalSession(id);
            this.renderSessions();
          }
        });
      });
    }
  };

  // pag cloudfire/js/controllers/AppController.js
  var AppController = class {
    constructor() {
      this.trackingModel = new TrackingModel();
      this.mediaModel = new MediaModel();
      this.storageModel = new StorageModel();
      this.mapView = new MapView("map", (lat, lng) => this.handleMapClick(lat, lng));
      this.dashboardView = new DashboardView();
      this.mediaView = new MediaView(this.mediaModel);
      this.firebaseModalView = new FirebaseModalView(this.storageModel, (isConnected, projId) => {
        this.dashboardView.updateFirebaseStatus(isConnected, projId);
      });
      this.historyModalView = new HistoryModalView(this.storageModel, (session) => {
        this.loadHistoricalRoute(session);
      });
      this.geolocationWatchId = null;
      this.wakeLock = null;
      this.setupModelSubscriptions();
      this.setupUiEventListeners();
    }
    /**
     * Arranca la aplicación
     */
    async init() {
      await this.mapView.init();
      this.startGeolocationWatcher();
      const isFirebaseReady = await this.storageModel.checkAndInitFirebase();
      this.dashboardView.updateFirebaseStatus(isFirebaseReady);
      this.requestWakeLock();
      this.dashboardView.announce("Aplicaci\xF3n de rastreo lista. Conectando con sat\xE9lites GPS...");
    }
    /**
     * Conecta los eventos emitidos por el modelo con las vistas
     */
    setupModelSubscriptions() {
      this.trackingModel.subscribe((eventName, data) => {
        switch (eventName) {
          case "locationUpdated":
            this.mapView.updateUserLocation(data.location);
            if (this.trackingModel.isTracking && !this.trackingModel.isPaused && data.deltaDistance > 0) {
              this.mapView.addPathPoint(data.location);
            }
            this.dashboardView.updateTelemetry(this.trackingModel);
            break;
          case "trackingStarted":
            this.dashboardView.setTrackingState("tracking");
            this.dashboardView.startTimer(this.trackingModel);
            this.dashboardView.announce("Rastreo iniciado con \xE9xito. Registrando distancia y tiempos.");
            this.mediaModel.playStartChime();
            this.triggerHaptic([70, 50, 70]);
            this.requestWakeLock();
            break;
          case "trackingPaused":
            this.dashboardView.setTrackingState("paused");
            this.dashboardView.stopTimer();
            this.dashboardView.announce("Rastreo pausado.");
            this.triggerHaptic([50]);
            break;
          case "trackingResumed":
            this.dashboardView.setTrackingState("tracking");
            this.dashboardView.startTimer(this.trackingModel);
            this.dashboardView.announce("Rastreo reanudado.");
            this.triggerHaptic([70]);
            break;
          case "trackingStopped":
            this.dashboardView.setTrackingState("idle");
            this.dashboardView.stopTimer();
            this.dashboardView.announce("Rastreo finalizado.");
            this.mediaModel.playStopChime();
            this.triggerHaptic([100, 50, 100]);
            this.releaseWakeLock();
            this.handleSaveCurrentSession(data.summary);
            break;
          case "trackingReset":
            this.dashboardView.setTrackingState("idle");
            this.dashboardView.stopTimer();
            this.mapView.clearMapRoute();
            this.dashboardView.updateTelemetry(this.trackingModel);
            break;
          case "destinationUpdated":
            this.mapView.setDestinationMarker(data.destination);
            this.dashboardView.updateTelemetry(this.trackingModel);
            this.dashboardView.announce(`Destino actualizado. Tiempo aproximado estimado: ${this.dashboardView.formatDuration(data.etaSeconds || 0)}.`);
            break;
          case "destinationCleared":
            this.mapView.setDestinationMarker(null);
            this.dashboardView.updateTelemetry(this.trackingModel);
            break;
          case "reverseModeToggled":
            this.dashboardView.updateReverseButton(data.isReversed);
            this.mapView.setReversedPath(data.reversePath, data.isReversed);
            if (data.destination) {
              this.mapView.setDestinationMarker(data.destination);
            }
            this.dashboardView.updateTelemetry(this.trackingModel);
            this.triggerHaptic([60, 40, 60]);
            break;
          case "pointUndone":
            this.mapView.setPath(this.trackingModel.pathHistory);
            this.dashboardView.updateTelemetry(this.trackingModel);
            this.dashboardView.announce("\xDAltimo punto de la ruta deshecho.");
            break;
        }
      });
    }
    /**
     * Conecta los eventos de la interfaz de usuario (botones táctiles y clics)
     */
    setupUiEventListeners() {
      this.dashboardView.btnStart?.addEventListener("click", () => {
        this.trackingModel.start();
      });
      this.dashboardView.btnPause?.addEventListener("click", () => {
        if (this.trackingModel.isPaused) {
          this.trackingModel.resume();
        } else {
          this.trackingModel.pause();
        }
      });
      this.dashboardView.btnStop?.addEventListener("click", () => {
        if (confirm("\xBFDeseas finalizar este recorrido y guardar la sesi\xF3n?")) {
          this.trackingModel.stop();
        }
      });
      this.dashboardView.btnReverse?.addEventListener("click", () => {
        try {
          this.trackingModel.toggleReverseMode();
        } catch (err) {
          alert(err.message);
        }
      });
      this.dashboardView.btnUndo?.addEventListener("click", () => {
        this.trackingModel.undoLastPoint();
      });
      document.getElementById("btn-recenter")?.addEventListener("click", () => {
        if (this.trackingModel.currentLocation) {
          this.mapView.recenterOnUser(this.trackingModel.currentLocation);
        }
      });
      this.dashboardView.btnMedia?.addEventListener("click", () => {
        this.openMediaChoiceDialog();
      });
      this.dashboardView.btnHistory?.addEventListener("click", () => {
        this.historyModalView.open();
      });
      document.getElementById("btn-open-firebase-modal")?.addEventListener("click", () => {
        this.firebaseModalView.open();
      });
      this.dashboardView.firebaseStatusBadge?.addEventListener("click", () => {
        this.firebaseModalView.open();
      });
      this.mediaView.btnCloseCamera?.addEventListener("click", () => {
        this.mediaView.closeCameraModal();
      });
      this.mediaView.btnCapturePhoto?.addEventListener("click", () => {
        const photoItem = this.mediaView.captureSnapshot();
        if (photoItem) {
          this.mapView.addMediaMarker(photoItem);
          this.dashboardView.announce("Foto capturada y anclada al mapa.");
          setTimeout(() => this.mediaView.closeCameraModal(), 1e3);
        }
      });
      this.mediaView.btnCloseAudio?.addEventListener("click", () => {
        this.mediaView.closeAudioModal();
      });
      this.mediaView.btnRecordAudio?.addEventListener("click", () => {
        this.mediaView.startRecordingAudio();
      });
      this.mediaView.btnStopAudio?.addEventListener("click", async () => {
        const audioItem = await this.mediaView.stopRecordingAudio();
        if (audioItem) {
          this.mapView.addMediaMarker(audioItem);
          this.dashboardView.announce("Nota de voz guardada y anclada al mapa.");
        }
      });
      document.getElementById("btn-clear-destination")?.addEventListener("click", () => {
        this.trackingModel.clearDestination();
      });
    }
    /**
     * Activa el observador de geolocalización continua con máxima exactitud
     */
    startGeolocationWatcher() {
      if (!navigator.geolocation) {
        alert("Tu navegador no soporta la API de Geolocalizaci\xF3n de alta precisi\xF3n.");
        return;
      }
      const options = {
        enableHighAccuracy: true,
        // Solicita el chip GPS del dispositivo móvil en lugar de WiFi/Torres
        timeout: 2e4,
        // 20 segundos máximo de espera por satélite
        maximumAge: 0
        // No utilizar posiciones en caché
      };
      this.geolocationWatchId = navigator.geolocation.watchPosition(
        (position) => {
          this.trackingModel.processRawPosition(position);
        },
        (error) => {
          console.warn("[AppController] Error de GPS:", error);
          let errorMsg = "Error al obtener posici\xF3n GPS.";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = "Permiso de ubicaci\xF3n denegado. Por favor conc\xE9delo en los ajustes de tu m\xF3vil.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = "Se\xF1al GPS no disponible. Verifica que la ubicaci\xF3n est\xE9 encendida.";
              break;
            case error.TIMEOUT:
              errorMsg = "Tiempo de espera de GPS agotado. Buscando sat\xE9lites...";
              break;
          }
          this.dashboardView.announce(errorMsg);
        },
        options
      );
    }
    /**
     * Maneja el clic en el mapa para establecer un destino o waypoint
     */
    handleMapClick(lat, lng) {
      this.trackingModel.setDestination(lat, lng, "Punto de destino en mapa");
    }
    /**
     * Presenta al usuario la opción de capturar Foto o Grabar Nota de Voz
     */
    openMediaChoiceDialog() {
      const loc = this.trackingModel.currentLocation;
      if (!loc) {
        alert("Esperando se\xF1al de GPS antes de capturar evidencia multimedia.");
        return;
      }
      const modalChoice = document.getElementById("media-choice-modal");
      if (modalChoice) {
        modalChoice.classList.remove("hidden");
        modalChoice.setAttribute("aria-hidden", "false");
        const btnPhoto = document.getElementById("btn-choice-photo");
        const btnAudio = document.getElementById("btn-choice-audio");
        const btnClose = document.getElementById("btn-close-media-choice");
        const closeHandler = () => {
          modalChoice.classList.add("hidden");
          modalChoice.setAttribute("aria-hidden", "true");
          btnPhoto?.removeEventListener("click", photoHandler);
          btnAudio?.removeEventListener("click", audioHandler);
          btnClose?.removeEventListener("click", closeHandler);
        };
        const photoHandler = () => {
          closeHandler();
          this.mediaView.openCameraModal(loc);
        };
        const audioHandler = () => {
          closeHandler();
          this.mediaView.openAudioModal(loc);
        };
        btnPhoto?.addEventListener("click", photoHandler);
        btnAudio?.addEventListener("click", audioHandler);
        btnClose?.addEventListener("click", closeHandler);
      }
    }
    /**
     * Guarda la sesión actual con persistencia híbrida (local y Firebase)
     */
    async handleSaveCurrentSession(summary) {
      const mediaItems = this.mediaModel.mediaItems;
      try {
        const result = await this.storageModel.saveRouteSession(summary, mediaItems);
        const msg = result.syncedFirebase ? "\xA1Recorrido guardado exitosamente en Cloud Firestore y almacenamiento local!" : "\xA1Recorrido guardado localmente en tu dispositivo!";
        this.dashboardView.announce(msg);
        alert(msg);
      } catch (e) {
        console.error("[AppController] Error al guardar ruta:", e);
        alert(`Error al guardar la sesi\xF3n: ${e.message}`);
      }
    }
    /**
     * Carga una ruta guardada históricamente para visualizarla en el mapa
     */
    loadHistoricalRoute(session) {
      if (!session || !session.summary || !session.summary.path) return;
      this.trackingModel.reset();
      const path = session.summary.path;
      this.mapView.setPath(path);
      if (path.length > 0 && this.mapView.map && window.google?.maps?.LatLngBounds) {
        const bounds = new google.maps.LatLngBounds();
        path.forEach((p) => bounds.extend(new google.maps.LatLng(p.lat, p.lng)));
        this.mapView.map.fitBounds(bounds);
      }
      if (session.media && Array.isArray(session.media)) {
        session.media.forEach((m) => this.mapView.addMediaMarker(m));
      }
      this.dashboardView.announce(`Ruta hist\xF3rica cargada. Distancia: ${session.summary.totalDistanceKm || 0} km.`);
    }
    /**
     * Bloqueo de pantalla (Screen Wake Lock API)
     */
    async requestWakeLock() {
      if ("wakeLock" in navigator) {
        try {
          this.wakeLock = await navigator.wakeLock.request("screen");
          this.wakeLock.addEventListener("release", () => {
            this.wakeLock = null;
          });
        } catch (err) {
          console.warn("[AppController] Wake Lock no disponible:", err.message);
        }
      }
    }
    releaseWakeLock() {
      if (this.wakeLock) {
        this.wakeLock.release().catch(() => {
        });
        this.wakeLock = null;
      }
    }
    /**
     * Vibración háptica en dispositivos móviles compatibles
     */
    triggerHaptic(pattern = [50]) {
      if ("vibrate" in navigator) {
        try {
          navigator.vibrate(pattern);
        } catch (_) {
        }
      }
    }
  };

  // pag cloudfire/js/app.js
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[Cloudfire Tracker] Inicializando aplicaci\xF3n m\xF3vil...");
    const app = new AppController();
    window.cloudfireApp = app;
    window.cloudfireOpenFirebaseModal = () => app.firebaseModalView.open();
    app.init().catch((err) => {
      console.error("[Cloudfire Tracker] Error durante la inicializaci\xF3n:", err);
    });
  });
})();
