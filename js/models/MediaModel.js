/**
 * MediaModel.js
 * Modelo del Patrón MVC para interactuar con las APIs Media del navegador:
 * 1. navigator.mediaDevices.getUserMedia (Cámara en tiempo real para fotos geotagueadas)
 * 2. MediaRecorder API (Grabación de notas de audio asociadas a las coordenadas actuales)
 * 3. Web Audio API (Generación de señales acústicas accesibles WCAG AA para invidentes y avisos en ruta)
 */

export class MediaModel {
  constructor() {
    this.cameraStream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecordingAudio = false;

    // Lista de evidencias capturadas en la sesión actual
    // Cada elemento: { id, type: 'photo' | 'audio', dataUrl, blob, location, timestamp, note }
    this.mediaItems = [];

    // Contexto de Web Audio para retroalimentación sonora accesible
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
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
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
  playTone(frequency = 440, duration = 0.2, type = 'sine') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('[MediaModel] No se pudo reproducir tono asistivo:', e);
    }
  }

  /**
   * Sonido asistivo de inicio de viaje
   */
  playStartChime() {
    this.playTone(523.25, 0.15); // Do
    setTimeout(() => this.playTone(659.25, 0.15), 120); // Mi
    setTimeout(() => this.playTone(783.99, 0.25), 240); // Sol
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
    this.playTone(880, 0.12, 'triangle');
  }

  /**
   * Inicia la cámara trasera preferentemente (dispositivo móvil)
   * @param {HTMLVideoElement} videoElement Elemento de video receptor
   * @returns {Promise<MediaStream>}
   */
  async startCamera(videoElement) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('La API MediaDevices no es soportada por este navegador.');
    }

    // Detener stream previo si existiera
    this.stopCamera();

    const constraints = {
      video: {
        facingMode: { ideal: 'environment' }, // Cámara trasera ideal para fotos en camino
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
      console.warn('[MediaModel] Fallo cámara trasera, intentando cualquier cámara:', err);
      // Fallback a cualquier cámara disponible
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
  capturePhotoFromVideo(videoElement, currentLocation, userNote = '') {
    if (!videoElement || videoElement.videoWidth === 0) {
      throw new Error('El stream de video no está listo para captura.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');

    // Dibujar frame actual
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Si hay datos geográficos, dibujar franja de telemetría accesible
    if (currentLocation) {
      const bannerHeight = 44;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      const geoText = `GPS: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)} | ±${currentLocation.accuracy.toFixed(1)}m`;
      const timeText = new Date().toLocaleTimeString();
      ctx.fillText(`${geoText} - ${timeText}`, 14, canvas.height - 16);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    const mediaItem = {
      id: 'photo_' + Date.now(),
      type: 'photo',
      dataUrl: dataUrl,
      location: currentLocation ? { ...currentLocation } : null,
      timestamp: Date.now(),
      note: userNote || 'Evidencia fotográfica en ruta'
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
      throw new Error('La API MediaDevices de audio no es soportada.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioChunks = [];

    // Opciones MIME seguras entre Android/Chrome y iOS Safari
    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else {
        mimeType = '';
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
  async stopAudioRecording(currentLocation, userNote = '') {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No hay grabación activa de audio.'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Convertir a Base64 para persistencia local y remota
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result;

          const audioItem = {
            id: 'audio_' + Date.now(),
            type: 'audio',
            dataUrl: base64Audio,
            audioBlobUrl: audioUrl,
            location: currentLocation ? { ...currentLocation } : null,
            timestamp: Date.now(),
            note: userNote || 'Nota de voz en recorrido'
          };

          this.mediaItems.push(audioItem);
          this.isRecordingAudio = false;
          this.playTone(440, 0.15);

          // Detener tracks del micrófono
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
}
