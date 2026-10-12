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

// --- Maestros: clientes y trabajadores --------------------------------------

/**
 * Los mantiene el jefe desde Ajustes. Pedidos, trabajos y albaranes los
 * referencian por id, así que renombrar uno aquí se refleja en todos.
 */
export interface Cliente {
  id: number;
  nombre: string;
}

export interface Trabajador {
  id: number;
  nombre: string;
}

// --- Materiales -------------------------------------------------------------

/**
 * Una línea de material. El precio solo se usa en los albaranes: lo pone el
 * jefe al facturar, y en los trabajos viaja nulo.
 */
export interface MaterialLinea {
  id?: number | null;
  nombre: string;
  /** Decimal con 2 decimales: vale para "5 tornillos" y para "12,5 m". */
  cantidad: number | null;
  precio?: number | null;
}

// --- Pedidos ---------------------------------------------------------------

export interface Pedido {
  id: number;
  fecha: string;
  trabajadorId: number;
  trabajador: string;
  clienteId: number;
  cliente: string;
  descripcion: string;
  fotoIds: number[];
}

/** La fecha no se envía: la pone el servidor al crear. */
export interface PedidoNuevo {
  trabajadorId: number | null;
  clienteId: number | null;
  descripcion: string;
}

export type PedidoCambios = Partial<PedidoNuevo>;

// --- Trabajos --------------------------------------------------------------

export interface Trabajo {
  id: number;
  estado: EstadoTrabajo;
  /** Vacía mientras es borrador: se estampa al enviar. */
  fecha: string | null;
  clienteId: number | null;
  cliente: string | null;
  trabajadorId: number | null;
  trabajador: string | null;
  descripcion: string | null;
  materiales: MaterialLinea[];
  /** BigDecimal con 2 decimales en el servidor; aquí llega como número. */
  horas: number | null;
  fotoIds: number[];
  /** Si ya está en un albarán: entonces no se puede volver a facturar. */
  enAlbaran: boolean;
}

/** Todos opcionales: un borrador puede guardarse a medias. */
export interface TrabajoDatos {
  clienteId?: number | null;
  trabajadorId?: number | null;
  descripcion?: string | null;
  materiales?: MaterialLinea[];
  horas?: number | null;
}

// --- Albaranes -------------------------------------------------------------

export interface Albaran {
  id: number;
  numero: number;
  fecha: string;
  clienteId: number;
  cliente: string;
  dniCliente: string | null;
  /** Varios, porque puede unificar trabajos de distintas personas. */
  trabajadores: Trabajador[];
  descripcion: string;
  horas: number | null;
  materiales: MaterialLinea[];
  precioHora: number | null;
  /** Materiales + mano de obra. Lo calcula el servidor; no es editable. */
  costeSumado: number;
  importeExtra: number | null;
  /** costeSumado + importeExtra. Lo único que puede salir impreso. */
  costeTotal: number;
  incluirTotal: boolean;
  tieneFirma: boolean;
  /** Uno, o varios si se unificó. */
  trabajoIds: number[];
  fotoIds: number[];
}

export interface AlbaranNuevo {
  fecha?: string | null;
  dniCliente?: string | null;
}

/** Varios trabajos del mismo cliente en un solo albarán. */
export interface AlbaranUnificado extends AlbaranNuevo {
  trabajoIds: number[];
}

export interface AlbaranCambios {
  numero?: number;
  fecha?: string;
  clienteId?: number;
  dniCliente?: string;
  trabajadorIds?: number[];
  descripcion?: string;
  horas?: number | null;
  materiales?: MaterialLinea[];
  precioHora?: number | null;
  importeExtra?: number | null;
  incluirTotal?: boolean;
}

// --- Configuración ---------------------------------------------------------

export interface ProximoNumero {
  proximoNumeroAlbaran: number;
}
