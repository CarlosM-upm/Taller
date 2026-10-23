import { expect, test } from '@playwright/test';
import { vigilarErrores, entrar, sesionLimpia } from './comun/ayudantes';
import { CUENTAS } from './comun/datos-de-prueba';

/** Entrar, permisos de cada cuenta y que las pantallas abran sin romperse. */

test.beforeEach(sesionLimpia);

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
  // La dirección sola abre Trabajos, aunque en la barra vaya segundo.
  await page.goto('/');
  await expect(page).toHaveURL(/\/trabajos$/, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Trabajos' })).toBeVisible();
  await expect(page.locator('nav.navegacion a').first()).toContainText('Pedidos');
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
