import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { EstadoConexion } from '../nucleo/borrador-local';
import { Sesion } from '../nucleo/sesion';

interface Apartado {
  ruta: string;
  texto: string;
  icono: string;
  soloJefe: boolean;
}

@Component({
  selector: 'app-armazon',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
  ],
  templateUrl: './armazon.html',
  styleUrl: './armazon.scss',
})
export class Armazon {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);
  readonly sesion = inject(Sesion);
  readonly conexion = inject(EstadoConexion);

  /**
   * La navegación va abajo, no arriba: en una tablet que se sujeta con las
   * dos manos, la parte inferior es lo que alcanza el pulgar.
   */
  private readonly todos: Apartado[] = [
    { ruta: '/pedidos', texto: 'Pedidos', icono: 'assignment', soloJefe: false },
    { ruta: '/trabajos', texto: 'Trabajos', icono: 'build', soloJefe: false },
    { ruta: '/albaranes', texto: 'Albaranes', icono: 'receipt_long', soloJefe: true },
    { ruta: '/configuracion', texto: 'Ajustes', icono: 'settings', soloJefe: true },
  ];

  apartados(): Apartado[] {
    return this.todos.filter((a) => !a.soloJefe || this.sesion.esJefe());
  }

  salir(): void {
    // Se limpia la sesión local pase lo que pase: si el servidor está apagado
    // la llamada fallará, pero el usuario ha pedido salir y debe salir.
    this.api.salir().subscribe({
      next: () => this.terminarSesion(),
      error: () => this.terminarSesion(),
    });
  }

  private terminarSesion(): void {
    this.sesion.limpiar();
    this.router.navigateByUrl('/login');
    this.avisos.correcto('Sesión cerrada');
  }
}
