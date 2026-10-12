import { expect, Page, request as peticionApi, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Imagen real (PNG de 64x64) para las pruebas de subida. */
const FOTO = join(__dirname, 'ficheros', 'foto-prueba.png');

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

const CUENTAS = {
  jefe: { usuario: 'jefe', contrasena: 'jefe123' },
  tablet: { usuario: 'tablet', contrasena: 'tablet123' },
};

/**
 * Marca de los datos de prueba. Lleva la hora de arranque para que sea única:
 * si una ejecución falla a mitad y deja algo sin borrar, la siguiente no se
 * tropieza con ello ni lo confunde con lo suyo.
 */
const MARCA = `PRUEBA-HUMO ${Date.now()}`;

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
function vigilarErrores(page: Page, esperados: number[] = []): string[] {
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
async function imagenCargada(page: Page, selector: string): Promise<boolean> {
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
async function borrarYConfirmar(page: Page, textoDelBoton = 'Borrar') {
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
async function descargarPdf(page: Page, etiqueta: string, nombreEsperado: RegExp) {
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
async function elegir(page: Page, etiqueta: string, opcion: string) {
  await page.getByLabel(etiqueta, { exact: true }).click();
  await page.getByRole('option', { name: opcion, exact: true }).click();
}

/** Rellena la primera fila de materiales (nombre y cantidad). */
async function primerMaterial(page: Page, nombre: string, cantidad: string) {
  await page.locator('input[name="material-nombre-0"]').fill(nombre);
  await page.locator('input[name="material-cantidad-0"]').fill(cantidad);
}

/**
 * Da de alta un cliente y un trabajador desde Ajustes, y devuelve sus nombres.
 *
 * Hace falta porque ya no se teclean: sin darlos de alta antes, los
 * desplegables de pedidos y trabajos estarían vacíos y no se podría crear
 * nada. De paso, esto prueba la pantalla de Ajustes.
 */
async function crearMaestrosDePrueba(page: Page, sufijo: string) {
  const cliente = `PRUEBA-HUMO Cliente ${sufijo}`;
  const trabajador = `PRUEBA-HUMO Ana ${sufijo}`;

  await page.goto('/configuracion');
  await page.getByLabel('Añadir cliente').fill(cliente);
  await page.getByRole('button', { name: 'Añadir', exact: true }).first().click();
  await expect(page.getByText(cliente, { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByLabel('Añadir trabajador').fill(trabajador);
  await page.getByRole('button', { name: 'Añadir', exact: true }).last().click();
  await expect(page.getByText(trabajador, { exact: true })).toBeVisible({ timeout: 10_000 });

  // Se vuelve a pedidos, que es donde las pruebas esperan estar: desde aquí
  // está tanto el enlace de "Nuevo pedido" como la navegación de abajo.
  await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
  await expect(page).toHaveURL(/\/pedidos$/, { timeout: 10_000 });

  return { cliente, trabajador };
}

async function entrar(page: Page, cuenta: { usuario: string; contrasena: string }) {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(cuenta.usuario);
  await page.getByLabel('Contraseña').fill(cuenta.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  // Tras entrar se va a pedidos: si no llega, el login no funcionó.
  await expect(page).toHaveURL(/\/pedidos$/, { timeout: 15_000 });
}

/**
 * Borra los clientes y trabajadores de prueba al terminar.
 *
 * Las pruebas los dan de alta porque cliente y trabajador ya no se teclean, se
 * eligen de una lista. Sin esta limpieza se van acumulando ficha tras ficha en
 * la base de datos de desarrollo hasta llenar los desplegables de basura.
 *
 * El borrado falla con 409 si todavía tienen documentos colgando, y eso es
 * justo lo que interesa: significa que una prueba se dejó algo a medias, y se
 * reconoce porque el nombre empieza por PRUEBA-HUMO.
 */
test.afterAll(async () => {
  const api = await peticionApi.newContext({ baseURL: 'http://127.0.0.1:8080' });
  try {
    const entrada = await api.post('/api/login', {
      data: { usuario: 'jefe', contrasena: 'jefe123' },
    });
    if (!entrada.ok()) return;
    const { token } = await entrada.json();
    const cabeceras = { Authorization: `Bearer ${token}` };

    for (const recurso of ['clientes', 'trabajadores']) {
      const respuesta = await api.get(`/api/${recurso}`, { headers: cabeceras });
      if (!respuesta.ok()) continue;
      for (const ficha of await respuesta.json()) {
        if (String(ficha.nombre).startsWith('PRUEBA-HUMO')) {
          await api.delete(`/api/${recurso}/${ficha.id}`, { headers: cabeceras });
        }
      }
    }
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ page }) => {
  // Sesión limpia en cada prueba: el token vive en localStorage y sobrevive
  // entre pruebas si no se borra.
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
});

test('la API está en marcha', async ({ request }) => {
  const respuesta = await request.get('http://127.0.0.1:8080/api/pedidos');
  expect(
    respuesta.status(),
    'La API debe estar arrancada en el 8080 (.\\mvnw.cmd spring-boot:run)'
  ).toBe(401);
});

test('el jefe ve los cuatro apartados y el trabajador solo dos', async ({ page }) => {
  const errores = vigilarErrores(page);

  await entrar(page, CUENTAS.jefe);
  await expect(page.getByRole('link', { name: 'Pedidos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trabajos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Albaranes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ajustes' })).toBeVisible();

  // Salir y entrar como trabajador
  await page.getByRole('button', { name: 'Cuenta' }).click();
  await page.getByRole('menuitem', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/login/);

  await entrar(page, CUENTAS.tablet);
  await expect(page.getByRole('link', { name: 'Pedidos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trabajos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Albaranes' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ajustes' })).toHaveCount(0);

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('un pedido se crea, se abre y se borra', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador } = await crearMaestrosDePrueba(page, 'pedido ' + Date.now());

  // Alta
  await page.getByRole('link', { name: 'Nuevo pedido' }).click();
  await expect(page).toHaveURL(/\/pedidos\/nuevo$/);
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué han pedido').fill('Reja de prueba automática');
  await page.getByRole('button', { name: 'Guardar pedido' }).click();

  // Debe aterrizar en la ficha, con los datos pintados.
  await expect(page).toHaveURL(/\/pedidos\/\d+$/, { timeout: 15_000 });
  await expect(page.getByText(cliente).first()).toBeVisible();
  await expect(page.getByText('Reja de prueba automática')).toBeVisible();

  // Volver al listado y abrirlo desde ahí: ESTE es el camino que estaba roto.
  await page.getByRole('link', { name: 'Volver' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
  await page.getByText(cliente).first().click();
  await expect(page).toHaveURL(/\/pedidos\/\d+$/);
  await expect(page.getByText('Fecha de entrada')).toBeVisible();

  // Borrar (solo el jefe puede)
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/pedidos$/, { timeout: 15_000 });
  await expect(page.getByText(cliente)).toHaveCount(0);
  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('un trabajo pasa de borrador a enviado y avisa de lo que falta', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador } = await crearMaestrosDePrueba(page, 'trabajo ' + Date.now());
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await expect(page).toHaveURL(/\/trabajos$/);

  // Empezar uno a medias: solo el cliente.
  await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
  await elegir(page, 'Cliente', cliente);
  await page.getByRole('button', { name: 'Guardar borrador' }).click();

  await expect(page).toHaveURL(/\/trabajos\/\d+$/, { timeout: 15_000 });
  await expect(page.getByText('Sin terminar')).toBeVisible();

  // Debe decir qué falta para poder enviarlo.
  await expect(page.getByText('Para poder enviarlo falta:')).toBeVisible();

  // Completarlo
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué se ha hecho').fill('Trabajo de prueba automática');
  await primerMaterial(page, 'Chapa de prueba', '3');
  await page.getByLabel('Horas').fill('2.5');
  await expect(page.getByText('Para poder enviarlo falta:')).toHaveCount(0);

  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Cambios guardados')).toBeVisible({ timeout: 10_000 });

  // Enviar, con su confirmación
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar', exact: true }).last().click();
  await expect(page.getByText(/Enviado el/)).toBeVisible({ timeout: 15_000 });

  // Limpieza
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/trabajos$/, { timeout: 15_000 });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('el circuito completo: trabajo enviado, albarán y firma', async ({ page }) => {
  // El 409 lo provoca la propia prueba al intentar borrar un trabajo que ya
  // tiene albarán: es el comportamiento que se está comprobando.
  const errores = vigilarErrores(page, [409]);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador } = await crearMaestrosDePrueba(page, 'circuito ' + Date.now());

  // 1. Trabajo completo desde el principio
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué se ha hecho').fill('Barandilla de prueba');
  await primerMaterial(page, 'Tubo de 40', '12,5');
  await page.getByLabel('Horas').fill('3,5'); // con coma: así se teclea aquí
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page).toHaveURL(/\/trabajos\/\d+$/, { timeout: 15_000 });

  // 2. Enviarlo
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar', exact: true }).last().click();
  await expect(page.getByText(/Enviado el/)).toBeVisible({ timeout: 15_000 });

  // 3. Generar su albarán
  await expect(page.getByText('Todavía no se ha generado el albarán')).toBeVisible();
  await page.getByRole('button', { name: 'Generar albarán' }).click();
  await page.getByLabel('DNI del cliente').fill('12345678Z');
  await page.getByRole('button', { name: 'Generar', exact: true }).click();

  await expect(page).toHaveURL(/\/albaranes\/\d+$/, { timeout: 15_000 });
  const urlAlbaran = page.url();
  // Los datos se copian del trabajo en el servidor.
  await expect(page.getByText(cliente).first()).toBeVisible();
  await expect(page.getByText('12345678Z')).toBeVisible();
  await expect(page.getByText('Este albarán todavía no está firmado.')).toBeVisible();

  // 4. Firmar en el lienzo, arrastrando como haría un dedo
  await page.getByRole('button', { name: 'Recoger firma' }).click();
  const lienzo = page.locator('canvas.lienzo');
  await expect(lienzo).toBeVisible();
  const caja = await lienzo.boundingBox();
  if (!caja) throw new Error('El lienzo de firma no tiene tamaño');

  await page.mouse.move(caja.x + 40, caja.y + caja.height / 2);
  await page.mouse.down();
  await page.mouse.move(caja.x + 120, caja.y + 40, { steps: 10 });
  await page.mouse.move(caja.x + 200, caja.y + caja.height - 40, { steps: 10 });
  await page.mouse.move(caja.x + 280, caja.y + caja.height / 2, { steps: 10 });
  await page.mouse.up();

  await page.getByRole('button', { name: 'Guardar firma' }).click();
  await expect(page.getByText('Firma guardada')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('img', { name: 'Firma del cliente' })).toBeVisible();
  // Que el <img> exista no basta: hay que comprobar que la imagen llegó.
  expect(await imagenCargada(page, 'img.firma'), 'La firma no se ha descargado').toBe(true);

  // 5. La firma sobrevive a recargar: está guardada en el servidor, no en pantalla.
  await page.reload();
  await expect(page.getByRole('img', { name: 'Firma del cliente' })).toBeVisible({
    timeout: 15_000,
  });
  await expect
    .poll(() => imagenCargada(page, 'img.firma'), { timeout: 10_000 })
    .toBe(true);

  // 6. Con albarán, el trabajo de origen NO se puede borrar
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByText(cliente).first().click();
  await expect(page).toHaveURL(/\/trabajos\/\d+$/);
  await expect(page.getByText(/ya generó el albarán/)).toBeVisible();
  await borrarYConfirmar(page);
  await expect(page.getByText(/está en el albarán/)).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/trabajos\/\d+$/); // sigue ahí, no se borró

  // 7. Limpieza: primero el albarán, después el trabajo
  await page.goto(urlAlbaran);
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/albaranes$/, { timeout: 15_000 });

  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByText(cliente).first().click();
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/trabajos$/, { timeout: 15_000 });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('las fotos se suben, se ven y se borran', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador } = await crearMaestrosDePrueba(page, 'fotos ' + Date.now());

  // Alta de pedido CON foto desde el propio formulario: es el camino que hará
  // el trabajador con la tablet, foto incluida.
  await page.getByRole('link', { name: 'Nuevo pedido' }).click();
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué han pedido').fill('Pedido con foto');

  await page.locator('input[type=file]').setInputFiles(FOTO);
  // La miniatura aparece antes de guardar: la foto se reduce al elegirla.
  await expect(page.getByAltText('Foto pendiente de subir')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Guardar pedido' }).click();
  await expect(page).toHaveURL(/\/pedidos\/\d+$/, { timeout: 20_000 });

  // Y aquí lo importante: que la foto guardada se DESCARGUE de verdad.
  // Un <img> con la fuente rota seguiría estando visible.
  await expect(page.getByText('(1 de 5)')).toBeVisible();
  await expect
    .poll(() => imagenCargada(page, '.galeria img'), { timeout: 15_000 })
    .toBe(true);

  // Verla a tamaño completo
  await page.getByRole('button', { name: 'Ver la foto a tamaño completo' }).click();
  await expect
    .poll(() => imagenCargada(page, 'img[alt="Foto a tamaño completo"]'), { timeout: 15_000 })
    .toBe(true);
  await page.getByRole('button', { name: 'Cerrar' }).click();

  // Añadir una segunda desde la ficha
  await page.locator('input[type=file]').setInputFiles(FOTO);
  await page.getByRole('button', { name: /Subir 1 foto/ }).click();
  await expect(page.getByText('(2 de 5)')).toBeVisible({ timeout: 15_000 });

  // Borrar una
  await page.getByRole('button', { name: 'Borrar esta foto' }).first().click();
  await page.getByRole('button', { name: 'Borrar', exact: true }).last().click();
  await expect(page.getByText('(1 de 5)')).toBeVisible({ timeout: 15_000 });

  // En el listado se ve el contador de fotos
  await page.getByRole('link', { name: 'Volver' }).click();
  await expect(page.getByText(cliente).first()).toBeVisible();

  // Limpieza
  await page.getByText(cliente).first().click();
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/pedidos$/, { timeout: 15_000 });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('dos trabajos de un cliente se unifican en un albarán con su precio', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador } = await crearMaestrosDePrueba(page, 'unificar ' + Date.now());

  // Dos trabajos del MISMO cliente, enviados: son los que se pueden juntar.
  for (const visita of [
    { texto: 'Primera visita de prueba', material: 'Tornillo 3mm', cantidad: '5', horas: '4' },
    { texto: 'Segunda visita de prueba', material: 'Tornillo 3mm', cantidad: '7', horas: '2,5' },
  ]) {
    await page.getByRole('link', { name: 'Trabajos' }).click();
    await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
    await elegir(page, 'Cliente', cliente);
    await elegir(page, 'Trabajador', trabajador);
    await page.getByLabel('Qué se ha hecho').fill(visita.texto);
    await primerMaterial(page, visita.material, visita.cantidad);
    await page.getByLabel('Horas').fill(visita.horas);
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page).toHaveURL(/\/trabajos\/\d+$/, { timeout: 15_000 });

    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await page.getByRole('button', { name: 'Enviar', exact: true }).last().click();
    await expect(page.getByText('Enviado').first()).toBeVisible({ timeout: 15_000 });
  }

  // Filtrar enviados por ese cliente: es lo que habilita la selección.
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.locator('mat-button-toggle', { hasText: 'Enviados' }).click();
  await elegir(page, 'Cliente', cliente);

  // Marcar los dos y generar el albarán unificado.
  const casillas = page.locator('mat-checkbox input[type="checkbox"]');
  await expect(casillas).toHaveCount(2, { timeout: 15_000 });
  await casillas.nth(0).check();
  await casillas.nth(1).check();
  await expect(page.getByText('2 trabajos seleccionados')).toBeVisible();

  await page.getByRole('button', { name: 'Generar albarán' }).click();
  await page.getByLabel('DNI del cliente').fill('12345678Z');
  await page.getByRole('button', { name: 'Generar', exact: true }).click();
  await expect(page).toHaveURL(/\/albaranes\/\d+$/, { timeout: 20_000 });
  const urlAlbaran = page.url();

  // Las dos descripciones, y las horas SUMADAS (4 + 2,5).
  await expect(page.getByText('Primera visita de prueba')).toBeVisible();
  await expect(page.getByText('Segunda visita de prueba')).toBeVisible();
  await expect(page.getByText('6.5')).toBeVisible();

  // Poner precios y comprobar el total en vivo: 12 tornillos a 2 € son 24 €,
  // más 6,5 h a 10 € son 65 €, más 11 € de extra = 100 €.
  await page.getByLabel('Editar').click();
  await page.locator('input[name="material-precio-0"]').fill('2');
  await page.getByLabel('Precio por hora').fill('10');
  await page.getByLabel('Añadir al coste').fill('11');
  await expect(page.getByText('100.00 €')).toBeVisible();

  // Que el total salga impreso es una decisión del jefe, casilla aparte.
  await page.getByRole('checkbox', { name: /Incluir el total/ }).check();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText(/sale en el PDF/)).toBeVisible({ timeout: 15_000 });

  await descargarPdf(page, 'Descargar PDF del albarán', /albaran-\d+\.pdf/);

  // Limpieza: el albarán primero; los trabajos no se pueden borrar antes.
  await page.goto(urlAlbaran);
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/albaranes$/, { timeout: 15_000 });

  for (let i = 0; i < 2; i++) {
    await page.getByRole('link', { name: 'Trabajos' }).click();
    await page.getByText(cliente).first().click();
    await borrarYConfirmar(page);
    await expect(page).toHaveURL(/\/trabajos$/, { timeout: 15_000 });
  }

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('el contador de albaranes se lee y se reencauza', async ({ page }) => {
  const errores = vigilarErrores(page);

  await entrar(page, CUENTAS.jefe);
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page).toHaveURL(/\/configuracion$/);

  // Se lee el valor actual para poder dejarlo como estaba al terminar.
  const campo = page.getByLabel('Próximo número');
  await expect(campo).not.toHaveValue('', { timeout: 15_000 });
  const original = await campo.inputValue();

  await campo.fill('777');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('El próximo albarán llevará el número 777')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('nº 777')).toBeVisible();

  // Restaurar: esta prueba no debe alterar la numeración real del taller.
  await campo.fill(original);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText(`El próximo albarán llevará el número ${original}`)).toBeVisible({
    timeout: 15_000,
  });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('los tres documentos se descargan en PDF y solo los ve el jefe', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador } = await crearMaestrosDePrueba(page, 'pdf ' + Date.now());

  // 1. Pedido
  await page.getByRole('link', { name: 'Nuevo pedido' }).click();
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué han pedido').fill('Reja de prueba para el PDF');
  await page.getByRole('button', { name: 'Guardar pedido' }).click();
  await expect(page).toHaveURL(/\/pedidos\/\d+$/, { timeout: 20_000 });
  const urlPedido = page.url();

  await descargarPdf(page, 'Descargar PDF del pedido', /^pedido-\d+\.pdf$/);

  // 2. Trabajo enviado
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué se ha hecho').fill('Barandilla para el PDF');
  await primerMaterial(page, 'Tubo de 40', '12,5');
  await page.getByLabel('Horas').fill('3,5');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page).toHaveURL(/\/trabajos\/\d+$/, { timeout: 15_000 });

  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar', exact: true }).last().click();
  await expect(page.getByText(/Enviado el/)).toBeVisible({ timeout: 15_000 });

  await descargarPdf(page, 'Descargar PDF del trabajo', /^trabajo-\d+\.pdf$/);

  // 3. Albarán, que es el documento que de verdad se imprime
  await page.getByRole('button', { name: 'Generar albarán' }).click();
  await page.getByLabel('DNI del cliente').fill('12345678Z');
  await page.getByRole('button', { name: 'Generar', exact: true }).click();
  await expect(page).toHaveURL(/\/albaranes\/\d+$/, { timeout: 15_000 });
  const urlAlbaran = page.url();

  await descargarPdf(page, 'Descargar PDF del albarán', /^albaran-\d+\.pdf$/);

  // 4. El trabajador no tiene botón. (Quien manda es el backend, que responde
  //    403 aunque se fuerce la URL; esto solo comprueba que no se le ofrece.)
  await page.evaluate(() => localStorage.clear());
  await entrar(page, CUENTAS.tablet);
  await page.goto(urlPedido);
  await expect(page.getByText(cliente).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Descargar PDF del pedido')).toHaveCount(0);

  // 5. Limpieza, de vuelta como jefe: albarán, trabajo y pedido
  await page.evaluate(() => localStorage.clear());
  await entrar(page, CUENTAS.jefe);

  await page.goto(urlAlbaran);
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/albaranes$/, { timeout: 15_000 });

  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByText(cliente).first().click();
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/trabajos$/, { timeout: 15_000 });

  await page.goto(urlPedido);
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/pedidos$/, { timeout: 15_000 });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('renombrar un cliente en Ajustes cambia su nombre en los documentos', async ({ page }) => {
  // El 409 es a propósito: la prueba intenta borrar un cliente que tiene un
  // pedido, justo para comprobar que el servidor lo impide.
  const errores = vigilarErrores(page, [409]);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador } = await crearMaestrosDePrueba(page, 'renombrar ' + Date.now());

  // Un pedido suyo, para comprobar que el cambio llega hasta el documento.
  await page.getByRole('link', { name: 'Nuevo pedido' }).click();
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué han pedido').fill('Pedido para renombrar');
  await page.getByRole('button', { name: 'Guardar pedido' }).click();
  await expect(page).toHaveURL(/\/pedidos\/\d+$/, { timeout: 15_000 });
  const urlPedido = page.url();

  // Con el pedido existiendo, el cliente NO se puede borrar.
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByLabel(`Borrar ${cliente}`).click();
  await page.getByRole('button', { name: 'Borrar', exact: true }).last().click();
  await expect(page.getByText(/No se puede borrar el cliente/)).toBeVisible({ timeout: 15_000 });

  // Renombrarlo sí, y eso alcanza a todos sus documentos.
  const nuevoNombre = `${cliente} RENOMBRADO`;
  await page.getByLabel(`Renombrar ${cliente}`).click();
  await page.locator('input[name^="editar-"]').fill(nuevoNombre);
  await page.getByLabel('Guardar el nombre').click();
  await expect(page.getByText(nuevoNombre, { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.goto(urlPedido);
  await expect(page.getByText(nuevoNombre).first()).toBeVisible({ timeout: 15_000 });

  // Limpieza: el pedido primero; hasta entonces el cliente no se puede borrar.
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/pedidos$/, { timeout: 15_000 });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('un albarán admite varios trabajadores', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador } = await crearMaestrosDePrueba(page, 'equipo ' + Date.now());

  // Un segundo trabajador, para poder añadirlo al albarán después.
  const segundo = `PRUEBA-HUMO Segundo ${Date.now()}`;
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByLabel('Añadir trabajador').fill(segundo);
  await page.getByRole('button', { name: 'Añadir', exact: true }).last().click();
  await expect(page.getByText(segundo, { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué se ha hecho').fill('Trabajo de un solo trabajador');
  await primerMaterial(page, 'Pletina', '2');
  await page.getByLabel('Horas').fill('1');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page).toHaveURL(/\/trabajos\/\d+$/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar', exact: true }).last().click();
  await expect(page.getByText('Enviado').first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Generar albarán' }).click();
  await page.getByRole('button', { name: 'Generar', exact: true }).click();
  await expect(page).toHaveURL(/\/albaranes\/\d+$/, { timeout: 20_000 });
  const urlAlbaran = page.url();

  // Añadir el segundo en el selector múltiple: el albarán pasa a tener dos.
  await page.getByLabel('Editar').click();
  await page.getByLabel('Trabajadores').click();
  await page.getByRole('option', { name: segundo, exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(page.getByText(`${trabajador}, ${segundo}`)).toBeVisible({ timeout: 15_000 });

  await page.goto(urlAlbaran);
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/albaranes$/, { timeout: 15_000 });
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByText(cliente).first().click();
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/trabajos$/, { timeout: 15_000 });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('un trabajo ya facturado no se puede volver a seleccionar', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador } = await crearMaestrosDePrueba(page, 'facturado ' + Date.now());

  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué se ha hecho').fill('Trabajo que se factura');
  await primerMaterial(page, 'Angular 30', '4');
  await page.getByLabel('Horas').fill('2');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page).toHaveURL(/\/trabajos\/\d+$/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar', exact: true }).last().click();
  await expect(page.getByText('Enviado').first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Generar albarán' }).click();
  await page.getByRole('button', { name: 'Generar', exact: true }).click();
  await expect(page).toHaveURL(/\/albaranes\/\d+$/, { timeout: 20_000 });
  const urlAlbaran = page.url();

  // En el listado filtrado ya aparece como facturado, y su casilla no deja
  // marcarlo: es lo que impide meterlo en un segundo albarán.
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.locator('mat-button-toggle', { hasText: 'Enviados' }).click();
  await elegir(page, 'Cliente', cliente);

  await expect(page.getByText('Ya en un albarán')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('mat-checkbox input[type="checkbox"]').first()).toBeDisabled();

  await page.goto(urlAlbaran);
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/albaranes$/, { timeout: 15_000 });
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByText(cliente).first().click();
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/trabajos$/, { timeout: 15_000 });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('un borrador de pedido guardado con el formato viejo se descarta', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  // Un borrador como los que guardaba la aplicación cuando el cliente y el
  // trabajador se tecleaban: con nombres en vez de ids. Restaurarlo tal cual
  // dejaría el formulario vacío con el cartel de "recuperado" puesto, que es
  // peor que no recuperar nada.
  await page.evaluate(() => {
    localStorage.setItem(
      'taller.borrador.pedido-nuevo',
      JSON.stringify({
        momento: Date.now(),
        datos: { cliente: 'Cliente de antes', trabajador: 'Ana', descripcion: 'Texto viejo' },
      }),
    );
  });

  await page.goto('/pedidos/nuevo');
  await expect(page.getByLabel('Qué han pedido')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Se ha recuperado un pedido que quedó a medias')).toHaveCount(0);

  // Y uno con el formato actual SÍ se recupera: la comprobación no puede ser
  // tan estricta que se cargue la red de seguridad que esto existe para dar.
  await page.evaluate(() => {
    localStorage.setItem(
      'taller.borrador.pedido-nuevo',
      JSON.stringify({
        momento: Date.now(),
        datos: { clienteId: null, trabajadorId: null, descripcion: 'Texto reciente' },
      }),
    );
  });

  await page.goto('/pedidos/nuevo');
  await expect(page.getByText('Se ha recuperado un pedido que quedó a medias')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByLabel('Qué han pedido')).toHaveValue('Texto reciente');

  await page.getByRole('button', { name: 'Empezar de cero' }).click();
  await expect(page.getByText('Se ha recuperado un pedido que quedó a medias')).toHaveCount(0);

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('las pantallas pendientes se abren sin romperse', async ({ page }) => {
  const errores = vigilarErrores(page);

  await entrar(page, CUENTAS.jefe);

  await page.getByRole('link', { name: 'Albaranes' }).click();
  await expect(page).toHaveURL(/\/albaranes$/);

  await page.getByRole('link', { name: 'Ajustes' }).click();
  await expect(page).toHaveURL(/\/configuracion$/);

  // Enlace profundo: recargar estando dentro tiene que seguir funcionando.
  await page.goto('/trabajos');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Trabajos' })).toBeVisible();

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});
