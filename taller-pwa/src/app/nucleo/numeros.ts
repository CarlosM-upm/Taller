/**
 * Números tecleados en los campos de texto, como se escriben aquí: con coma.
 *
 * Los campos numéricos son type="text" con inputmode="decimal" (ver AGENTS.md),
 * así que la pantalla trabaja con texto y estas funciones lo convierten.
 */

/** Del texto tecleado (con coma o con punto) al número que espera el servidor. */
export function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio.length === 0) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

/** Del número del servidor al texto del campo, con coma. Vacío si no hay. */
export function aTexto(valor: number | null): string {
  return valor === null || valor === undefined ? '' : String(valor).replace('.', ',');
}

/** Dos decimales, como el servidor. */
export function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
