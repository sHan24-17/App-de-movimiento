# 📍 Cloudfire GeoTracker Mobile App

Aplicación web móvil de telemetría de alta exactitud geográfica con **Mapa Interactivo Real** (calles reales de OpenStreetMap, satélite real de alta resolución Esri y cartografía clara), estimación dinámica de tiempos de llegada (ETA), distancias geodésicas (Haversine), modo reversible de retorno, captura de evidencias con las APIs Media del navegador y persistencia en la nube mediante **Firebase Realtime Database & Cloud Firestore**.

Desarrollada bajo el patrón arquitectónico **MVC (Modelo - Vista - Controlador)**, con **HTML5 Semántico**, cumplimiento de accesibilidad **WCAG 2.1 AA**, estilos modernos con **Tailwind CSS** y JavaScript optimizado.

---

## 🗺️ Mapa Interactivo 100% Real (Sin Marcas de Agua ni "Simuladores")

La aplicación cuenta con cartografía real interactiva sin marcas de agua ni restricciones de pago:
- **Calles Reales Oficiales (OpenStreetMap)**: visualización precisa en cualquier ciudad o país con nombres reales de calles, avenidas y puntos de interés.
- **Satélite Real de Alta Resolución (Esri World Imagery)**: fotografía aérea y satelital nítida con edificios, parques y carreteras reales.
- **Selector de Capas**: alterna instantáneamente en la esquina superior derecha entre **🗺️ Calles Reales**, **🛰️ Satélite Real** y **🏙️ Cartografía Clara**.
- **Icono en Movimiento en Tiempo Real**: efecto radar animado con pulso expansivo, núcleo central y flecha de rumbo integrada que gira según la orientación del usuario.
- **Trazados Geodésicos de Alta Exactitud**: líneas dinámicas para la ruta recorrida (azul) y la ruta invertida de retorno (ámbar punteado).

> ℹ️ **¿Por qué Google Maps mostraba un "mapa simulado" / marcas de agua antes?**
> Firebase y Google Maps son servicios independientes de Google Cloud. Una clave de API creada para Firebase **no tiene activada por defecto la API de Google Maps**. Cuando se usa esa clave en Google Maps sin activar *"Maps JavaScript API"* en Google Cloud Console, Google Maps oscurece el mapa y muestra marcas de agua que dicen *"Solo para fines de desarrollo / For development purposes only"*.
> Por esta razón, la aplicación ahora utiliza **Leaflet con OpenStreetMap y Satélite Real de Esri**, que es 100% real, completamente nítido y libre de marcas de agua o costos.

---

## 🔥 Conexión con Firebase en la Nube

Tu proyecto de Firebase `movimiento-en-tiempo-real` está conectado directamente:
1. **Firebase Realtime Database**: sincronización inmediata en la nube a través de la URL oficial:
   `https://movimiento-en-tiempo-real-default-rtdb.firebaseio.com/`
2. **Cloud Firestore**: compatible si habilitas Firestore en la consola de Firebase.
3. **Persistencia Offline (LocalStorage)**: las rutas se guardan en el dispositivo aunque se pierda la conexión a Internet y se sincronizan al reconectar.

---

## 🚀 Cómo Abrir la Aplicación

### Opción 1: Doble Clic Directo (Recomendada)
Haz doble clic sobre el archivo **`index.html`** en el explorador de archivos de Windows. La aplicación se abrirá directamente en tu navegador (Edge, Chrome, Firefox) sin necesidad de terminales, scripts `.bat` ni servidores adicionales.

### Opción 2: Con Live Server o Servidor Web
Si usas Visual Studio Code, puedes hacer clic derecho en `index.html` y seleccionar **"Open with Live Server"**.

---

## 📁 Arquitectura del Proyecto (Patrón MVC)

```text
pag cloudfire/
│
├── index.html                   # Vista principal semántica (WCAG AA, Tailwind, Leaflet)
├── README.md                    # Documentación y guía del proyecto
│
├── css/
│   └── styles.css               # Estilos de contraste, radar de movimiento y modales
│
├── js/
│   ├── app.js                   # Bootstrap principal modular (ES6+)
│   ├── bundle.js                # Bundle autónomo optimizado para ejecución directa
│   │
│   ├── config/
│   │   └── firebaseConfig.js    # Credenciales oficiales del proyecto de Firebase
│   │
│   ├── models/                  # MODELO (Lógica de negocio y persistencia)
│   │   ├── TrackingModel.js     # Haversine, filtros GPS, rumbos, ETA y ruta reversible
│   │   ├── MediaModel.js        # APIs Media: cámara, grabadora de audio y Web Audio
│   │   └── StorageModel.js      # Persistencia híbrida (Realtime DB + Firestore + Local)
│   │
│   ├── views/                   # VISTA (Presentación e interfaz gráfica)
│   │   ├── MapView.js           # Leaflet: Calles reales, satélite Esri, pulso radar y pines
│   │   ├── DashboardView.js     # Panel HUD de telemetría con regiones aria-live WCAG AA
│   │   ├── MediaView.js         # Modales de cámara y grabadora de notas de voz
│   │   ├── FirebaseModalView.js # Asistente interactivo de conexión y prueba de Firebase
│   │   └── HistoryModalView.js  # Historial de rutas sincronizadas con la nube
│   │
│   └── controllers/             # CONTROLADOR (Orquestación del ciclo de vida)
│       └── AppController.js     # Geolocation watcher, Screen WakeLock y bindings MVC
```

---

## ✨ Funcionalidades Principales

1. **Rastreo GPS de Alta Exactitud**:
   - `enableHighAccuracy: true` conectado a la antena GPS del dispositivo.
   - Filtros de tolerancia contra jitter y saltos estacionarios menores a 2 metros.
   - Cálculo geodésico mediante la fórmula de Haversine ($R = 6,371,008.8\text{ m}$).
2. **Estimación Dinámica de Llegada (ETA)**:
   - Haz clic en cualquier parte del mapa para marcar un destino y calcular automáticamente la distancia y el tiempo aproximado según tu velocidad real.
3. **Modo Reversible**:
   - Botón *"Invertir Ruta"* para guiar el camino de retorno al origen sobre el mismo trayecto.
   - Botón *"Deshacer"* para revertir el último punto marcado.
4. **Evidencias Multimedia Geotagueadas**:
   - Captura de fotos en ruta con nota descriptiva.
   - Grabación de notas de voz con reproductor integrado sobre el mapa.
