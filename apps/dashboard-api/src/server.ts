import express from 'express';
import cors from 'cors';
import { config } from './config';

// Routes
import leads from './routes/leads';
import propiedades from './routes/propiedades';
import visitas from './routes/visitas';
import contratos from './routes/contratos';
import empleados from './routes/empleados';
import matches from './routes/matches';
import conversaciones from './routes/conversaciones';
import acciones from './routes/acciones';
import metrics from './routes/metrics';

const app = express();

app.use(cors({ origin: config.allowOrigin }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', sheet: config.sheetId, timestamp: new Date().toISOString() });
});

app.use('/api/leads', leads);
app.use('/api/propiedades', propiedades);
app.use('/api/visitas', visitas);
app.use('/api/contratos', contratos);
app.use('/api/empleados', empleados);
app.use('/api/matches', matches);
app.use('/api/conversaciones', conversaciones);
app.use('/api/acciones', acciones);
app.use('/api/metrics', metrics);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: err.message });
});

app.listen(config.port, () => {
  console.log(`Bochile Dashboard API on http://localhost:${config.port}`);
  console.log(`Sheet: ${config.sheetId}`);
  console.log(`CORS origin: ${config.allowOrigin}`);
});
