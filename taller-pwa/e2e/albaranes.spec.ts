import { expect, test } from '@playwright/test';
import { vigilarErrores, imagenCargada, borrarYConfirmar, descargarPdf, elegir, primerMaterial, entrar, sesionLimpia } from './comun/ayudantes';
import { CUENTAS, dniDePrueba, anadirEnAjustes, crearMaestrosDePrueba } from './comun/datos-de-prueba';

/** Albaranes: generación, unificación, precios, numeración, PDF y firma. */

test.beforeEach(sesionLimpia);

test('el circuito completo: trabajo enviado, albarán y firma', async ({ page }) => {
  // El 409 lo provoca la propia prueba al intentar borrar un trabajo que ya
  // tiene albarán: es el comportamiento que se está comprobando.
  const errores = vigilarErrores(page, [409]);
  await entrar(page, CUENTAS.jefe);

  const { cliente, dni, trabajador, material } = await crearMaestrosDePrueba(page, 'circuito ' + Date.now());

  // 1. Trabajo completo desde el principio
  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué se ha hecho').fill('Barandilla de prueba');
  await primerMaterial(page, material, '12,5');
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
  // El DNI ya no se pide: es del cliente.
  await expect(page.getByLabel('DNI del cliente')).toHaveCount(0);
  await page.getByRole('button', { name: 'Generar', exact: true }).click();

  await expect(page).toHaveURL(/\/albaranes\/\d+$/, { timeout: 15_000 });
  const urlAlbaran = page.url();
  // Los datos se copian del trabajo en el servidor, y el DNI sale del cliente.
  await expect(page.getByText(cliente).first()).toBeVisible();
  await expect(page.getByText(dni)).toBeVisible();

  // Corregir el DNI en Ajustes lo corrige también en el albarán ya hecho.
  const dniCorregido = dniDePrueba();
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByLabel(`Editar ${cliente}`).click();
  await page.locator('input[name^="editar-dni-"]').fill(dniCorregido);
  await page.getByLabel('Guardar el cliente').click();
  await expect(page.getByText(dniCorregido, { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.goto(urlAlbaran);
  await expect(page.getByText(dniCorregido)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(dni)).toHaveCount(0);
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

test('dos trabajos de un cliente se unifican en un albarán con su precio', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador, material } = await crearMaestrosDePrueba(page, 'unificar ' + Date.now());

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
    await primerMaterial(page, material, visita.cantidad);
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
  await elegir(page, 'Filtrar por cliente', cliente);

  // Marcar los dos y generar el albarán unificado.
  const casillas = page.locator('mat-checkbox input[type="checkbox"]');
  await expect(casillas).toHaveCount(2, { timeout: 15_000 });
  await casillas.nth(0).check();
  await casillas.nth(1).check();
  await expect(page.getByText('2 trabajos seleccionados')).toBeVisible();

  await page.getByRole('button', { name: 'Generar albarán' }).click();
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

  const { cliente, trabajador, material } = await crearMaestrosDePrueba(page, 'pdf ' + Date.now());

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
  await primerMaterial(page, material, '12,5');
  await page.getByLabel('Horas').fill('3,5');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page).toHaveURL(/\/trabajos\/\d+$/, { timeout: 15_000 });

  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar', exact: true }).last().click();
  await expect(page.getByText(/Enviado el/)).toBeVisible({ timeout: 15_000 });

  await descargarPdf(page, 'Descargar PDF del trabajo', /^trabajo-\d+\.pdf$/);

  // 3. Albarán, que es el documento que de verdad se imprime
  await page.getByRole('button', { name: 'Generar albarán' }).click();
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

test('un albarán admite varios trabajadores', async ({ page }) => {
  const errores = vigilarErrores(page);
  await entrar(page, CUENTAS.jefe);

  const { cliente, trabajador, material } = await crearMaestrosDePrueba(page, 'equipo ' + Date.now());

  // Un segundo trabajador, para poder añadirlo al albarán después.
  const segundo = `PRUEBA-HUMO Segundo ${Date.now()}`;
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await anadirEnAjustes(page, 'Añadir trabajador', segundo);

  await page.getByRole('link', { name: 'Trabajos' }).click();
  await page.getByRole('link', { name: 'Nuevo trabajo' }).click();
  await elegir(page, 'Cliente', cliente);
  await elegir(page, 'Trabajador', trabajador);
  await page.getByLabel('Qué se ha hecho').fill('Trabajo de un solo trabajador');
  await primerMaterial(page, material, '2');
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

