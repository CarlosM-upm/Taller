import { APIRequestContext, expect, test, request as peticionApi } from '@playwright/test';
import { vigilarErrores, elegir, entrar, sesionLimpia } from './comun/ayudantes';
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
    await expect(page.getByRole('navigation', { name: 'Páginas de clientes' }).getByText('1–20 de 22')).toBeVisible();
    await expect(page.getByText(creados[0].nombre, { exact: true })).toBeVisible();
    await expect(page.getByText(creados[21].nombre, { exact: true })).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Páginas de clientes' }).getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('navigation', { name: 'Páginas de clientes' }).getByText('21–22 de 22')).toBeVisible();
    await expect(page.getByText(creados[21].nombre, { exact: true })).toBeVisible();

    // Por DNI, aunque se escriba con puntos y en minúscula. Una nueva búsqueda
    // vuelve a la primera página.
    const dni = creados[5].dni;
    await buscador.fill(`${dni.slice(0, 2)}.${dni.slice(2, 8)}-${dni[8].toLowerCase()}`);
    await expect(page.getByText(creados[5].nombre, { exact: true })).toBeVisible();
    await expect(page.getByText(creados[6].nombre, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Páginas de clientes' }).getByRole('button', { name: 'Siguiente' })).toHaveCount(0);
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

/** Una familia con sus materiales, por la API. Devuelve los ids para borrarlos. */
async function familiaConMateriales(api: APIRequestContext, h: Record<string, string>,
                                     familia: string, materiales: string[]) {
  const f = await (await api.post('/api/familias-material', { headers: h, data: { nombre: familia } })).json();
  const ids: number[] = [];
  for (const nombre of materiales) {
    const m = await (await api.post('/api/catalogo', {
      headers: h, data: { familiaId: f.id, nombre, unidad: 'ud', precio: 1 },
    })).json();
    ids.push(m.id);
  }
  return { familiaId: f.id as number, ids };
}

test('en un trabajo, el material se acota por familia y con "Todas" vuelven todos', async ({ page }) => {
  const errores = vigilarErrores(page);
  const marca = Date.now();
  const tornilleria = `PRUEBA-HUMO Tornillería ${marca}`;
  const perfiles = `PRUEBA-HUMO Perfiles ${marca}`;
  const tornillo = `PRUEBA-HUMO Tornillo ${marca}`;
  const tubo = `PRUEBA-HUMO Tubo ${marca}`;
  const { api, h } = await apiDeJefe();
  await familiaConMateriales(api, h, tornilleria, [tornillo]);
  await familiaConMateriales(api, h, perfiles, [tubo]);
  await api.dispose();

  await entrar(page, CUENTAS.jefe);
  await page.goto('/trabajos/nuevo');
  const familia = page.locator('mat-select[data-fila="0"]');
  const verTodos = page.getByRole('button', { name: 'Ver todos los materiales' }).first();

  // Con una familia elegida, la lista solo enseña las suyas.
  await familia.click();
  await page.getByRole('option', { name: perfiles, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await verTodos.click();
  await expect(page.getByRole('option', { name: tubo })).toBeVisible();
  await expect(page.getByRole('option', { name: tornillo })).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Con "Todas", vuelve el catálogo entero.
  await familia.click();
  await page.getByRole('option', { name: 'Todas', exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await verTodos.click();
  await expect(page.getByRole('option', { name: tornillo })).toBeVisible();
  await page.getByRole('option', { name: tornillo }).click();
  await expect(page.locator('input[name="material-nombre-0"]')).toHaveValue(tornillo);

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});

test('en Ajustes los materiales se ven todos o por familia, y van por páginas', async ({ page }) => {
  const errores = vigilarErrores(page);
  const marca = Date.now();
  const grande = `PRUEBA-HUMO Grande ${marca}`;
  const pequena = `PRUEBA-HUMO Pequeña ${marca}`;
  const nombres = Array.from({ length: 22 }, (_, i) => `PRUEBA-HUMO Pieza ${String(i + 1).padStart(2, '0')} ${marca}`);
  const suelto = `PRUEBA-HUMO Suelto ${marca}`;
  const { api, h } = await apiDeJefe();
  const creadas = [
    await familiaConMateriales(api, h, grande, nombres),
    await familiaConMateriales(api, h, pequena, [suelto]),
  ];

  try {
    await entrar(page, CUENTAS.jefe);
    await page.goto('/configuracion');

    // Sin familia se ven todas; para añadir hay que elegir una.
    await expect(page.getByText('Para añadir un material, elige antes su familia.')).toBeVisible();
    await page.getByLabel('Buscar material').fill(String(marca));
    await expect(page.getByRole('navigation', { name: 'Páginas de materiales' }).getByText('1–20 de 23')).toBeVisible();

    // Con una familia, solo las suyas, y por páginas.
    await elegir(page, 'Familia', grande);
    await expect(page.getByRole('navigation', { name: 'Páginas de materiales' }).getByText('1–20 de 22')).toBeVisible();
    await expect(page.getByText(suelto)).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Páginas de materiales' }).getByRole('button', { name: 'Siguiente' }).click();
    await expect(page.getByRole('navigation', { name: 'Páginas de materiales' }).getByText('21–22 de 22')).toBeVisible();
    await expect(page.getByText(nombres[21])).toBeVisible();

    // "Todas las familias" vuelve a enseñarlas todas, cada una con su familia.
    await elegir(page, 'Familia', 'Todas las familias');
    await page.getByLabel('Buscar material').fill(suelto);
    await expect(page.locator('li', { hasText: suelto })).toContainText(pequena);
  } finally {
    for (const { familiaId, ids } of creadas) {
      for (const id of ids) await api.delete(`/api/catalogo/${id}`, { headers: h });
      await api.delete(`/api/familias-material/${familiaId}`, { headers: h });
    }
    await api.dispose();
  }

  expect(errores, `Errores en el navegador:\n${errores.join('\n')}`).toEqual([]);
});
