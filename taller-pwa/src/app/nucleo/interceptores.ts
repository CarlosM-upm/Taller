import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Sesion } from './sesion';

/**
 * Añade el token a cada llamada a la API.
 *
 * No se toca /api/login: es la única ruta abierta, y mandar una cabecera
 * Authorization con un token viejo ahí solo confunde.
 */
export const interceptorToken: HttpInterceptorFn = (peticion, siguiente) => {
  const sesion = inject(Sesion);
  const token = sesion.token();

  const esLogin = peticion.url.includes('/api/login');
  if (!token || esLogin) {
    return siguiente(peticion);
  }

  return siguiente(
    peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
  );
};

/**
 * Distingue "no has entrado" de "no tienes permiso".
 *
 * Esta separación existe gracias al arreglo del backend: antes toda petición
 * rechazada devolvía 403 y era imposible saber si había que mandar al usuario
 * al login o simplemente avisarle. Ahora:
 *   401 -> la sesión no vale, fuera al login.
 *   403 -> ha entrado bien, pero eso no es cosa suya. No se le echa.
 */
export const interceptorErrores: HttpInterceptorFn = (peticion, siguiente) => {
  const sesion = inject(Sesion);
  const router = inject(Router);

  return siguiente(peticion).pipe(
    catchError((fallo: HttpErrorResponse) => {
      const esLogin = peticion.url.includes('/api/login');
      if (fallo.status === 401 && !esLogin) {
        sesion.limpiar();
        router.navigate(['/login'], {
          queryParams: { volverA: router.url },
        });
      }
      return throwError(() => fallo);
    })
  );
};
