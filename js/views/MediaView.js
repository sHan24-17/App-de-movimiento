/**
 * MediaView.js
 * Vista del Patrón MVC para gestión accesible de las APIs Media:
 * - Visor interactivo para cámara fotográfica trasera con geotagueado.
 * - Grabadora de notas de voz con temporizador y controles táctiles.
 * - Diálogos modales con atributos ARIA y trampa de foco para accesibilidad WCAG AA.
 */

export class MediaView {
  constructor(mediaModel) {
    this.model = mediaModel;

    // Elementos del DOM - Modal de Cámara
    this.cameraModal = document.getElementById('camera-modal');
    this.cameraVideo = document.getElementById('camera-video');
    this.btnCapturePhoto = document.getElementById('btn-capture-photo');
    this.btnCloseCamera = document.getElementById('btn-close-camera');
    this.photoNoteInput = document.getElementById('photo-note-input');
    this.photoPreviewContainer = document.getElementById('photo-preview-container');
    this.photoPreviewImg = document.getElementById('photo-preview-img');

    // Elementos del DOM - Modal de Audio
    this.audioModal = document.getElementById('audio-modal');
    this.btnRecordAudio = document.getElementById('btn-record-audio');
    this.btnStopAudio = document.getElementById('btn-stop-audio');
    this.btnCloseAudio = document.getElementById('btn-close-audio');
    this.audioTimer = document.getElementById('audio-timer');
    this.audioNoteInput = document.getElementById('audio-note-input');
    this.audioPlayer = document.getElementById('audio-player');
    this.audioRecordingIndicator = document.getElementById('audio-recording-indicator');

    // Intervalo de cronómetro para grabación de audio
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
    this.cameraModal.classList.remove('hidden');
    this.cameraModal.setAttribute('aria-hidden', 'false');

    // Limpiar vistas previas
    if (this.photoPreviewContainer) this.photoPreviewContainer.classList.add('hidden');
    if (this.cameraVideo) this.cameraVideo.classList.remove('hidden');
    if (this.photoNoteInput) this.photoNoteInput.value = '';

    try {
      await this.model.startCamera(this.cameraVideo);
      this.btnCapturePhoto?.focus();
    } catch (err) {
      alert(`No se pudo acceder a la cámara: ${err.message}. Comprueba los permisos de tu dispositivo.`);
      this.closeCameraModal();
    }
  }

  /**
   * Cierra el modal de la cámara y libera el hardware
   */
  closeCameraModal() {
    if (!this.cameraModal) return;
    this.model.stopCamera();
    this.cameraModal.classList.add('hidden');
    this.cameraModal.setAttribute('aria-hidden', 'true');
  }

  /**
   * Captura la foto y muestra la vista previa antes de confirmar
   * @returns {Object|null}
   */
  captureSnapshot() {
    if (!this.cameraVideo) return null;
    const note = this.photoNoteInput ? this.photoNoteInput.value.trim() : '';

    try {
      const photoItem = this.model.capturePhotoFromVideo(
        this.cameraVideo,
        this.currentLocation,
        note
      );

      // Mostrar vista previa instantánea
      if (this.photoPreviewImg && this.photoPreviewContainer) {
        this.photoPreviewImg.src = photoItem.dataUrl;
        this.photoPreviewContainer.classList.remove('hidden');
        this.cameraVideo.classList.add('hidden');
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
    this.audioModal.classList.remove('hidden');
    this.audioModal.setAttribute('aria-hidden', 'false');

    if (this.audioNoteInput) this.audioNoteInput.value = '';
    if (this.audioPlayer) {
      this.audioPlayer.src = '';
      this.audioPlayer.classList.add('hidden');
    }
    if (this.audioTimer) this.audioTimer.textContent = '00:00';
    if (this.btnRecordAudio) this.btnRecordAudio.disabled = false;
    if (this.btnStopAudio) this.btnStopAudio.disabled = true;
    if (this.audioRecordingIndicator) this.audioRecordingIndicator.classList.add('hidden');
  }

  /**
   * Cierra el modal de notas de voz
   */
  closeAudioModal() {
    if (!this.audioModal) return;
    this.stopAudioTimer();
    this.audioModal.classList.add('hidden');
    this.audioModal.setAttribute('aria-hidden', 'true');
  }

  /**
   * Comienza la grabación de audio
   */
  async startRecordingAudio() {
    try {
      await this.model.startAudioRecording();
      if (this.btnRecordAudio) this.btnRecordAudio.disabled = true;
      if (this.btnStopAudio) this.btnStopAudio.disabled = false;
      if (this.audioRecordingIndicator) this.audioRecordingIndicator.classList.remove('hidden');

      this.audioStartTime = Date.now();
      this.audioInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - this.audioStartTime) / 1000);
        const mm = Math.floor(sec / 60).toString().padStart(2, '0');
        const ss = (sec % 60).toString().padStart(2, '0');
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
    const note = this.audioNoteInput ? this.audioNoteInput.value.trim() : '';

    try {
      const audioItem = await this.model.stopAudioRecording(this.currentLocation, note);
      if (this.audioPlayer && audioItem.audioBlobUrl) {
        this.audioPlayer.src = audioItem.audioBlobUrl;
        this.audioPlayer.classList.remove('hidden');
      }
      if (this.btnRecordAudio) this.btnRecordAudio.disabled = false;
      if (this.btnStopAudio) this.btnStopAudio.disabled = true;
      if (this.audioRecordingIndicator) this.audioRecordingIndicator.classList.add('hidden');

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
}
