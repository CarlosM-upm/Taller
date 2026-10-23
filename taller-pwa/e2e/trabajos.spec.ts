import { expect, test } from '@playwright/test';
import { vigilarErrores, imagenCargada, borrarYConfirmar, elegir, primerMaterial, entrar, cambiarA, firmarEnLienzo, etiquetaDeFirmaEnLista, sesionLimpia } from './comun/ayudantes';
import { CUENTAS, dniDePrueba, anadirCliente, crearMaestrosDePrueba } from './comun/datos-de-prueba';

/**
 * Trabajos: de borrador a enviado, la firma en la obra, el filtro de enviados
 * y que un trabajo ya facturado no se pueda volver a seleccionar.
 */

test.beforeEach(sesionLimpia);

test('un trabajo pasa de borrador a enviado y avisa de lo que falta', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador, material } = await crearMaestrosDePrueba(page, 'trabajo ' + Date.now());
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
  await primerMaterial(page, material, '3');
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

test('el trabajador recoge la firma en la obra y el albarán la hereda', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);
  const { cliente, trabajador, material } = await crearMaestrosDePrueba(page, 'firma ' + Date.now());

  // La tablet empieza el trabajo y el cliente firma en la obra.
  await cambiarA(page, CUENTAS.tablet);
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué se ha hecho').fill('Trabajo firmado en la obra');
  await primerMaterial(page, material, '3');
  await page.getByLabel('Horas').fill('2');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page).toHaveURL(/\/trabajos\/\d+$/, { timeout: 15_000 });
  const urlTrabajo = page.url();

  // En la lista se ve si falta la firma, sin abrir el trabajo.
  await etiquetaDeFirmaEnLista(page, 'Trabajo firmado en la obra', 'Sin terminar', 'Sin firmar');
  await page.goto(urlTrabajo);

  await page.getByRole('button', { name: 'Recoger firma' }).click();
  await firmarEnLienzo(page);
  await expect(page.getByText('Firma del cliente guardada')).toBeVisible({ timeout: 15_000 });
  expect(await imagenCargada(page, 'img.firma'), 'la firma del trabajo no se ve').toBe(true);
  await etiquetaDeFirmaEnLista(page, 'Trabajo firmado en la obra', 'Todos', 'Firmado');
  await page.goto(urlTrabajo);

  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar', exact: true }).last().click();
  await expect(page.getByText('Enviado').first()).toBeVisible({ timeout: 15_000 });

  // Enviado y firmado: la tablet ya NO puede sustituir la firma.
  await expect(page.getByRole('button', { name: 'Volver a firmar' })).toHaveCount(0);
  await etiquetaDeFirmaEnLista(page, 'Trabajo firmado en la obra', 'Enviados', 'Firmado');

  // El jefe genera el albarán de ESE trabajo, y sale ya firmado.
  await cambiarA(page, CUENTAS.jefe);
  await page.goto(urlTrabajo);
  await page.getByRole('button', { name: 'Generar albarán' }).click();
  await page.getByRole('button', { name: 'Generar', exact: true }).click();
  await expect(page).toHaveURL(/\/albaranes\/\d+$/, { timeout: 20_000 });
  const urlAlbaran = page.url();
  await expect(page.locator('img.firma')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => imagenCargada(page, 'img.firma'), { timeout: 15_000 }).toBe(true);

  await page.goto(urlAlbaran);
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/albaranes$/, { timeout: 15_000 });
  await page.goto(urlTrabajo);
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/trabajos$/, { timeout: 15_000 });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('en Enviados se puede volver a ver los trabajos de todos los clientes', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);
  const { cliente, trabajador, material } = await crearMaestrosDePrueba(page, 'todos ' + Date.now());

  const otro = `${cliente} OTRO`;
  await page.goto('/configuracion');
  await anadirCliente(page, otro, dniDePrueba());

  // Con la hora dentro, como todos los datos de prueba: si una ejecución falla
  // a medias y deja trabajos, la siguiente no los confunde con los suyos.
  const marca = Date.now();
  const delPrimero = `Trabajo del primero ${marca}`;
  const delSegundo = `Trabajo del segundo ${marca}`;

  const urls: string[] = [];
  for (const [quien, texto] of [[cliente, delPrimero], [otro, delSegundo]]) {
    await page.getByRole('link', { name: 'Trabajos' }).click();
    await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
    await elegir(page, 'Cliente', quien);
    await elegir(page, 'Trabajador', trabajador);
    await page.getByLabel('Qué se ha hecho').fill(texto);
    await primerMaterial(page, material, '1');
    await page.getByLabel('Horas').fill('1');
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page).toHaveURL(/\/trabajos\/\d+$/, { timeout: 15_000 });
    urls.push(page.url());
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await page.getByRole('button', { name: 'Enviar', exact: true }).last().click();
    await expect(page.getByText('Enviado').first()).toBeVisible({ timeout: 15_000 });
  }

  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.locator('mat-button-toggle', { hasText: 'Enviados' }).click();

  // Con un cliente elegido solo salen los suyos…
  await elegir(page, 'Filtrar por cliente', cliente);
  await expect(page.getByText(delPrimero)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(delSegundo)).toHaveCount(0);

  // …y "Todos los clientes" quita el filtro: vuelven a salir los dos.
  await elegir(page, 'Filtrar por cliente', 'Todos los clientes');
  await expect(page.getByText(delPrimero)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(delSegundo)).toBeVisible();

  for (const url of urls) {
    await page.goto(url);
    await borrarYConfirmar(page);
    await expect(page).toHaveURL(/\/trabajos$/, { timeout: 15_000 });
  }

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('un trabajo ya facturado no se puede volver a seleccionar', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador, material } = await crearMaestrosDePrueba(page, 'facturado ' + Date.now());

  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué se ha hecho').fill('Trabajo que se factura');
  await primerMaterial(page, material, '4');
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
  await elegir(page, 'Filtrar por cliente', cliente);

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
