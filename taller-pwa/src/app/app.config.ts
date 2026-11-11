import { ApplicationConfig, LOCALE_ID, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import { routes } from './app.routes';
import { interceptorErrores, interceptorToken } from './nucleo/interceptores';

// Los números como se escriben aquí: "13,00 €", "6,5 h", "1.250,00 €". Lo usan
// los pipes number y date de todas las plantillas.
registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'es' },
    // El texto de los botones que solo llevan icono, al pasar el ratón por encima
    // (en el ordenador). En la tablet no aparece: no hay "encima" sin pulsar.
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: { showDelay: 400, hideDelay: 0, touchendHideDelay: 0, touchGestures: 'off' },
    },
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: los parámetros de la ruta (:id) llegan
    // directamente como input() del componente, sin leer el ActivatedRoute.
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([interceptorToken, interceptorErrores])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
