/**
 * AppController.js
 * Controlador principal del Patrón MVC:
 * - Orquestador de geolocalización de alta exactitud (watchPosition con enableHighAccuracy).
 * - Manejo de Screen Wake Lock API para mantener activa la pantalla en móviles durante el viaje.
 * - Coordinación de vistas (MapView, DashboardView, MediaView, FirebaseModalView, HistoryModalView).
 * - Manejo de persistencia híbrida y retroalimentación háptica (Vibration API).
 */

import { TrackingModel } from '../models/TrackingModel.js';
import { MediaModel } from '../models/MediaModel.js';
import { StorageModel } from '../models/StorageModel.js';

import { MapView } from '../views/MapView.js';
import { DashboardView } from '../views/DashboardView.js';
import { MediaView } from '../views/MediaView.js';
import { FirebaseModalView } from '../views/FirebaseModalView.js';
import { HistoryModalView } from '../views/HistoryModalView.js';

export class AppController {
  constructor() {
    // 1. Inicializar Modelos
    this.trackingModel = new TrackingModel();
    this.mediaModel = new MediaModel();
    this.storageModel = new StorageModel();

    // 2. Inicializar Vistas
    this.mapView = new MapView('map', (lat, lng) => this.handleMapClick(lat, lng));
    this.dashboardView = new DashboardView();
    this.mediaView = new MediaView(this.mediaModel);
    this.firebaseModalView = new FirebaseModalView(this.storageModel, (isConnected, projId) => {
      this.dashboardView.updateFirebaseStatus(isConnected, projId);
    });
    this.historyModalView = new HistoryModalView(this.storageModel, (session) => {
      this.loadHistoricalRoute(session);
    });

    // Control de GPS y Pantalla
    this.geolocationWatchId = null;
    this.wakeLock = null;

    // Inicializar suscripciones y listeners
    this.setupModelSubscriptions();
    this.setupUiEventListeners();
  }

  /**
   * Arranca la aplicación
   */
  async init() {
    // Inicializar mapa oficial de Google Maps
    await this.mapView.init();

    // Iniciar rastreador de GPS de alta exactitud
    this.startGeolocationWatcher();

    // Comprobar estado de Firebase
    const isFirebaseReady = await this.storageModel.checkAndInitFirebase();
    this.dashboardView.updateFirebaseStatus(isFirebaseReady);

    // Solicitar Wake Lock para mantener encendida la pantalla en móviles
    this.requestWakeLock();

    // Notificación accesible inicial
    this.dashboardView.announce('Aplicación de rastreo lista. Conectando con satélites GPS...');
  }

  /**
   * Conecta los eventos emitidos por el modelo con las vistas
   */
  setupModelSubscriptions() {
    this.trackingModel.subscribe((eventName, data) => {
      switch (eventName) {
        case 'locationUpdated':
          this.mapView.updateUserLocation(data.location);
          if (this.trackingModel.isTracking && !this.trackingModel.isPaused && data.deltaDistance > 0) {
            this.mapView.addPathPoint(data.location);
          }
          this.dashboardView.updateTelemetry(this.trackingModel);
          break;

        case 'trackingStarted':
          this.dashboardView.setTrackingState('tracking');
          this.dashboardView.startTimer(this.trackingModel);
          this.dashboardView.announce('Rastreo iniciado con éxito. Registrando distancia y tiempos.');
          this.mediaModel.playStartChime();
          this.triggerHaptic([70, 50, 70]);
          this.requestWakeLock();
          break;

        case 'trackingPaused':
          this.dashboardView.setTrackingState('paused');
          this.dashboardView.stopTimer();
          this.dashboardView.announce('Rastreo pausado.');
          this.triggerHaptic([50]);
          break;

        case 'trackingResumed':
          this.dashboardView.setTrackingState('tracking');
          this.dashboardView.startTimer(this.trackingModel);
          this.dashboardView.announce('Rastreo reanudado.');
          this.triggerHaptic([70]);
          break;

        case 'trackingStopped':
          this.dashboardView.setTrackingState('idle');
          this.dashboardView.stopTimer();
          this.dashboardView.announce('Rastreo finalizado.');
          this.mediaModel.playStopChime();
          this.triggerHaptic([100, 50, 100]);
          this.releaseWakeLock();
          this.handleSaveCurrentSession(data.summary);
          break;

        case 'trackingReset':
          this.dashboardView.setTrackingState('idle');
          this.dashboardView.stopTimer();
          this.mapView.clearMapRoute();
          this.dashboardView.updateTelemetry(this.trackingModel);
          break;

        case 'destinationUpdated':
          this.mapView.setDestinationMarker(data.destination);
          this.dashboardView.updateTelemetry(this.trackingModel);
          this.dashboardView.announce(`Destino actualizado. Tiempo aproximado estimado: ${this.dashboardView.formatDuration(data.etaSeconds || 0)}.`);
          break;

        case 'destinationCleared':
          this.mapView.setDestinationMarker(null);
          this.dashboardView.updateTelemetry(this.trackingModel);
          break;

        case 'reverseModeToggled':
          this.dashboardView.updateReverseButton(data.isReversed);
          this.mapView.setReversedPath(data.reversePath, data.isReversed);
          if (data.destination) {
            this.mapView.setDestinationMarker(data.destination);
          }
          this.dashboardView.updateTelemetry(this.trackingModel);
          this.triggerHaptic([60, 40, 60]);
          break;

        case 'pointUndone':
          this.mapView.setPath(this.trackingModel.pathHistory);
          this.dashboardView.updateTelemetry(this.trackingModel);
          this.dashboardView.announce('Último punto de la ruta deshecho.');
          break;
      }
    });
  }

