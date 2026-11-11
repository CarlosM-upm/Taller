/**
 * Cómo se busca en toda la aplicación: lo escrito tiene que estar CONTENIDO en
 * cualquier parte del texto ("nill" encuentra "Tornillo" y "Anilla"), sin
 * distinguir mayúsculas ni tildes ("perez" encuentra "Pérez"), porque en la
 * tablet nadie pone tildes. Lo usan el campo de cliente, el de material y los
 * buscadores de Ajustes.
 */

/** Sin tildes y en minúsculas, para comparar. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Si el texto contiene lo buscado. Sin nada escrito, todo coincide. */
export function contiene(texto: string | null | undefined, consulta: string): boolean {
  const buscado = normalizar(consulta.trim());
  return buscado.length === 0 || normalizar(texto ?? '').includes(buscado);
}
