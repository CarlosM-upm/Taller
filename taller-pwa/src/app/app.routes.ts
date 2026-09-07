import { Routes } from '@angular/router';
import { guardiaEntrado, guardiaJefe, guardiaNoEntrado } from './nucleo/guardias';

/**
 * Todas las pantallas se cargan con loadComponent (carga diferida): la tablet
 * solo descarga lo que abre, y el equipo del jefe no arrastra lo suyo hasta
 * que entra en albaranes.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guardiaNoEntrado],
    loadComponent: () => import('./sesion/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [guardiaEntrado],
    loadComponent: () => import('./armazon/armazon').then((m) => m.Armazon),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pedidos' },
      {
        path: 'pedidos',
        loadComponent: () => import('./pedidos/lista-pedidos').then((m) => m.ListaPedidos),
      },
      {
        path: 'trabajos',
        loadComponent: () => import('./trabajos/lista-trabajos').then((m) => m.ListaTrabajos),
      },
      {
        path: 'albaranes',
        canActivate: [guardiaJefe],
        loadComponent: () => import('./albaranes/lista-albaranes').then((m) => m.ListaAlbaranes),
      },
      {
        path: 'configuracion',
        canActivate: [guardiaJefe],
        loadComponent: () => import('./configuracion/configuracion').then((m) => m.Configuracion),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
