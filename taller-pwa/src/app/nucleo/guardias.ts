import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Sesion } from './sesion';

/** Exige haber entrado. Si no, al login, recordando a dónde iba. */
export const guardiaEntrado: CanActivateFn = (_ruta, estado) => {
  const sesion = inject(Sesion);
  const router = inject(Router);

  if (sesion.haEntrado()) return true;

  return router.createUrlTree(['/login'], {
    queryParams: { volverA: estado.url },
  });
};

/**
 * Exige rol JEFE.
 *
 * Ojo: esto NO es seguridad, es comodidad. Solo evita enseñar pantallas que
 * el trabajador no puede usar. Quien manda es el backend, que responde 403
 * aunque alguien manipule el navegador. Nunca muevas una regla de permisos
 * aquí y la quites de SecurityConfig.
 */
export const guardiaJefe: CanActivateFn = (_ruta, estado) => {
  const sesion = inject(Sesion);
  const router = inject(Router);

  if (!sesion.haEntrado()) {
    return router.createUrlTree(['/login'], {
      queryParams: { volverA: estado.url },
    });
  }

  return sesion.esJefe() ? true : router.createUrlTree(['/pedidos']);
};

/** Si ya ha entrado, la pantalla de login no tiene sentido. */
export const guardiaNoEntrado: CanActivateFn = () => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  return sesion.haEntrado() ? router.createUrlTree(['/pedidos']) : true;
};
