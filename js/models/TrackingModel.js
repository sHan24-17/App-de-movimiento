/**
 * TrackingModel.js
 * Modelo del Patrón MVC para cálculo de telemetría de máxima exactitud:
 * - Algoritmo de Haversine de alta precisión geodésica.
 * - Filtro adaptativo de ruido y jitter de GPS móvil.
 * - Cálculo de rumbos (azimut/heading) para rotar el icono móvil.
 * - Estimación dinámica de Tiempos Aprox. (ETA) y Velocidad promedio.
 * - Funcionalidad Reversible (cálculo de trayecto inverso de retorno y retroceso de ruta).
 */

export class TrackingModel {
  constructor() {
    this.RADIO_TIERRA_METROS = 6371008.8; // Radio medio volumétrico IUGG de la Tierra

    // Estado de la sesión de rastreo
    this.isTracking = false;
    this.isPaused = false;
    this.isReversed = false; // Modo reversible activado

    // Tiempos
    this.startTime = null;
    this.pausedTime = null;
    this.totalPausedDuration = 0; // ms acumulados en pausa

    // Distancias y velocidades
    this.totalDistanceMeters = 0;
    this.currentSpeedKmh = 0;
    this.averageSpeedKmh = 0;
    this.maxSpeedKmh = 0;

    // Coordenadas
    this.currentLocation = null; // { lat, lng, accuracy, altitude, speed, heading, timestamp }
    this.previousLocation = null;
    this.pathHistory = []; // Array de todas las coordenadas válidas registradas

    // Destino seleccionado para cálculo de ETA
    this.destination = null; // { lat, lng, name }
    this.etaSeconds = null; // Tiempo estimado de llegada al destino o retorno

    // Tolerancias de exactitud para dispositivos móviles
    this.MAX_ACCURACY_THRESHOLD_METERS = 35.0; // Descartar mediciones con error > 35m
    this.MIN_MOVEMENT_DELTA_METERS = 2.0; // Descartar ruido estacionario menor a 2m

    // Suscriptores del modelo (Observer Pattern)
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
        console.error('[TrackingModel] Error en listener:', err);
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
      this.notify('trackingStarted');
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
      this.notify('trackingPaused');
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
      this.notify('trackingResumed');
    }
  }

  /**
   * Detiene el rastreo y consolida la ruta
   */
  stop() {
    if (this.isTracking) {
      this.isTracking = false;
      this.isPaused = false;
      this.notify('trackingStopped', {
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
    this.notify('trackingReset');
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

    // Filtro 1: Rechazar lecturas con incertidumbre mayor al umbral si ya tenemos puntos previos
    if (rawAccuracy > this.MAX_ACCURACY_THRESHOLD_METERS && this.pathHistory.length > 2) {
      console.warn(`[TrackingModel] Descartada lectura por baja exactitud: ±${rawAccuracy.toFixed(1)}m`);
      return false;
    }

    const currentLat = coords.latitude;
    const currentLng = coords.longitude;

    // Calcular Rumbo (Heading): Si el hardware no lo provee, calcularlo matemáticamente
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
      heading: heading,
      timestamp: timestamp
    };

    // Si aún no hemos iniciado el viaje, guardamos la ubicación actual para posicionar el icono
    if (!this.isTracking) {
      this.currentLocation = newLocation;
      this.notify('locationUpdated', { location: newLocation, deltaDistance: 0 });
      return true;
    }

    // Si estamos en pausa, actualizamos la posición del icono sin acumular distancia
    if (this.isPaused) {
      this.currentLocation = newLocation;
      this.notify('locationUpdated', { location: newLocation, deltaDistance: 0 });
      return true;
    }

    // Si es el primer punto en rastreo activo
    if (!this.previousLocation) {
      this.previousLocation = newLocation;
      this.currentLocation = newLocation;
      this.pathHistory.push(newLocation);
      this.notify('locationUpdated', { location: newLocation, deltaDistance: 0 });
      return true;
    }

    // Calcular distancia delta entre la posición previa y la nueva usando Haversine
    const deltaDistance = this.calculateHaversineDistance(
      this.previousLocation.lat,
      this.previousLocation.lng,
      currentLat,
      currentLng
    );

    // Filtro 2: Filtrado de ruido estacionario (GPS Drift)
    // Si la distancia es menor a 2 metros y la velocidad es prácticamente nula, ignorar acumulación
    if (deltaDistance < this.MIN_MOVEMENT_DELTA_METERS) {
      this.currentSpeedKmh = 0;
      this.currentLocation = newLocation;
      this.notify('locationUpdated', { location: newLocation, deltaDistance: 0 });
      return false;
    }

    // Acumular distancia recorrida
    this.totalDistanceMeters += deltaDistance;

    // Cálculo de velocidad (si el dispositivo no la aporta en m/s)
    let speedMps = newLocation.speed;
    const timeDeltaSeconds = (timestamp - this.previousLocation.timestamp) / 1000;
    if ((speedMps === 0 || isNaN(speedMps)) && timeDeltaSeconds > 0) {
      speedMps = deltaDistance / timeDeltaSeconds;
    }

    this.currentSpeedKmh = Math.max(0, speedMps * 3.6);
    if (this.currentSpeedKmh > this.maxSpeedKmh) {
      this.maxSpeedKmh = this.currentSpeedKmh;
    }

    // Calcular velocidad promedio del recorrido activo
    const elapsedSeconds = this.getElapsedSeconds();
    if (elapsedSeconds > 0) {
      this.averageSpeedKmh = (this.totalDistanceMeters / elapsedSeconds) * 3.6;
    }

    // Actualizar historial
    this.previousLocation = newLocation;
    this.currentLocation = newLocation;
    this.pathHistory.push(newLocation);

    // Recalcular ETA dinámico
    this.recalculateEta();

    // Notificar a las vistas
    this.notify('locationUpdated', {
      location: newLocation,
      deltaDistance: deltaDistance
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
    const toRad = (angle) => (angle * Math.PI) / 180.0;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

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
    const toRad = (angle) => (angle * Math.PI) / 180.0;
    const toDeg = (angle) => (angle * 180.0) / Math.PI;

    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);
    const dLon = toRad(lon2 - lon1);

    const y = Math.sin(dLon) * Math.cos(rLat2);
    const x =
      Math.cos(rLat1) * Math.sin(rLat2) -
      Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);

    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
  }

  /**
   * Establece un destino manual para calcular distancia y tiempo estimado (ETA)
   * @param {number} lat 
   * @param {number} lng 
   * @param {string} name 
   */
  setDestination(lat, lng, name = 'Destino seleccionado') {
    this.destination = { lat, lng, name };
    this.recalculateEta();
    this.notify('destinationUpdated', { destination: this.destination, etaSeconds: this.etaSeconds });
  }

  /**
   * Limpia el destino seleccionado
   */
  clearDestination() {
    this.destination = null;
    this.etaSeconds = null;
    this.notify('destinationCleared');
  }

  /**
   * Alterna el Modo Reversible:
   * Permite invertir el trayecto recorrido para guiar al usuario de regreso
   * por los mismos puntos exactos hasta el punto de inicio original.
   */
  toggleReverseMode() {
    if (this.pathHistory.length < 2) {
      throw new Error('Se requieren al menos 2 puntos registrados para invertir la ruta.');
    }

    this.isReversed = !this.isReversed;

    if (this.isReversed) {
      // Establecer el destino como el punto de inicio de la ruta (origen)
      const originPoint = this.pathHistory[0];
      this.destination = {
        lat: originPoint.lat,
        lng: originPoint.lng,
        name: 'Punto de Inicio (Ruta Inversa)'
      };
    }

    this.recalculateEta();

    this.notify('reverseModeToggled', {
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
    // Recalcular distancia total acumulada
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
    this.notify('pointUndone', { removed, currentCount: this.pathHistory.length });
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

    // Determinar velocidad efectiva en m/s para la proyección temporal
    let effectiveSpeedMps = (this.currentSpeedKmh / 3.6);
    if (effectiveSpeedMps < 0.5) {
      // Si está detenido o muy lento, usar la velocidad promedio del viaje
      effectiveSpeedMps = (this.averageSpeedKmh / 3.6);
    }
    if (effectiveSpeedMps < 0.5) {
      // Ritmo peatonal estándar base (4.5 km/h = 1.25 m/s)
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
    return Math.max(0, Math.floor(elapsedMs / 1000));
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
      totalDistanceKm: Math.round((this.totalDistanceMeters / 1000) * 100) / 100,
      averageSpeedKmh: Math.round(this.averageSpeedKmh * 10) / 10,
      maxSpeedKmh: Math.round(this.maxSpeedKmh * 10) / 10,
      pointsCount: this.pathHistory.length,
      isReversed: this.isReversed,
      path: this.pathHistory.map(p => ({
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
}
