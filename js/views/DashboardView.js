/**
 * DashboardView.js
 * Vista del Patrón MVC para el panel de telemetría y controles:
 * - Cumplimiento WCAG 2.1 AA con locuciones dinámicas en regiones aria-live.
 * - Formateo de alta precisión para distancias, velocidades y tiempos estimados (ETA).
 * - Control de estados de los botones de acción para interfaces móviles.
 */

export class DashboardView {
  constructor() {
    // Elementos de telemetría en el DOM
    this.statDistance = document.getElementById('stat-distance');
    this.statElapsedTime = document.getElementById('stat-elapsed-time');
    this.statSpeed = document.getElementById('stat-speed');
    this.statAvgSpeed = document.getElementById('stat-avg-speed');
    this.statEta = document.getElementById('stat-eta');
    this.statEtaLabel = document.getElementById('stat-eta-label');
    this.statAccuracy = document.getElementById('stat-accuracy');
    this.statAccuracyBadge = document.getElementById('stat-accuracy-badge');

    // Botones de acción
    this.btnStart = document.getElementById('btn-start');
    this.btnPause = document.getElementById('btn-pause');
    this.btnStop = document.getElementById('btn-stop');
    this.btnReverse = document.getElementById('btn-reverse');
    this.btnMedia = document.getElementById('btn-media');
    this.btnHistory = document.getElementById('btn-history');
    this.btnUndo = document.getElementById('btn-undo');

    // Insignias de estado
    this.trackingStatusBadge = document.getElementById('tracking-status-badge');
    this.firebaseStatusBadge = document.getElementById('firebase-status-badge');

    // Región ARIA Live para lectores de pantalla (WCAG AA)
    this.a11yAnnouncer = document.getElementById('a11y-announcer');

    // Intervalo de temporizador en vivo para el cronómetro
    this.timerInterval = null;
  }

  /**
   * Anuncia un cambio de estado al lector de pantalla de forma accesible
   * @param {string} message 
   */
  announce(message) {
    if (this.a11yAnnouncer) {
      this.a11yAnnouncer.textContent = '';
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
    // 1. Distancia formateada
    if (this.statDistance) {
      const meters = model.totalDistanceMeters;
      if (meters < 1000) {
        this.statDistance.textContent = `${Math.round(meters)} m`;
      } else {
        this.statDistance.textContent = `${(meters / 1000).toFixed(2)} km`;
      }
    }

    // 2. Velocidad instantánea y promedio
    if (this.statSpeed) {
      this.statSpeed.textContent = `${model.currentSpeedKmh.toFixed(1)} km/h`;
    }
    if (this.statAvgSpeed) {
      this.statAvgSpeed.textContent = `Prom: ${model.averageSpeedKmh.toFixed(1)} km/h`;
    }

    // 3. Precisión de GPS móvil con indicador de color
    if (this.statAccuracy && model.currentLocation) {
      const acc = model.currentLocation.accuracy;
      this.statAccuracy.textContent = `±${acc.toFixed(0)}m`;

      if (this.statAccuracyBadge) {
        if (acc <= 10) {
          this.statAccuracyBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300';
          this.statAccuracyBadge.title = 'Señal satelital óptima';
        } else if (acc <= 25) {
          this.statAccuracyBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300';
          this.statAccuracyBadge.title = 'Señal satelital moderada';
        } else {
          this.statAccuracyBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300';
          this.statAccuracyBadge.title = 'Señal satelital con dispersión';
        }
      }
    }

    // 4. Tiempo estimado / ETA aproximado
    if (this.statEta) {
      if (model.etaSeconds !== null && model.destination) {
        this.statEta.textContent = this.formatDuration(model.etaSeconds);
        if (this.statEtaLabel) {
          this.statEtaLabel.textContent = model.isReversed ? 'Tiempo de Retorno (ETA)' : 'Tiempo Aprox. al Destino';
        }
      } else {
        this.statEta.textContent = '--:--';
        if (this.statEtaLabel) {
          this.statEtaLabel.textContent = 'Tiempo Aprox. (Fija un punto)';
        }
      }
    }

    // 5. Botón de Deshacer (Undo)
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
    }, 1000);
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

