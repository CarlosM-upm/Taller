import { APIRequestContext, expect, test, request as peticionApi } from '@playwright/test';
import { vigilarErrores, entrar, pestanaDeAjustes, sesionLimpia } from './comun/ayudantes';
import { CUENTAS, dniDePrueba } from './comun/datos-de-prueba';

/**
 * Buscar con cientos de clientes y materiales: el campo de cliente de los
 * formularios, y los buscadores y las páginas de Ajustes.
 *
 * Los datos se crean por la API: lo que se prueba es la búsqueda, no las altas
 * de Ajustes, que ya recorren otras pruebas.
 */

test.beforeEach(sesionLimpia);

/** Contexto de API con la sesión del jefe, y sus cabeceras. */
async function apiDeJefe(): Promise<{ api: APIRequestContext; h: Record<string, string> }> {
  const api = await peticionApi.newContext({ baseURL: 'http://127.0.0.1:8080' });
  const { token } = await (await api.post('/api/login', {
    data: { usuario: CUENTAS.jefe.usuario, contrasena: CUENTAS.jefe.contrasena },
  })).json();
  return { api, h: { Authorization: `Bearer ${token}` } };
}

test('el cliente se busca escribiendo o se despliega entero', async ({ page }) => {
  const errores = vigilarErrores(page);
  const marca = Date.now();
  const perez = `PRUEBA-HUMO Ferretería Pérez ${marca}`;
  const gomez = `PRUEBA-HUMO Talleres Gómez ${marca}`;
  const { api, h } = await apiDeJefe();
  for (const nombre of [perez, gomez]) {
    await api.post('/api/clientes', { headers: h, data: { nombre, dni: dniDePrueba() } });
  }
  await api.dispose();

  await entrar(page, CUENTAS.jefe);
  await page.goto('/trabajos/nuevo');
  const campo = page.getByRole('combobox', { name: 'Cliente', exact: true });

  // Un trozo del nombre, sin tildes: sale el que lo contiene, y solo ese.
  await campo.fill('ferreteria perez');
  await expect(page.getByRole('option', { name: perez })).toBeVisible();
  await expect(page.getByRole('option', { name: gomez })).toHaveCount(0);

  // Algo que no existe lo dice.
  await campo.fill('zzzz-no-existe');
  await expect(page.getByRole('option', { name: /Ningún cliente contiene/ })).toBeVisible();

  // Salir sin elegir deja el campo como estaba: vacío, no con un texto suelto.
  await page.getByLabel('Qué se ha hecho').click();
  await expect(campo).toHaveValue('');

  // La flecha despliega la lista entera, y al tocar uno queda elegido.
  await page.getByRole('button', { name: 'Ver todos los clientes' }).click();
  await expect(page.getByRole('option', { name: perez })).toBeVisible();
  await page.getByRole('option', { name: gomez }).click();
  await expect(campo).toHaveValue(gomez);

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('en Ajustes los clientes se buscan por nombre o DNI y van por páginas', async ({ page }) => {
  const errores = vigilarErrores(page);
  const marca = Date.now();
  const { api, h } = await apiDeJefe();
  const creados: { id: number; nombre: string; dni: string }[] = [];
  for (let i = 1; i <= 22; i++) {
    const datos = { nombre: `PRUEBA-HUMO Paginar ${String(i).padStart(2, '0')} ${marca}`, dni: dniDePrueba() };
    creados.push(await (await api.post('/api/clientes', { headers: h, data: datos })).json());
  }

  try {
    await entrar(page, CUENTAS.jefe);
    await page.goto('/configuracion');
    const buscador = page.getByLabel('Buscar cliente');

    // 22 coinciden: 20 en la primera página y 2 en la segunda.
    await buscador.fill(`Paginar`);
    await expect(page.getByText('1–20 de 22')).toBeVisible();
    await expect(page.getByText(creados[0].nombre, { exact: true })).toBeVisible();
    await expect(page.getByText(creados[21].nombre, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByText('21–22 de 22')).toBeVisible();
    await expect(page.getByText(creados[21].nombre, { exact: true })).toBeVisible();

    // Por DNI, aunque se escriba con puntos y en minúscula. Una nueva búsqueda
    // vuelve a la primera página.
    const dni = creados[5].dni;
    await buscador.fill(`${dni.slice(0, 2)}.${dni.slice(2, 8)}-${dni[8].toLowerCase()}`);
    await expect(page.getByText(creados[5].nombre, { exact: true })).toBeVisible();
    await expect(page.getByText(creados[6].nombre, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Siguiente' })).toHaveCount(0);
  } finally {
    // Se borran ya, no al final: con 22 clientes más, las pruebas que vienen
    // detrás encontrarían los suyos en otra página.
    for (const cliente of creados) await api.delete(`/api/clientes/${cliente.id}`, { headers: h });
    await api.dispose();
  }

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('en Ajustes los materiales se buscan en todas las familias', async ({ page }) => {
  const errores = vigilarErrores(page);
  const marca = Date.now();
  const { api, h } = await apiDeJefe();
  const tornilleria = await (await api.post('/api/familias-material', {
    headers: h, data: { nombre: `PRUEBA-HUMO Tornillería ${marca}` },
  })).json();
  const perfiles = await (await api.post('/api/familias-material', {
    headers: h, data: { nombre: `PRUEBA-HUMO Perfiles ${marca}` },
  })).json();
  const tornillo = `PRUEBA-HUMO Tornillo M8 ${marca}`;
  const anilla = `PRUEBA-HUMO Anilla 20 ${marca}`;
  const tubo = `PRUEBA-HUMO Tubo 40x40 ${marca}`;
  for (const [familia, nombre] of [[tornilleria, tornillo], [perfiles, anilla], [perfiles, tubo]]) {
    await api.post('/api/catalogo', {
      headers: h, data: { familiaId: familia.id, nombre, unidad: 'ud', precio: 1 },
    });
  }
  await api.dispose();

  await entrar(page, CUENTAS.jefe);
  await page.goto('/configuracion');
  await pestanaDeAjustes(page, 'Materiales');

  // "nill" está en Tornillo y en Anilla, que son de familias distintas: salen
  // los dos, cada uno con su familia, sin haber elegido ninguna.
  await page.getByLabel('Buscar material').fill('nill');
  const fila = (nombre: string) => page.locator('li', { hasText: nombre });
  await expect(fila(tornillo)).toContainText(tornilleria.nombre);
  await expect(fila(anilla)).toContainText(perfiles.nombre);
  await expect(fila(tubo)).toHaveCount(0);

  // Se puede editar desde los resultados.
  await page.getByLabel(`Editar ${anilla}`).click();
  await expect(page.getByRole('heading', { name: 'Editar material' })).toBeVisible();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(anilla);
  await page.getByRole('button', { name: 'Cancelar' }).click();

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});
