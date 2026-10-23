import { expect, test } from '@playwright/test';
import { vigilarErrores, imagenCargada, borrarYConfirmar, elegir, entrar, sesionLimpia } from './comun/ayudantes';
import { FOTO, CUENTAS, crearMaestrosDePrueba } from './comun/datos-de-prueba';

/** Pedidos: alta, ficha, fotos y el borrador guardado en el navegador. */

test.beforeEach(sesionLimpia);

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
