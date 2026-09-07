import { defineConfig, devices } from '@playwright/test';

/**
 * Comprobación de humo en un navegador de verdad.
 *
 * Existe por un motivo concreto: las tres primeras pantallas se dieron por
 * buenas con decenas de comprobaciones contra la API con curl, y aun así
 * tenían un fallo que las fichas de detalle no llegaban a pintarse. Probar la
 * API no es probar la aplicación. Esto abre la aplicación como lo haría una
 * persona y falla si algo revienta.
 *
 * Usa el Chrome que ya está instalado (channel: 'chrome') en lugar de
 * descargar los navegadores propios de Playwright, que ocupan unos 300 MB.
 *
 * NECESITA LA API EN MARCHA en el 8080. El servidor de la PWA lo levanta
 * este fichero, reutilizándolo si ya estaba abierto.
 */
export default defineConfig({
  testDir: './e2e',
  // Sin paralelismo: las pruebas crean y borran datos en la MISMA base de
  // datos del taller. En paralelo se pisarían entre ellas.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:4200',
    // Ojo: localhost y no 127.0.0.1. El servidor de Angular escucha solo en
    // IPv6 y con 127.0.0.1 no responde.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
