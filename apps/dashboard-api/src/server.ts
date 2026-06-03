import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { requireAuth } from './middleware/requireAuth';

// Routes
import auth from './routes/auth';
import leads from './routes/leads';
import propiedades from './routes/propiedades';
import visitas from './routes/visitas';
import contratos from './routes/contratos';
import empleados from './routes/empleados';
import matches from './routes/matches';
import conversaciones from './routes/conversaciones';
import acciones from './routes/acciones';
import metrics from './routes/metrics';
import calidadIa from './routes/calidad_ia';
import tareas from './routes/tareas';
import geocode from './routes/geocode';

const app = express();

// Origins: union de los configurables en env + los fijos requeridos por la entrega
const envOrigins = String(config.allowOrigin || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const requiredOrigins = [
  'https://bochile-dashboard-ui.onrender.com',
  'http://localhost:5173',
];
const allowedOrigins = Array.from(new Set([...envOrigins, ...requiredOrigins]));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes('*')) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (allowedOrigins.some(o => o.endsWith('*') && origin.startsWith(o.slice(0, -1)))) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} no permitido`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', sheet: config.sheetId, timestamp: new Date().toISOString() });
});

// Auth routes — SIN requireAuth
app.use('/api/auth', auth);

// Todas las demas rutas protegidas con requireAuth
app.use('/api/leads', requireAuth, leads);
app.use('/api/propiedades', requireAuth, propiedades);
app.use('/api/visitas', requireAuth, visitas);
app.use('/api/contratos', requireAuth, contratos);
app.use('/api/empleados', requireAuth, empleados);
app.use('/api/matches', requireAuth, matches);
// /api/conversaciones: GET protegido por router interno con requireAuth,
// POST publico (usado por workflow n8n para loguear canal Alquileres - el
// workflow no tiene cookie/JWT). El POST solo escribe, no expone datos.
app.use('/api/conversaciones', conversaciones);
// /api/geocode-barrio: publico (usado por workflow n8n para resolver
// direccion -> barrio oficial al 100% via Nominatim + point-in-polygon).
app.use('/api/geocode-barrio', geocode);
app.use('/api/acciones', requireAuth, acciones);
app.use('/api/metrics', requireAuth, metrics);
app.use('/api/calidad-ia', requireAuth, calidadIa);
app.use('/api/tareas', requireAuth, tareas);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: err.message });
});

app.listen(config.port, () => {
  console.log(`Bochile Dashboard API on http://localhost:${config.port}`);
  console.log(`Sheet: ${config.sheetId}`);
  console.log(`CORS origins permitidos: ${allowedOrigins.join(', ')}`);
});
