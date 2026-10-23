import { expect, test, request as peticionApi } from '@playwright/test';
import { vigilarErrores, borrarYConfirmar, elegir, entrar, sesionLimpia } from './comun/ayudantes';
import { CUENTAS, dniDePrueba, anadirEnAjustes, anadirClienteSinEsperar, crearMaestrosDePrueba } from './comun/datos-de-prueba';

/** Ajustes: clientes con su DNI, catálogo de materiales y su buscador. */

test.beforeEach(sesionLimpia);

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
  await page.getByLabel(`Editar ${cliente}`).click();
  await page.locator('input[name^="editar-nombre-"]').fill(nuevoNombre);
  await page.getByLabel('Guardar el cliente').click();
  await expect(page.getByText(nuevoNombre, { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.goto(urlPedido);
  await expect(page.getByText(nuevoNombre).first()).toBeVisible({ timeout: 15_000 });

  // Limpieza: el pedido primero; hasta entonces el cliente no se puede borrar.
  await borrarYConfirmar(page);
  await expect(page).toHaveURL(/\/pedidos$/, { timeout: 15_000 });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('el DNI del cliente es obligatorio, se comprueba y no se repite', async ({ page }) => {
  // Los 400 y el 409 los provoca la prueba a propósito: es lo que se comprueba.
  const errores = vigilarErrores(page, [400, 409]);
  await entrar(page, CUENTAS.jefe);
  await page.goto('/configuracion');

  const marca = Date.now();
  const nombre = `PRUEBA-HUMO Cliente DNI ${marca}`;
  const dni = dniDePrueba();

  // Sin DNI no se puede ni pulsar "Añadir".
  await page.getByLabel('Añadir cliente', { exact: true }).fill(nombre);
  const botonAnadir = page.locator('input[name="nuevo-dni"]')
    .locator('xpath=ancestor::form').getByRole('button', { name: 'Añadir', exact: true });
  await expect(botonAnadir).toBeDisabled();

  // Con la letra equivocada, el servidor lo rechaza y dice cuál sería.
  const malaLetra = dni.slice(0, 8) + (dni.endsWith('A') ? 'B' : 'A');
  await page.locator('input[name="nuevo-dni"]').fill(malaLetra);
  await botonAnadir.click();
  await expect(page.getByText(/no cuadra/)).toBeVisible({ timeout: 10_000 });

  // Escrito con puntos, guion y en minúscula vale, y se guarda limpio.
  const conFormato = `${dni.slice(0, 2)}.${dni.slice(2, 5)}.${dni.slice(5, 8)}-${dni[8].toLowerCase()}`;
  await page.locator('input[name="nuevo-dni"]').fill(conFormato);
  await botonAnadir.click();
  await expect(page.getByText(nombre, { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(dni, { exact: true })).toBeVisible();

  // Otro cliente con el mismo DNI: es el mismo dado de alta dos veces.
  await anadirClienteSinEsperar(page, `${nombre} OTRO`, dni);
  await expect(page.getByText(/ya es del cliente/)).toBeVisible({ timeout: 10_000 });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('el catálogo calcula el precio total con extra y transporte', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const sufijo = 'catalogo ' + Date.now();
  const familia = `PRUEBA-HUMO Familia ${sufijo}`;
  const material = `PRUEBA-HUMO Tubo ${sufijo}`;

  await page.goto('/configuracion');
  await anadirEnAjustes(page, 'Añadir familia', familia);

  await elegir(page, 'Familia', familia);
  await page.getByRole('button', { name: 'Nuevo material' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(material);
  await page.getByLabel('Unidad', { exact: true }).fill('m');
  await page.getByLabel('Precio del material').fill('10');
  await page.getByLabel('Extra sobre el material').fill('10');
  await page.getByLabel('Transporte').fill('2');

  // 10 + 10 % de 10 + 2 = 13, y se ve al teclear, antes de guardar.
  await expect(page.locator('.total strong')).toHaveText(/13\.00 €/);

  await page.getByRole('button', { name: 'Guardar material' }).click();
  await expect(page.getByText('13.00 €/m')).toBeVisible({ timeout: 10_000 });

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('el material se busca por cualquier trozo del nombre, o se despliega entero', async ({ page }) => {
  const errores = vigilarErrores(page);

  // El catálogo de esta prueba se crea por la API: lo que se prueba aquí es el
  // buscador, no la pantalla de Ajustes (que ya recorren otras pruebas).
  const marca = Date.now();
  const api = await peticionApi.newContext({ baseURL: 'http://127.0.0.1:8080' });
  const { token } = await (await api.post('/api/login', {
    data: { usuario: 'jefe', contrasena: 'jefe123' },
  })).json();
  const h = { Authorization: `Bearer ${token}` };
  const familia = await (await api.post('/api/familias-material', {
    headers: h, data: { nombre: `PRUEBA-HUMO Ferretería ${marca}` },
  })).json();
  const nombres = {
    tornillo: `PRUEBA-HUMO Tornillo M8 ${marca}`,
    anilla: `PRUEBA-HUMO Anilla 20 ${marca}`,
    tuberia: `PRUEBA-HUMO Tubería 1/2 ${marca}`,
    tubo: `PRUEBA-HUMO Tubo 40x40 ${marca}`,
  };
  for (const nombre of Object.values(nombres)) {
    await api.post('/api/catalogo', {
      headers: h, data: { familiaId: familia.id, nombre, unidad: 'ud', precio: 1 },
    });
  }
  await api.dispose();

  await entrar(page, CUENTAS.jefe);
  await page.goto('/trabajos/nuevo');
  const campo = page.locator('input[name="material-nombre-0"]');

  // "nill" está DENTRO de "Tornillo" y de "Anilla": salen los dos, y nada más.
  await campo.fill('nill');
  await expect(page.getByRole('option', { name: nombres.tornillo })).toBeVisible();
  await expect(page.getByRole('option', { name: nombres.anilla })).toBeVisible();
  await expect(page.getByRole('option', { name: nombres.tubo })).toHaveCount(0);
  await expect(page.getByRole('option', { name: nombres.tuberia })).toHaveCount(0);

  // Sin tilde también encuentra la que la lleva: en la tablet nadie las pone.
  await campo.fill('tuberia 1/2');
  await expect(page.getByRole('option', { name: nombres.tuberia })).toBeVisible();

  // Algo que no existe lo dice, en vez de dejar la lista vacía sin más.
  await campo.fill('zzzz-no-existe');
  await expect(page.getByRole('option', { name: /Ningún material contiene/ })).toBeVisible();

  // Escrito pero sin elegir: avisa, porque esa fila no cuenta como material.
  await page.getByLabel('Qué se ha hecho').click();
  await expect(page.getByText('Elige un material de la lista')).toBeVisible();

  // La flecha borra la búsqueda a medias y despliega el catálogo ENTERO.
  await page.getByRole('button', { name: 'Ver todos los materiales' }).first().click();
  for (const nombre of Object.values(nombres)) {
    await expect(page.getByRole('option', { name: nombre })).toBeVisible();
  }

  // Al elegir, el aviso desaparece y la unidad sale junto a la cantidad.
  await page.getByRole('option', { name: nombres.anilla }).click();
  await expect(campo).toHaveValue(nombres.anilla);
  await expect(page.getByText('Elige un material de la lista')).toHaveCount(0);

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});
