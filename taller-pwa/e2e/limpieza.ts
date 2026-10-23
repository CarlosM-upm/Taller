import { APIRequestContext, request as peticionApi } from '@playwright/test';

/**
 * Borra los clientes y trabajadores de prueba al terminar TODAS las pruebas.
 *
 * Es el "globalTeardown" de playwright.config.ts: se ejecuta una sola vez, al
 * final, y no al acabar cada fichero (borraría lo que otro aún usa).
 *
 * Las pruebas los dan de alta porque cliente y trabajador ya no se teclean, se
 * eligen de una lista. Sin esta limpieza se van acumulando ficha tras ficha en
 * la base de datos de desarrollo hasta llenar los desplegables de basura.
 *
 * El borrado falla con 409 si todavía tienen documentos colgando, y eso es
 * justo lo que interesa: significa que una prueba se dejó algo a medias, y se
 * reconoce porque el nombre empieza por PRUEBA-HUMO.
 */
export default async function limpieza() {
  const api = await peticionApi.newContext({ baseURL: 'http://127.0.0.1:8080' });
  try {
    const entrada = await api.post('/api/login', {
      data: { usuario: 'jefe', contrasena: 'jefe123' },
    });
    if (!entrada.ok()) return;
    const { token } = await entrada.json();
    const cabeceras = { Authorization: `Bearer ${token}` };

    // Los materiales antes que sus familias: una familia con materiales no se borra.
    for (const recurso of ['catalogo', 'clientes', 'trabajadores', 'familias-material']) {
      await borrarLasDePrueba(api, recurso, cabeceras);
    }
  } finally {
    await api.dispose();
  }
}

/** Borra las fichas de un recurso cuyo nombre empieza por PRUEBA-HUMO. */
async function borrarLasDePrueba(api: APIRequestContext, recurso: string, cabeceras: Record<string, string>) {
  const respuesta = await api.get(`/api/${recurso}`, { headers: cabeceras });
  if (!respuesta.ok()) return;
  const deUnaPrueba = (await respuesta.json()).filter((ficha: { nombre: unknown }) =>
    String(ficha.nombre).startsWith('PRUEBA-HUMO'),
  );
  for (const ficha of deUnaPrueba) {
    await api.delete(`/api/${recurso}/${ficha.id}`, { headers: cabeceras });
  }
}
