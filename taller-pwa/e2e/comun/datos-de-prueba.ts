import { expect, Page } from '@playwright/test';
import { join } from 'node:path';
import { elegir } from './ayudantes';

/** Cuentas, ficheros y altas en Ajustes que necesitan las pruebas para crear documentos. */

/** Imagen real (PNG de 64x64) para las pruebas de subida. */
export const FOTO = join(__dirname, '..', 'ficheros', 'foto-prueba.png');

export const CUENTAS = {
  jefe: { usuario: 'jefe', contrasena: 'jefe123' },
  tablet: { usuario: 'tablet', contrasena: 'tablet123' },
};

/**
 * Un DNI válido (con su letra bien calculada) y distinto en cada llamada: dos
 * clientes no pueden compartir DNI, y los de una ejecución fallida pueden
 * seguir en la base.
 */
export function dniDePrueba(): string {
  const numero = Math.floor(10_000_000 + Math.random() * 89_999_999);
  return `${numero}${'TRWAGMYFPDXBNJZSQVHLCKE'[numero % 23]}`;
}

/**
 * Escribe un nombre en una de las listas de Ajustes y pulsa su "Añadir".
 * Los clientes no: llevan DNI y tienen su propio ayudante, anadirCliente().
 *
 * Hay tres listas con el mismo botón (clientes, trabajadores y familias), así
 * que se pulsa el del propio formulario y no el primero o el último de la
 * página: con una lista más, "el último" dejaba de ser el que se creía.
 */
export async function anadirEnAjustes(page: Page, etiqueta: string, nombre: string) {
  const campo = page.getByLabel(etiqueta, { exact: true });
  await campo.fill(nombre);
  await campo.locator('xpath=ancestor::form').getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(page.getByText(nombre, { exact: true })).toBeVisible({ timeout: 10_000 });
}

/** Da de alta un cliente en Ajustes, con su DNI, que ya es obligatorio. */
export async function anadirCliente(page: Page, nombre: string, dni: string) {
  await page.getByLabel('Añadir cliente', { exact: true }).fill(nombre);
  const campoDni = page.locator('input[name="nuevo-dni"]');
  await campoDni.fill(dni);
  await campoDni.locator('xpath=ancestor::form').getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(page.getByText(nombre, { exact: true })).toBeVisible({ timeout: 10_000 });
}

/** Como anadirCliente(), pero sin esperar a que salga: para los casos que fallan. */
export async function anadirClienteSinEsperar(page: Page, nombre: string, dni: string) {
  await page.getByLabel('Añadir cliente', { exact: true }).fill(nombre);
  const campoDni = page.locator('input[name="nuevo-dni"]');
  await campoDni.fill(dni);
  await campoDni.locator('xpath=ancestor::form').getByRole('button', { name: 'Añadir', exact: true }).click();
}

/**
 * Da de alta en Ajustes lo que las pruebas necesitan para crear documentos:
 * un cliente, un trabajador y un material del catálogo (con su familia).
 *
 * Hace falta porque nada de eso se teclea ya: se elige de listas que mantiene
 * el jefe. De paso, esto recorre la pantalla de Ajustes.
 */
export async function crearMaestrosDePrueba(page: Page, sufijo: string) {
  const cliente = `PRUEBA-HUMO Cliente ${sufijo}`;
  const trabajador = `PRUEBA-HUMO Ana ${sufijo}`;
  const familia = `PRUEBA-HUMO Familia ${sufijo}`;
  const material = `PRUEBA-HUMO Material ${sufijo}`;
  const dni = dniDePrueba();

  await page.goto('/configuracion');
  await anadirCliente(page, cliente, dni);
  await anadirEnAjustes(page, 'Añadir trabajador', trabajador);
  await anadirEnAjustes(page, 'Añadir familia', familia);
  await crearMaterialEnAjustes(page, familia, material, { precio: '10', extra: '0', transporte: '0' });

  // Se vuelve a pedidos, que es donde las pruebas esperan estar: desde aquí
  // está tanto el enlace de "Nuevo pedido" como la navegación de abajo.
  await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
  await expect(page).toHaveURL(/\/pedidos$/, { timeout: 10_000 });

  return { cliente, dni, trabajador, familia, material };
}

/** Elige la familia en Ajustes y da de alta un material dentro, en metros. */
export async function crearMaterialEnAjustes(
  page: Page,
  familia: string,
  material: string,
  precio: { precio: string; extra: string; transporte: string },
) {
  await elegir(page, 'Familia', familia);
  await page.getByRole('button', { name: 'Nuevo material' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(material);
  await page.getByLabel('Unidad', { exact: true }).fill('m');
  await page.getByLabel('Precio del material').fill(precio.precio);
  await page.getByLabel('Extra sobre el material').fill(precio.extra);
  await page.getByLabel('Transporte').fill(precio.transporte);
  await page.getByRole('button', { name: 'Guardar material' }).click();
  await expect(page.getByText(material)).toBeVisible({ timeout: 10_000 });
}
