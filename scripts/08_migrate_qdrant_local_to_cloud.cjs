// Migra las 3 colecciones de Bochile de Qdrant Local a Qdrant Cloud via snapshots.
// 1) Baja cada snapshot del local a disco
// 2) Sube cada uno al cloud con multipart POST
// 3) Verifica que la coleccion quede creada con los puntos correctos
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LOCAL_URL = 'http://localhost:6333';
const CLOUD_URL = 'https://e68bfd5f-f3d0-4dcd-84e4-b49dc149a088.us-east-1-1.aws.cloud.qdrant.io';
const CLOUD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwic3ViamVjdCI6ImFwaS1rZXk6ODg2OTcwZmYtNTYyOC00NDY4LTk4YWItNWNhNjgwZWMzZDI2In0.ifaiueVahaV7GujwO8g_xvLlwyONKWuxPeHG2Oe7KmQ';

const COLLECTIONS = ['bochile_properties', 'bochile_property_images', 'bochile_property_images_clip'];
const TMP_DIR = path.join(process.cwd(), '_qdrant_snapshots');

function reqLocal(method, path) {
  return new Promise((res, rej) => {
    const r = http.request({ host: 'localhost', port: 6333, path, method }, resp => {
      let d = ''; resp.on('data', c => d += c);
      resp.on('end', () => res({ status: resp.statusCode, body: d, headers: resp.headers }));
    });
    r.on('error', rej); r.end();
  });
}

function reqCloud(method, p, body) {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'api-key': CLOUD_KEY };
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    const r = https.request(CLOUD_URL + p, { method, headers }, resp => {
      let d = ''; resp.on('data', c => d += c);
      resp.on('end', () => res({ status: resp.statusCode, body: d }));
    });
    r.on('error', rej);
    if (data) r.write(data);
    r.end();
  });
}

function downloadSnapshot(collection, snapshotName, outPath) {
  return new Promise((res, rej) => {
    const r = http.request({ host: 'localhost', port: 6333, path: `/collections/${collection}/snapshots/${snapshotName}`, method: 'GET' }, resp => {
      if (resp.statusCode !== 200) { rej(new Error('download status ' + resp.statusCode)); return; }
      const file = fs.createWriteStream(outPath);
      resp.pipe(file);
      file.on('finish', () => file.close(() => res(fs.statSync(outPath).size)));
      file.on('error', rej);
    });
    r.on('error', rej); r.end();
  });
}

function uploadSnapshot(collection, filePath) {
  return new Promise((res, rej) => {
    const boundary = '----QdrantUpload' + crypto.randomBytes(8).toString('hex');
    const filename = path.basename(filePath);
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="snapshot"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fileBuf = fs.readFileSync(filePath);
    const body = Buffer.concat([head, fileBuf, tail]);

    const u = new URL(CLOUD_URL);
    const r = https.request({
      host: u.host,
      port: 443,
      path: `/collections/${collection}/snapshots/upload?priority=snapshot&wait=true`,
      method: 'POST',
      headers: {
        'api-key': CLOUD_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, resp => {
      let d = ''; resp.on('data', c => d += c);
      resp.on('end', () => res({ status: resp.statusCode, body: d }));
    });
    r.on('error', rej);
    r.write(body);
    r.end();
  });
}

(async () => {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  for (const c of COLLECTIONS) {
    console.log('\n=== ' + c + ' ===');

    // 1) Listar snapshots del local
    const lsRes = await reqLocal('GET', `/collections/${c}/snapshots`);
    const lsJson = JSON.parse(lsRes.body);
    const snaps = lsJson.result || [];
    if (snaps.length === 0) { console.log('  ! sin snapshots, salto'); continue; }
    const latest = snaps[snaps.length - 1].name;
    console.log('  snapshot local:', latest);

    // 2) Bajar a disco
    const localFile = path.join(TMP_DIR, latest);
    console.log('  bajando a ' + localFile + ' ...');
    const sizeBytes = await downloadSnapshot(c, latest, localFile);
    console.log('  bajado:', (sizeBytes / 1024 / 1024).toFixed(2) + ' MB');

    // 3) Subir al cloud
    console.log('  subiendo al cloud ...');
    const up = await uploadSnapshot(c, localFile);
    console.log('  upload status:', up.status);
    if (up.status !== 200) {
      console.log('  body:', up.body.slice(0, 400));
      continue;
    }
    console.log('  OK');

    // 4) Verificar count
    const verify = await reqCloud('GET', `/collections/${c}`);
    if (verify.status === 200) {
      const info = JSON.parse(verify.body).result;
      console.log('  verificacion cloud: points=' + info.points_count + ', status=' + info.status);
    } else {
      console.log('  verify fail:', verify.status, verify.body.slice(0, 200));
    }
  }

  console.log('\nLISTO. Verificando estado final del cloud...');
  const final = await reqCloud('GET', '/collections');
  const cols = JSON.parse(final.body).result.collections;
  console.log('Colecciones en cloud:');
  for (const c of cols) console.log('  -', c.name);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
