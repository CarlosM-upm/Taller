import { expect, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/**
 * Recorre la aplicación como lo haría una persona del taller.
 *
 * La regla principal está en vigilarErrores(): CUALQUIER error en la consola
 * del navegador o cualquier excepción sin capturar hace fallar la prueba.
 * Eso es lo que caza los fallos que no se ven, como un componente que revienta
 * al construirse y deja la pantalla en blanco: la petición a la API es
 * correcta, el listado se pinta, y sin embargo la aplicación está rota.
 *
 * Cada prueba crea sus propios datos y los borra al terminar, para no depender
 * de lo que haya en la base de datos ni dejar basura.
 */

/**
 * Acumula los errores de consola y las excepciones de la página.
 * Se comprueban al final de cada prueba.
 *
 * `esperados` son códigos HTTP que la propia prueba provoca a propósito (por
 * ejemplo el 409 al intentar borrar un trabajo que ya tiene albarán). El
 * navegador escribe en consola cualquier petición fallida, aunque la
 * aplicación la gestione bien, así que hay que poder excluirlos. Todo lo demás
 * —incluido un 401 al cargar una imagen— sigue haciendo fallar la prueba.
 */
export function vigilarErrores(page: Page, esperados: number[] = []): string[] {
  const errores: string[] = [];

  page.on('console', (mensaje) => {
    if (mensaje.type() !== 'error') return;
    const texto = mensaje.text();

    const esFalloDeRed = texto.includes('Failed to load resource');
    if (esFalloDeRed && esperados.some((codigo) => texto.includes(`status of ${codigo}`))) {
      return;
    }
    errores.push(`Consola: ${texto}`);
  });

  page.on('pageerror', (fallo) => {
    errores.push(`Excepción sin capturar: ${fallo.message}`);
  });

  return errores;
}

/**
 * Comprueba que una imagen se ha descargado de verdad.
 *
 * `toBeVisible()` no basta: un <img> con la fuente rota sigue estando en la
 * página y ocupa sitio. La única forma de saber que la imagen llegó es mirar
 * su anchura real. Sin esto, una foto que devuelve 401 pasaría por buena.
 */
export async function imagenCargada(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).evaluate((img) => {
    const imagen = img as HTMLImageElement;
    return imagen.complete && imagen.naturalWidth > 0;
  });
}

/**
 * Pulsa el botón de borrar de la cabecera y confirma en el diálogo.
 *
 * Se usa getByLabel y no getByRole('button', {name:'Borrar'}) porque ese
 * nombre también lo tienen el botón de cada foto ("Borrar esta foto") y el del
 * diálogo. El aria-label de la cabecera es exactamente "Borrar".
 */
export async function borrarYConfirmar(page: Page, textoDelBoton = 'Borrar') {
  await page.getByLabel('Borrar', { exact: true }).click();
  await page.getByRole('button', { name: textoDelBoton, exact: true }).last().click();
}

/**
 * Pulsa un botón de descarga y comprueba que llega un PDF de verdad.
 *
 * No basta con que el botón no dé error: el fichero se pide con HttpClient y
 * se guarda desde una URL de objeto, así que hay varios sitios donde puede
 * quedarse por el camino sin que la pantalla se entere. Se miran los primeros
 * bytes ("%PDF-") porque un cuerpo de error guardado con nombre .pdf también
 * "se descarga".
 */
export async function descargarPdf(page: Page, etiqueta: string, nombreEsperado: RegExp) {
  const esperaDescarga = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByLabel(etiqueta).click();
  const descarga = await esperaDescarga;

  expect(descarga.suggestedFilename()).toMatch(nombreEsperado);

  const ruta = await descarga.path();
  const contenido = await readFile(ruta);
  expect(contenido.subarray(0, 5).toString('ascii'), `${etiqueta}: no es un PDF`).toBe('%PDF-');
  expect(contenido.length, `${etiqueta}: el PDF está vacío`).toBeGreaterThan(1000);
}

