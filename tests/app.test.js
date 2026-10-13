/**
 * app.test.js
 * Pruebas automatizadas de la aplicacion Cloudfire GeoTracker.
 * Se ejecutan en GitHub Actions con el runner de pruebas nativo de Node.js.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TrackingModel } from '../js/models/TrackingModel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function walkJs(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkJs(full));
    } else if (entry.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

test('index.html existe y referencia los recursos clave de la app', () => {
  const indexPath = join(root, 'index.html');
  assert.ok(existsSync(indexPath), 'index.html debe existir');

  const html = readFileSync(indexPath, 'utf8');
  assert.match(html, /id="map"/, 'Debe existir el contenedor del mapa');
  assert.match(html, /js\/bundle\.js/, 'Debe cargar el bundle de la aplicacion');
  assert.match(html, /css\/styles\.css/, 'Debe cargar la hoja de estilos');
  assert.match(html, /<main/, 'Debe contener la region principal semantica');
  assert.match(html, /leaflet/i, 'Debe incluir la libreria de mapas Leaflet');
});

test('la arquitectura MVC contiene todos los modulos esperados', () => {
  const esperados = [
    'js/app.js',
    'js/bundle.js',
    'js/config/firebaseConfig.js',
    'js/models/TrackingModel.js',
    'js/models/MediaModel.js',
    'js/models/StorageModel.js',
    'js/views/MapView.js',
    'js/views/DashboardView.js',
    'js/views/MediaView.js',
    'js/views/FirebaseModalView.js',
    'js/views/HistoryModalView.js',
    'js/controllers/AppController.js'
  ];

  for (const rel of esperados) {
    assert.ok(existsSync(join(root, rel)), `Falta el modulo obligatorio: ${rel}`);
  }
});

test('todos los archivos JavaScript tienen sintaxis valida', () => {
  const archivos = walkJs(join(root, 'js'));
  assert.ok(archivos.length > 0, 'Debe haber archivos JavaScript');

  for (const archivo of archivos) {
    assert.doesNotThrow(
      () => execFileSync(process.execPath, ['--check', archivo], { stdio: 'pipe' }),
      `Sintaxis invalida en ${archivo}`
    );
  }
});

test('TrackingModel calcula la distancia Haversine correctamente', () => {
  const model = new TrackingModel();

  assert.equal(model.calculateHaversineDistance(19.4326, -99.1332, 19.4326, -99.1332), 0);

  const unGradoEcuador = model.calculateHaversineDistance(0, 0, 0, 1);
  assert.ok(
    Math.abs(unGradoEcuador - 111194.9) < 100,
    `Un grado en el ecuador debe medir ~111195 m, se obtuvo ${unGradoEcuador}`
  );

  const ida = model.calculateHaversineDistance(19.4326, -99.1332, 19.5000, -99.2000);
  const vuelta = model.calculateHaversineDistance(19.5000, -99.2000, 19.4326, -99.1332);
  assert.ok(Math.abs(ida - vuelta) < 0.001, 'La distancia debe ser simetrica');
});

test('TrackingModel calcula el rumbo (bearing) correctamente', () => {
  const model = new TrackingModel();

  const norte = model.calculateBearing(0, 0, 1, 0);
  assert.ok(Math.abs(norte - 0) < 0.001, 'Hacia el norte el rumbo debe ser 0');

  const este = model.calculateBearing(0, 0, 0, 1);
  assert.ok(Math.abs(este - 90) < 0.001, 'Hacia el este el rumbo debe ser 90');
});
