import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { interceptorErrores, interceptorToken } from './nucleo/interceptores';

export const appConfig: ApplicationConfig = {
  providers: [
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
