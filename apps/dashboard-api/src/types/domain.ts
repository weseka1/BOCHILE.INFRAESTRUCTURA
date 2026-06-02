// Interfaces de cada pestana del Sheet de Bochile.
// IMPORTANTE: si cambia el schema del Sheet, replicar en frontend/src/types/domain.ts

export interface Lead {
  lead_id: string;
  nombre: string;
  telefono: string;
  email: string;
  canal: string;
  operacion: string;
  tipo_propiedad: string;
  zona_pref: string;
  ambientes: number;
  presupuesto_min: number;
  presupuesto_max: number;
  moneda: string;
  forma_pago: string;
  urgencia: string;
  score: number;
  etapa: string;
  vendedor_asignado: string;
  ultima_intencion: string;
  notas: string;
  creado_en: string;
  actualizado_en: string;
}

export interface Propiedad {
  prop_id: string;
  titulo: string;
  operacion: string;
  tipo: string;
  direccion: string;
  zona: string;
  ambientes: number;
  banos: number;
  superficie_cubierta: number;
  superficie_total: number;
  precio: number;
  moneda: string;
  expensas: number;
  estado: string;
  caracteristicas: string;
  tour_360_url: string;
  foto_principal: string;
  propietario: string;
  propietario_telefono: string;
  vendedor_a_cargo: string;
  publicada: boolean;
  fecha_alta: string;
}

export interface Visita {
  visita_id: string;
  lead_id: string;
  prop_id: string;
  vendedor_id: string;
  vendedor_nombre: string;
  cliente_nombre: string;
  direccion: string;
  fecha: string;
  hora: string;
  estado: string;
  confirmada_cliente: boolean;
  notificada_vendedor: boolean;
  recordatorio_enviado: boolean;
  resultado: string;
  observaciones: string;
  creada_en: string;
}

export interface Contrato {
  contrato_id: string;
  prop_id: string;
  direccion: string;
  inquilino_nombre: string;
  inquilino_telefono: string;
  propietario: string;
  monto_actual: number;
  moneda: string;
  dia_vencimiento: number;
  frecuencia_ajuste: string;
  indice_ajuste: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  ultimo_pago: string;
  dias_atraso: number;
}

export interface Empleado {
  empleado_id: string;
  nombre: string;
  rol: string;
  telefono: string;
  email: string;
  zona_especialidad: string;
  calendar_id: string;
  activo: boolean;
  visitas_mes: number;
  cierres_mes: number;
  comisiones_mes: number;
}

export interface MatchPendiente {
  match_id: string;
  lead_id: string;
  lead_nombre: string;
  lead_telefono: string;
  criterios_json: string;
  creado_en: string;
  estado: string;
  props_ofrecidas: string;
}

export interface Conversacion {
  msg_id: string;
  lead_id: string;
  telefono: string;
  canal: string;
  direccion: 'in' | 'out' | string;
  mensaje: string;
  intencion_detectada: string;
  agente_que_respondio: string;
  requiere_humano: boolean;
  timestamp: string;
  /** ID de canal respond.io. Ventas=506217, Alquileres=508045. Vacio en mensajes pre-2026-05-27. */
  channel_id?: string;
  nombre?: string;
  msg_type?: string;
  media_url?: string;
}

export interface AccionIA {
  accion_id: string;
  tipo: string;
  agente: string;
  lead_id: string;
  resumen: string;
  detalle: string;
  resultado: string;
  timestamp: string;
  tiempo_ahorrado_min: number;
}

export interface Metrics {
  kpis: {
    leadsTotal: number;
    leadsHoy: number;
    leadsCalificados: number;
    visitasAgendadas: number;
    propiedadesActivas: number;
    matchesPendientes: number;
    accionesIaUltimaSemana: number;
    tiempoAhorradoTotalMin: number;
  };
  charts: {
    leadsPorEtapa: Array<{ etapa: string; count: number }>;
    leadsPorZona: Array<{ zona: string; count: number }>;
    accionesPorAgente: Array<{ agente: string; count: number }>;
    mensajesPorDia: Array<{ fecha: string; count: number }>;
  };
}

export interface Tarea {
  tarea_id: string;
  titulo: string;
  descripcion: string;
  prioridad: 'alta' | 'media' | 'baja' | string;
  estado: 'pendiente' | 'en_curso' | 'completada' | string;
  asignado_a: string;
  vencimiento: string;
  creada_en: string;
  completada_en: string;
}

export interface User {
  email: string;
  password_hash: string;
  nombre: string;
  rol: string;
  creado_en: string;
  activo: boolean;
}

export type SheetTab =
  | 'leads'
  | 'propiedades'
  | 'visitas'
  | 'contratos'
  | 'empleados'
  | 'matches_pendientes'
  | 'conversaciones'
  | 'acciones_ia'
  | 'tareas'
  | 'users';