  /**
   * Conecta los eventos de la interfaz de usuario (botones táctiles y clics)
   */
  setupUiEventListeners() {
    // Controles de viaje
    this.dashboardView.btnStart?.addEventListener('click', () => {
      this.trackingModel.start();
    });

    this.dashboardView.btnPause?.addEventListener('click', () => {
      if (this.trackingModel.isPaused) {
        this.trackingModel.resume();
      } else {
        this.trackingModel.pause();
      }
    });

    this.dashboardView.btnStop?.addEventListener('click', () => {
      if (confirm('¿Deseas finalizar este recorrido y guardar la sesión?')) {
        this.trackingModel.stop();
      }
    });

    // Modo Reversible (Invertir ruta)
    this.dashboardView.btnReverse?.addEventListener('click', () => {
      try {
        this.trackingModel.toggleReverseMode();
      } catch (err) {
        alert(err.message);
      }
    });

    // Deshacer último punto
    this.dashboardView.btnUndo?.addEventListener('click', () => {
      this.trackingModel.undoLastPoint();
    });

    // Recentrar mapa en el usuario
    document.getElementById('btn-recenter')?.addEventListener('click', () => {
      if (this.trackingModel.currentLocation) {
        this.mapView.recenterOnUser(this.trackingModel.currentLocation);
      }
    });

    // Menú de medios (Cámara / Audio)
    this.dashboardView.btnMedia?.addEventListener('click', () => {
      this.openMediaChoiceDialog();
    });

    // Historial de rutas
    this.dashboardView.btnHistory?.addEventListener('click', () => {
      this.historyModalView.open();
    });

    // Botón de configuración de Firebase
    document.getElementById('btn-open-firebase-modal')?.addEventListener('click', () => {
      this.firebaseModalView.open();
    });
    this.dashboardView.firebaseStatusBadge?.addEventListener('click', () => {
      this.firebaseModalView.open();
    });

    // Eventos del modal de Cámara
    this.mediaView.btnCloseCamera?.addEventListener('click', () => {
      this.mediaView.closeCameraModal();
    });

    this.mediaView.btnCapturePhoto?.addEventListener('click', () => {
      const photoItem = this.mediaView.captureSnapshot();
      if (photoItem) {
        this.mapView.addMediaMarker(photoItem);
        this.dashboardView.announce('Foto capturada y anclada al mapa.');
        setTimeout(() => this.mediaView.closeCameraModal(), 1000);
      }
    });

    // Eventos del modal de Audio
    this.mediaView.btnCloseAudio?.addEventListener('click', () => {
      this.mediaView.closeAudioModal();
    });

    this.mediaView.btnRecordAudio?.addEventListener('click', () => {
      this.mediaView.startRecordingAudio();
    });

    this.mediaView.btnStopAudio?.addEventListener('click', async () => {
      const audioItem = await this.mediaView.stopRecordingAudio();
      if (audioItem) {
        this.mapView.addMediaMarker(audioItem);
        this.dashboardView.announce('Nota de voz guardada y anclada al mapa.');
      }
    });

    // Limpiar destino fijado
    document.getElementById('btn-clear-destination')?.addEventListener('click', () => {
      this.trackingModel.clearDestination();
    });
  }

