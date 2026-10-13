/**
 * HistoryModalView.js
 * Vista del Patrón MVC para consultar el historial de rutas persistidas:
 * - Lista de sesiones locales y sincronizadas en Cloud Firestore.
 * - Resúmenes accesibles de distancias, tiempos y velocidades.
 * - Opciones para cargar ruta previa en el mapa o eliminarla.
 */

export class HistoryModalView {
  constructor(storageModel, onSelectRouteCallback) {
    this.storageModel = storageModel;
    this.onSelectRouteCallback = onSelectRouteCallback;

    this.modal = document.getElementById('history-modal');
    this.btnClose = document.getElementById('btn-close-history-modal');
    this.sessionsListContainer = document.getElementById('history-sessions-list');

    this.btnClose?.addEventListener('click', () => this.close());
  }

  /**
   * Abre el modal y renderiza las sesiones guardadas
   */
  async open() {
    if (!this.modal) return;
    this.modal.classList.remove('hidden');
    this.modal.setAttribute('aria-hidden', 'false');

    await this.renderSessions();
  }

  /**
   * Cierra el modal
   */
  close() {
    if (!this.modal) return;
    this.modal.classList.add('hidden');
    this.modal.setAttribute('aria-hidden', 'true');
  }

  /**
   * Renderiza el listado de sesiones
   */
  async renderSessions() {
    if (!this.sessionsListContainer) return;

    let sessions = this.storageModel.getLocalSessions();

    // Sincronizar sesiones desde la nube de Firebase si está disponible
    if (this.storageModel.hasFirebase && this.storageModel.isOnline) {
      try {
        const remoteSessions = await this.storageModel.getRemoteSessions();
        if (remoteSessions && remoteSessions.length > 0) {
          const ids = new Set(sessions.map(s => s.id));
          remoteSessions.forEach((r) => {
            if (!ids.has(r.id)) {
              sessions.push(r);
            }
          });
          sessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }
      } catch (_) {}
    }

    if (sessions.length === 0) {
      this.sessionsListContainer.innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <p class="text-4xl mb-2">🗺️</p>
          <p class="font-medium">No hay rutas guardadas aún.</p>
          <p class="text-sm text-slate-400 mt-1">Inicia un recorrido con el botón "Iniciar Viaje" y guárdalo al terminar.</p>
        </div>
      `;
      return;
    }

    this.sessionsListContainer.innerHTML = sessions.map((session, index) => {
      const summary = session.summary || {};
      const dateFormatted = new Date(session.timestamp).toLocaleDateString('es-ES', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
              <span>📍 ${dist}</span>
              <span>⏱️ ${timeMin} min</span>
              <span>⚡ ${summary.averageSpeedKmh || 0} km/h prom</span>
              ${session.mediaCount ? `<span>📷 ${session.mediaCount} evidencias</span>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-2 pt-2 md:pt-0">
            <button type="button" data-session-id="${session.id}" class="btn-load-route flex-1 md:flex-initial px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              Cargar en Mapa
            </button>
            <button type="button" data-delete-id="${session.id}" class="btn-delete-route px-3 py-1.5 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition-colors" title="Eliminar del historial">
              🗑️
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Asignar listeners
    this.sessionsListContainer.querySelectorAll('.btn-load-route').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-session-id');
        const session = sessions.find(s => s.id === id);
        if (session && this.onSelectRouteCallback) {
          this.onSelectRouteCallback(session);
          this.close();
        }
      });
    });

    this.sessionsListContainer.querySelectorAll('.btn-delete-route').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-id');
        if (confirm('¿Deseas eliminar este registro de ruta?')) {
          this.storageModel.deleteLocalSession(id);
          this.renderSessions();
        }
      });
    });
  }
}