    if (state === 'idle') {
      this.btnStart.classList.remove('hidden');
      this.btnStart.textContent = '▶ Iniciar Viaje';
      this.btnStart.setAttribute('aria-label', 'Iniciar registro de recorrido');

      this.btnPause.classList.add('hidden');
      this.btnStop.classList.add('hidden');

      if (this.trackingStatusBadge) {
        this.trackingStatusBadge.textContent = 'En Espera';
        this.trackingStatusBadge.className = 'px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700';
      }
    } else if (state === 'tracking') {
      this.btnStart.classList.add('hidden');

      this.btnPause.classList.remove('hidden');
      this.btnPause.textContent = '⏸ Pausar';
      this.btnPause.setAttribute('aria-label', 'Pausar recorrido temporalmente');

      this.btnStop.classList.remove('hidden');

      if (this.trackingStatusBadge) {
        this.trackingStatusBadge.textContent = '● En Movimiento';
        this.trackingStatusBadge.className = 'px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse';
      }
    } else if (state === 'paused') {
      this.btnStart.classList.add('hidden');

      this.btnPause.classList.remove('hidden');
      this.btnPause.textContent = '▶ Reanudar';
      this.btnPause.setAttribute('aria-label', 'Reanudar recorrido');

      this.btnStop.classList.remove('hidden');

      if (this.trackingStatusBadge) {
        this.trackingStatusBadge.textContent = '⏸ En Pausa';
        this.trackingStatusBadge.className = 'px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800';
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
      this.btnReverse.classList.add('bg-amber-600', 'text-white', 'hover:bg-amber-700', 'border-amber-700');
      this.btnReverse.classList.remove('bg-white', 'text-slate-700', 'hover:bg-slate-100', 'border-slate-300');
      this.btnReverse.setAttribute('aria-pressed', 'true');
      this.btnReverse.innerHTML = `<span>🔄</span><span>Retorno Activo</span>`;
      this.announce('Modo Reversible activado. Guiando trayecto de retorno al punto de inicio.');
    } else {
      this.btnReverse.classList.remove('bg-amber-600', 'text-white', 'hover:bg-amber-700', 'border-amber-700');
      this.btnReverse.classList.add('bg-white', 'text-slate-700', 'hover:bg-slate-100', 'border-slate-300');
      this.btnReverse.setAttribute('aria-pressed', 'false');
      this.btnReverse.innerHTML = `<span>🔄</span><span>Invertir Ruta</span>`;
      this.announce('Modo Reversible desactivado.');
    }
  }

  /**
   * Actualiza el badge de conexión con Firebase
   * @param {boolean} isConnected 
   * @param {string} projectName 
   */
  updateFirebaseStatus(isConnected, projectName = '') {
    if (!this.firebaseStatusBadge) return;

    if (isConnected) {
      this.firebaseStatusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300';
      this.firebaseStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span><span>Firebase: Conectado</span>`;
      this.firebaseStatusBadge.title = `Sincronizando con Cloud Firestore (${projectName || 'Activo'})`;
    } else {
      this.firebaseStatusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300';
      this.firebaseStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span><span>Persistencia Local (Sin Firebase)</span>`;
      this.firebaseStatusBadge.title = 'Pulsa para conectar Cloud Firestore';
    }
  }

  /**
   * Convierte segundos en formato legible HH:MM:SS
   * @param {number} totalSeconds 
   * @returns {string}
   */
  formatTimeHHMMSS(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');
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
      return `${minutes} min ${remainingSec > 0 ? remainingSec + 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours} h ${remMin} min`;
  }
}
