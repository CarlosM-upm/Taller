import { expect, Page, test } from '@playwright/test';

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
 */
function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];

  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') {
      errores.push(`Consola: ${mensaje.text()}`);
    }
  });

  page.on('pageerror', (fallo) => {
    errores.push(`Excepción sin capturar: ${fallo.message}`);
  });

  return errores;
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
  await page.getByRole('button', { name: 'Borrar' }).click();
  await page.getByRole('button', { name: 'Borrar', exact: true }).last().click();
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
  await page.getByRole('button', { name: 'Borrar' }).click();
  await page.getByRole('button', { name: 'Borrar', exact: true }).last().click();
  await expect(page).toHaveURL(/\/trabajos$/, { timeout: 15_000 });

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
