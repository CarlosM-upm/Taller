/**
 * Tipos que reflejan exactamente los DTO del backend.
 * Si cambias un record en Java, cambia también aquí.
 *
 * Las fechas viajan como texto ISO ("2026-09-07"), no como Date: LocalDate
 * de Java no lleva hora ni zona horaria, y convertirlo a Date en el
 * navegador provoca desfases de un día según el huso.
 */

export type Rol = 'TRABAJADOR' | 'JEFE';

export type EstadoTrabajo = 'BORRADOR' | 'ENVIADO';

export interface RespuestaLogin {
  token: string;
  rol: Rol;
}

/** Cuerpo uniforme de error que devuelve el backend (comun/RespuestaError.java). */
export interface RespuestaError {
  momento: string;
  codigo: number;
  error: string;
  mensaje: string;
  ruta: string;
  /** Solo aparece en fallos de validación: campo -> motivo. */
  campos?: Record<string, string>;
}

// --- Pedidos ---------------------------------------------------------------

export interface Pedido {
  id: number;
  fecha: string;
  trabajador: string;
  cliente: string;
  descripcion: string;
  fotoIds: number[];
}

/** La fecha no se envía: la pone el servidor al crear. */
export interface PedidoNuevo {
  trabajador: string;
  cliente: string;
  descripcion: string;
}

export type PedidoCambios = Partial<PedidoNuevo>;

// --- Trabajos --------------------------------------------------------------

export interface Trabajo {
  id: number;
  estado: EstadoTrabajo;
  /** Vacía mientras es borrador: se estampa al enviar. */
  fecha: string | null;
  cliente: string | null;
  trabajador: string | null;
  descripcion: string | null;
  materiales: string | null;
  /** BigDecimal con 2 decimales en el servidor; aquí llega como número. */
  horas: number | null;
  fotoIds: number[];
}

/** Todos opcionales: un borrador puede guardarse a medias. */
export interface TrabajoDatos {
  cliente?: string | null;
  trabajador?: string | null;
  descripcion?: string | null;
  materiales?: string | null;
  horas?: number | null;
}

// --- Albaranes -------------------------------------------------------------

export interface Albaran {
  id: number;
  numero: number;
  fecha: string;
  cliente: string;
  dniCliente: string | null;
  trabajador: string;
  descripcion: string;
  tieneFirma: boolean;
  trabajoId: number;
  fotoIds: number[];
}

export interface AlbaranNuevo {
  fecha?: string | null;
  dniCliente?: string | null;
}

export interface AlbaranCambios {
  numero?: number;
  fecha?: string;
  cliente?: string;
  dniCliente?: string;
  trabajador?: string;
  descripcion?: string;
}

// --- Configuración ---------------------------------------------------------

export interface ProximoNumero {
  proximoNumeroAlbaran: number;
}
