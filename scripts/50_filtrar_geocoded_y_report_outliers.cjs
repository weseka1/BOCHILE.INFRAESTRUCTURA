// Filtra los geocoded por bounding box valido (region sur de BA + zona Bochile)
// y genera report de outliers para revision manual.
//
// Bounding box valido (cubre: BB + MH + Punta Alta + Pehuen Co + Sierras + Villarino):
//   lat: [-40.5, -37.0]  lng: [-63.5, -60.0]
//
// OUTPUTS:
//   - scripts/_geocoded_clean.json    (solo los validos para Qdrant)
//   - scripts/_geocoded_outliers.md   (markdown report para revision manual)

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.resolve(__dirname, '_geocoded_addresses.json');
const OUT_CLEAN = path.resolve(__dirname, '_geocoded_clean.json');
const OUT_REPORT = path.resolve(__dirname, '_geocoded_outliers.md');

const BBOX = { latMin: -40.5, latMax: -37.0, lngMin: -63.5, lngMax: -60.0 };

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const clean = {};
const outliers = [];
const failed = [];

for (const [pid, v] of Object.entries(data)) {
  if (v.error) {
    failed.push(v);
    continue;
  }
  if (v.lat < BBOX.latMin || v.lat > BBOX.latMax || v.lng < BBOX.lngMin || v.lng > BBOX.lngMax) {
    outliers.push(v);
    continue;
  }
  clean[pid] = v;
}

fs.writeFileSync(OUT_CLEAN, JSON.stringify(clean, null, 2));

// Reporte markdown
const lines = [];
lines.push('# Reporte de geocoding - propiedades fuera del bounding box');
lines.push('');
lines.push(`Generado: ${new Date().toISOString()}`);
lines.push(`Bbox valido: lat [${BBOX.latMin}, ${BBOX.latMax}], lng [${BBOX.lngMin}, ${BBOX.lngMax}]`);
lines.push(`(cubre Bahia Blanca, Monte Hermoso, Punta Alta, Pehuen Co, Sierras, Villarino)`);
lines.push('');
lines.push(`- Geocodificadas OK dentro de region: **${Object.keys(clean).length}**`);
lines.push(`- Outliers (fuera de region): **${outliers.length}**`);
lines.push(`- Fallaron sin resultado: **${failed.length}**`);
lines.push('');
lines.push('---');
lines.push('');
lines.push('## Outliers - props con coords sospechosas');
lines.push('');
lines.push('| prop_id | direccion | zona declarada | coords erroneas | Nominatim devolvio |');
lines.push('|---|---|---|---|---|');
for (const o of outliers) {
  lines.push(`| ${o.prop_id} | ${o.direccion || '?'} | ${o.zona || '?'} | ${o.lat.toFixed(4)}, ${o.lng.toFixed(4)} | ${(o.formatted || '').slice(0, 80)}... |`);
}
lines.push('');
lines.push('**Acciones sugeridas para outliers:**');
lines.push('1. Verificar si la direccion esta bien cargada en el Sheet.');
lines.push('2. Si la direccion es real pero ambigua (ej. solo nombre de calle sin numero), agregar referencia: "Av. Argentina 1500, Monte Hermoso, Argentina".');
lines.push('3. Si la prop no existe o es un test, marcar como inactiva.');
lines.push('');
lines.push('---');
lines.push('');
lines.push('## Failed - sin resultado de Nominatim');
lines.push('');
lines.push('| prop_id | direccion intentada |');
lines.push('|---|---|');
for (const f of failed) {
  lines.push(`| ${f.prop_id || '?'} | ${f.direccion || '?'} |`);
}

fs.writeFileSync(OUT_REPORT, lines.join('\n'));

console.log(`✅ Geocoded limpio:    ${Object.keys(clean).length} props -> ${OUT_CLEAN}`);
console.log(`⚠️  Outliers report:    ${outliers.length} props -> ${OUT_REPORT}`);
console.log(`❌ Failed:             ${failed.length} props (en mismo report)`);
console.log('');
console.log('Coverage geo del catalogo:');
console.log(`  ${Object.keys(clean).length}/239 = ${(Object.keys(clean).length / 239 * 100).toFixed(1)}%`);