/**
 * Elige una opción de un desplegable de Material.
 *
 * Cliente y trabajador dejaron de ser campos de texto: ahora se seleccionan de
 * una lista que mantiene el jefe en Ajustes. Un fill() aquí no hace nada, y el
 * campo se quedaría vacío sin que la prueba se entere.
 */
export async function elegir(page: Page, etiqueta: string, opcion: string) {
  // Por rol "combobox" y no por etiqueta: mientras el panel de una elección
  // anterior se está cerrando, la etiqueta también nombra ese panel y la
  // búsqueda encuentra dos elementos. Pasaba al elegir dos veces seguidas en
  // el mismo desplegable.
  await page.getByRole('combobox', { name: etiqueta, exact: true }).click();
  await page.getByRole('option', { name: opcion, exact: true }).click();
  // Esperar a que el panel termine de cerrarse. Si no, el siguiente clic en el
  // mismo desplegable cae durante la animación de cierre y se pierde.
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

/** Elige el material de la primera fila (del catálogo) y escribe su cantidad. */
export async function primerMaterial(page: Page, material: string, cantidad: string) {
  // Como en la tablet: se escribe un trozo del nombre y se toca en la lista.
  await page.locator('input[name="material-nombre-0"]').fill(material);
  await page.getByRole('option', { name: material, exact: true }).click();
  await page.locator('input[name="material-cantidad-0"]').fill(cantidad);
}

export async function entrar(page: Page, cuenta: { usuario: string; contrasena: string }) {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(cuenta.usuario);
  await page.getByLabel('Contraseña').fill(cuenta.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  // Tras entrar se va a trabajos: si no llega, el login no funcionó.
  await expect(page).toHaveURL(/\/trabajos$/, { timeout: 15_000 });
  // Las pruebas se escribieron empezando en pedidos (desde ahí está el enlace
  // de "Nuevo pedido"), así que se sigue empezando ahí.
  await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
  await expect(page).toHaveURL(/\/pedidos$/, { timeout: 10_000 });
}

/** Cambia de usuario sin pasar por el menú: la sesión vive en localStorage. */
export async function cambiarA(page: Page, cuenta: { usuario: string; contrasena: string }) {
  await page.evaluate(() => localStorage.clear());
  await entrar(page, cuenta);
}

/** Dibuja una firma en el lienzo, arrastrando como haría un dedo, y la guarda. */
export async function firmarEnLienzo(page: Page) {
  const lienzo = page.locator('canvas.lienzo');
  await expect(lienzo).toBeVisible();
  const caja = await lienzo.boundingBox();
  if (!caja) throw new Error('El lienzo de firma no tiene tamaño');
  await page.mouse.move(caja.x + 40, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.mouse.move(caja.x + 120, caja.y + 40, { steps: 10 });
  await page.mouse.move(caja.x + 200, caja.y + caja.height - 40, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Guardar firma' }).click();
}

/**
 * Comprueba la etiqueta de firma de un trabajo en la lista, con un filtro
 * puesto. Busca la tarjeta por su descripción, que en cada prueba es única.
 */
export async function etiquetaDeFirmaEnLista(page: Page, descripcion: string, filtro: string, etiqueta: string) {
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.locator('mat-button-toggle', { hasText: filtro }).click();
  const tarjeta = page.locator('mat-card.trabajo', { hasText: descripcion });
  await expect(tarjeta.locator('.etiqueta', { hasText: etiqueta })).toBeVisible({ timeout: 15_000 });
  const otra = etiqueta === 'Firmado' ? 'Sin firmar' : 'Firmado';
  await expect(tarjeta.locator('.etiqueta', { hasText: otra })).toHaveCount(0);
}

/**
 * Sesión limpia en cada prueba: el token vive en localStorage y sobrevive
 * entre pruebas si no se borra. Cada fichero lo engancha con
 * test.beforeEach(sesionLimpia).
 */
export async function sesionLimpia({ page }: { page: Page }) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
}
