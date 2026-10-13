/**
 * MapView.js
 * Vista del Patrón MVC para el mapa interactivo de alta exactitud:
 * - Renderizado de calles reales (OpenStreetMap) y satélite real de alta resolución (Esri World Imagery).
 * - Control de capas para alternar libremente entre calles, satélite y terreno.
 * - Icono dinámico con efecto de pulso radar y flecha de rumbo (heading) orientada por brújula/movimiento.
 * - Halo de precisión satelital dinámico (L.circle).
 * - Trazado geodésico de ruta en vivo y ruta reversible punteada (L.polyline).
 * - Marcadores multimedia geolocalizados con fotos y notas de voz (L.popup).
 * - Centrado ergonómico y seguimiento automático adaptado a pantallas táctiles.
 */

export class MapView {
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

    // Estado de seguimiento automático
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
      console.error(`[MapView] No se encontró el contenedor del mapa: #${this.containerId}`);
      return;
    }

    // Asegurarse de que Leaflet esté disponible
    if (typeof L === 'undefined') {
      console.warn('[MapView] Leaflet no detectado en ventana global, esperando script...');
      await this.ensureLeafletLoaded();
    }

    // Si ya había una instancia previa, limpiarla
    if (this.map) {
      try {
        this.map.remove();
      } catch (_) {}
    }

    // Capa 1: Calles Reales (OpenStreetMap Standard)
    const streetsLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
    });

    // Capa 2: Satélite Real de Alta Resolución (Esri World Imagery)
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Satélite Real de Alta Fidelidad'
    });

    // Capa 3: Calles Modernas Claras (CartoDB Voyager)
    const voyagerLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; CartoDB &copy; OpenStreetMap'
    });

    // Instanciar mapa centrado
    this.map = L.map(this.containerId, {
      center: [defaultLat, defaultLng],
      zoom: defaultZoom,
      layers: [streetsLayer],
      zoomControl: false // Lo colocamos en una esquina óptima para móviles
    });

    // Control de zoom en la esquina superior derecha
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Control de selector de capas (Calles Reales vs Satélite Real)
    const baseMaps = {
      '🗺️ Calles Reales': streetsLayer,
      '🛰️ Satélite Real': satelliteLayer,
      '🏙️ Cartografía Clara': voyagerLayer
    };
    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(this.map);

    // Polilínea de la ruta recorrida en vivo
    this.routePolyline = L.polyline([], {
      color: '#2563eb',
      weight: 6,
      opacity: 0.9,
      smoothFactor: 1
    }).addTo(this.map);

    // Polilínea de ruta inversa (Modo Reversible con guiones ámbar)
    this.reversePolyline = L.polyline([], {
      color: '#f59e0b',
      weight: 5,
      opacity: 0.95,
      dashArray: '8, 12'
    }).addTo(this.map);

    // Escuchar clics en el mapa para fijar destinos
    this.map.on('click', (e) => {
      if (this.onMapClickCallback && e.latlng) {
        this.onMapClickCallback(e.latlng.lat, e.latlng.lng);
      }
    });

    // Desactivar seguimiento automático si el usuario arrastra manualmente el mapa
    this.map.on('dragstart', () => {
      this.isFollowUser = false;
      this.onFollowStateChanged(false);
    });

    // Forzar recalculo de dimensiones del mapa para evitar cortes de pantalla
    setTimeout(() => {
      this.map.invalidateSize();
    }, 200);

    console.log('[MapView] Mapa interactivo real cargado con éxito (OpenStreetMap + Satélite Esri).');
  }

  /**
   * Garantiza que la librería Leaflet se descargue si no está en el head
   */
  async ensureLeafletLoaded() {
    if (typeof L !== 'undefined') return Promise.resolve();

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve();
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    });
  }

  /**
   * Notifica cuando el usuario interactúa manualmente con el mapa
   */
  onFollowStateChanged(isFollowing) {
    const btn = document.getElementById('btn-recenter');
    if (btn) {
      if (isFollowing) {
        btn.classList.add('hidden');
      } else {
        btn.classList.remove('hidden');
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
      className: 'user-marker-leaflet-wrapper',
      html: `
        <div class="user-marker-container">
          <div class="user-marker-pulse" aria-hidden="true"></div>
          <div class="user-marker-heading" style="${headingStyle}" aria-hidden="true"></div>
          <div class="user-marker-core" title="Tu ubicación en el mapa real"></div>
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
    const heading = typeof location.heading === 'number' && !isNaN(location.heading)
      ? location.heading
      : this.lastHeading;
    this.lastHeading = heading;

    if (!this.userMarker) {
      // 1. Crear marcador con icono animado de radar
      this.userMarker = L.marker(latLng, {
        icon: this.createUserIcon(heading),
        zIndexOffset: 1000
      }).addTo(this.map);

      // 2. Halo dinámico de precisión satelital
      this.accuracyCircle = L.circle(latLng, {
        radius: Math.max(5, location.accuracy || 10),
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        weight: 1.5
      }).addTo(this.map);

      this.map.setView(latLng, 18);
    } else {
      // Mover marcador existente y actualizar rotación
      this.userMarker.setLatLng(latLng);

      const headingEl = this.userMarker.getElement()?.querySelector('.user-marker-heading');
      if (headingEl) {
        headingEl.style.transform = `rotate(${heading}deg) translateY(-8px)`;
      }

      // Actualizar halo de precisión
      if (this.accuracyCircle) {
        this.accuracyCircle.setLatLng(latLng);
        this.accuracyCircle.setRadius(Math.max(5, location.accuracy || 10));
      }

      // Desplazamiento automático si el centrado está activo
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
    const latLngs = pathHistory.map(p => [p.lat, p.lng]);
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
      const latLngs = reversedPath.map(p => [p.lat, p.lng]);
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
      className: 'dest-marker-wrapper',
      html: `
        <div style="font-size: 26px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4)); text-align: center; transform: translate(-50%, -100%);">
          📍
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [0, 0]
    });

    if (!this.destinationMarker) {
      this.destinationMarker = L.marker(latLng, {
        icon: destinationIcon,
        title: destination.name || 'Destino seleccionado'
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

    const isPhoto = mediaItem.type === 'photo';
    const latLng = [mediaItem.location.lat, mediaItem.location.lng];

    const iconHtml = isPhoto
      ? `<div style="background-color: #10b981; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">📷</div>`
      : `<div style="background-color: #8b5cf6; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">🎤</div>`;

    const mediaIcon = L.divIcon({
      className: 'media-marker-wrapper',
      html: iconHtml,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const marker = L.marker(latLng, {
      icon: mediaIcon,
      title: isPhoto ? 'Foto en ruta' : 'Nota de voz'
    }).addTo(this.map);

    let popupContent = `
      <div style="max-width: 230px; font-family: sans-serif; padding: 4px;">
        <h4 style="margin: 0 0 4px 0; font-weight: bold; font-size: 0.9rem; color: #0f172a;">${isPhoto ? '📷 Foto en ruta' : '🎤 Nota de voz'}</h4>
        <p style="margin: 0 0 6px 0; font-size: 0.8rem; color: #64748b;">${new Date(mediaItem.timestamp).toLocaleTimeString()}</p>
        <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #1e293b;">${mediaItem.note || ''}</p>
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
    this.mediaMarkers.forEach(m => this.map.removeLayer(m));
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
}