  /**
   * Activa el observador de geolocalización continua con máxima exactitud
   */
  startGeolocationWatcher() {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta la API de Geolocalización de alta precisión.');
      return;
    }

    const options = {
      enableHighAccuracy: true, // Solicita el chip GPS del dispositivo móvil en lugar de WiFi/Torres
      timeout: 20000,           // 20 segundos máximo de espera por satélite
      maximumAge: 0             // No utilizar posiciones en caché
    };

    this.geolocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        this.trackingModel.processRawPosition(position);
      },
      (error) => {
        console.warn('[AppController] Error de GPS:', error);
        let errorMsg = 'Error al obtener posición GPS.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Permiso de ubicación denegado. Por favor concédelo en los ajustes de tu móvil.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'Señal GPS no disponible. Verifica que la ubicación esté encendida.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Tiempo de espera de GPS agotado. Buscando satélites...';
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
    this.trackingModel.setDestination(lat, lng, 'Punto de destino en mapa');
  }

  /**
   * Presenta al usuario la opción de capturar Foto o Grabar Nota de Voz
   */
  openMediaChoiceDialog() {
    const loc = this.trackingModel.currentLocation;
    if (!loc) {
      alert('Esperando señal de GPS antes de capturar evidencia multimedia.');
      return;
    }

    const modalChoice = document.getElementById('media-choice-modal');
    if (modalChoice) {
      modalChoice.classList.remove('hidden');
      modalChoice.setAttribute('aria-hidden', 'false');

      const btnPhoto = document.getElementById('btn-choice-photo');
      const btnAudio = document.getElementById('btn-choice-audio');
      const btnClose = document.getElementById('btn-close-media-choice');

      const closeHandler = () => {
        modalChoice.classList.add('hidden');
        modalChoice.setAttribute('aria-hidden', 'true');
        btnPhoto?.removeEventListener('click', photoHandler);
        btnAudio?.removeEventListener('click', audioHandler);
        btnClose?.removeEventListener('click', closeHandler);
      };

      const photoHandler = () => {
        closeHandler();
        this.mediaView.openCameraModal(loc);
      };

      const audioHandler = () => {
        closeHandler();
        this.mediaView.openAudioModal(loc);
      };

      btnPhoto?.addEventListener('click', photoHandler);
      btnAudio?.addEventListener('click', audioHandler);
      btnClose?.addEventListener('click', closeHandler);
    }
  }

  /**
   * Guarda la sesión actual con persistencia híbrida (local y Firebase)
   */
  async handleSaveCurrentSession(summary) {
    const mediaItems = this.mediaModel.mediaItems;
    try {
      const result = await this.storageModel.saveRouteSession(summary, mediaItems);
      const msg = result.syncedFirebase
        ? '¡Recorrido guardado exitosamente en Cloud Firestore y almacenamiento local!'
        : '¡Recorrido guardado localmente en tu dispositivo!';
      this.dashboardView.announce(msg);
      alert(msg);
    } catch (e) {
      console.error('[AppController] Error al guardar ruta:', e);
      alert(`Error al guardar la sesión: ${e.message}`);
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
      path.forEach(p => bounds.extend(new google.maps.LatLng(p.lat, p.lng)));
      this.mapView.map.fitBounds(bounds);
    }

    // Cargar evidencias multimedia si las tuviera
    if (session.media && Array.isArray(session.media)) {
      session.media.forEach(m => this.mapView.addMediaMarker(m));
    }

    this.dashboardView.announce(`Ruta histórica cargada. Distancia: ${session.summary.totalDistanceKm || 0} km.`);
  }

  /**
   * Bloqueo de pantalla (Screen Wake Lock API)
   */
  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      } catch (err) {
        console.warn('[AppController] Wake Lock no disponible:', err.message);
      }
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  /**
   * Vibración háptica en dispositivos móviles compatibles
   */
  triggerHaptic(pattern = [50]) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }
}
