import { expect, Page, test } from '@playwright/test';
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

async function entrar(page: Page, cuenta: { usuario: string; contrasena: string }) {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(cuenta.usuario);
  await page.getByLabel('Contraseña').fill(cuenta.contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
  // Tras entrar se va a pedidos: si no llega, el login no funcionó.
  await expect(page).toHaveURL(/\/pedidos$/, { timeout: 15_000 });
}

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
  const cliente = `${MARCA} pedido`;

  await entrar(page, CUENTAS.jefe);

  // Alta
  await page.getByRole('link', { name: 'Nuevo pedido' }).click();
  await expect(page).toHaveURL(/\/pedidos\/nuevo$/);
  await page.getByLabel('Cliente').fill(cliente);
  await page.getByLabel('Trabajador').fill('Ana');
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
  const cliente = `${MARCA} trabajo`;

  await entrar(page, CUENTAS.jefe);
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await expect(page).toHaveURL(/\/trabajos$/);

  // Empezar uno a medias: solo el cliente.
  await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
  await page.getByLabel('Cliente').fill(cliente);
  await page.getByRole('button', { name: 'Guardar borrador' }).click();

  await expect(page).toHaveURL(/\/trabajos\/\d+$/, { timeout: 15_000 });
  await expect(page.getByText('Sin terminar')).toBeVisible();

  // Debe decir qué falta para poder enviarlo.
  await expect(page.getByText('Para poder enviarlo falta:')).toBeVisible();

  // Completarlo
  await page.getByLabel('Trabajador').fill('Ana');
  await page.getByLabel('Qué se ha hecho').fill('Trabajo de prueba automática');
  await page.getByLabel('Materiales').fill('Chapa de prueba');
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
  const cliente = `${MARCA} circuito`;

  await entrar(page, CUENTAS.jefe);

  // 1. Trabajo completo desde el principio
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
  await page.getByLabel('Cliente').fill(cliente);
  await page.getByLabel('Trabajador').fill('Ana');
  await page.getByLabel('Qué se ha hecho').fill('Barandilla de prueba');
  await page.getByLabel('Materiales').fill('Tubo de 40');
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
  await expect(page.getByText(/ya tiene el albarán/)).toBeVisible({ timeout: 15_000 });
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
  const cliente = `${MARCA} fotos`;

  await entrar(page, CUENTAS.jefe);

  // Alta de pedido CON foto desde el propio formulario: es el camino que hará
  // el trabajador con la tablet, foto incluida.
  await page.getByRole('link', { name: 'Nuevo pedido' }).click();
  await page.getByLabel('Cliente').fill(cliente);
  await page.getByLabel('Trabajador').fill('Ana');
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
