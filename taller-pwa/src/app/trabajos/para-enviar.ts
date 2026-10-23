import { MaterialLinea } from '../nucleo/modelos';

/**
 * Lo mismo que exige TrabajoService.camposQueFaltan() en el servidor. Se
 * calcula también aquí para avisar en el momento, sin gastar un viaje; pero
 * quien decide es el servidor: si su respuesta no coincide, se enseña la suya.
 */
const OBLIGATORIOS_PARA_ENVIAR = [
  { campo: 'cliente', etiqueta: 'cliente' },
  { campo: 'trabajador', etiqueta: 'trabajador' },
  { campo: 'descripcion', etiqueta: 'qué se ha hecho' },
  { campo: 'materiales', etiqueta: 'materiales' },
  { campo: 'horas', etiqueta: 'horas' },
] as const;

/** Lo que hay en el formulario del trabajo, tal como se teclea. */
export interface FormularioTrabajo {
  clienteId: number | null;
  trabajadorId: number | null;
  descripcion: string;
  materiales: MaterialLinea[];
  horas: string;
}

/** Qué falta para poder enviarlo, con los nombres que ve el usuario. */
export function queFaltaParaEnviar(f: FormularioTrabajo): string[] {
  // Relleno, no relleno: cliente y trabajador ya no son texto sino una
  // elección, y los materiales son una lista.
  const relleno: Record<string, boolean> = {
    cliente: f.clienteId !== null,
    trabajador: f.trabajadorId !== null,
    descripcion: f.descripcion.trim().length > 0,
    materiales: f.materiales.length > 0,
    horas: f.horas.trim().length > 0,
  };
  return OBLIGATORIOS_PARA_ENVIAR.filter((c) => !relleno[c.campo]).map((c) => c.etiqueta);
}
