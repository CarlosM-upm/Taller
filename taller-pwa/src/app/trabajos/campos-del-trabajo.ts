import { Trabajo } from '../nucleo/modelos';
import { aTexto } from '../nucleo/numeros';
import { FormularioTrabajo } from './para-enviar';

/**
 * Cómo se leen los campos del formulario del trabajo. Lo usan el alta y la
 * ficha, que antes llevaban cada una su copia.
 */

/**
 * Las horas tecleadas ("2,5" o "2.5"): null si está en blanco, 'invalido' si
 * no es un número mayor que cero. Se redondean a dos decimales, como guarda el
 * servidor, para que no rechace algo como 1,333 después de haberlo tecleado.
 */
export function aHoras(texto: string): number | null | 'invalido' {
  const limpio = texto.trim().replace(',', '.');
  if (limpio.length === 0) return null;

  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero <= 0) return 'invalido';
  return Math.round(numero * 100) / 100;
}

/** Un campo en blanco viaja como null, no como cadena vacía. */
export function vacioONulo(valor: string): string | null {
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Si el formulario se aparta de lo guardado: decide entre "Sin cambios" y
 * Cancelar + Guardar en la ficha.
 */
export function difiereDeLoGuardado(f: FormularioTrabajo, t: Trabajo | null): boolean {
  if (!t) return false;
  return (
    f.clienteId !== t.clienteId ||
    f.trabajadorId !== t.trabajadorId ||
    f.descripcion.trim() !== (t.descripcion ?? '') ||
    JSON.stringify(f.materiales) !== JSON.stringify(t.materiales) ||
    f.horas.trim() !== aTexto(t.horas)
  );
}
