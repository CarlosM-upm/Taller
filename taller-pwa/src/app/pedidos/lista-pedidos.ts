import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Pedido } from '../nucleo/modelos';

@Component({
  selector: 'app-lista-pedidos',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './lista-pedidos.html',
  styleUrl: './lista-pedidos.scss',
})
export class ListaPedidos {
  private readonly api = inject(ApiTaller);
  private readonly avisos = inject(Avisos);

  readonly pedidos = signal<Pedido[]>([]);
  readonly cargando = signal(true);
  readonly fallo = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);

    this.api.pedidos().subscribe({
      next: (lista) => {
        // El backend todavía no ordena; lo último que ha entrado es lo que
        // interesa ver primero en el taller.
        this.pedidos.set([...lista].sort((a, b) => b.id - a.id));
        this.cargando.set(false);
      },
      error: (fallo) => {
        this.cargando.set(false);
        this.fallo.set(this.avisos.textoDe(fallo, 'No se han podido cargar los pedidos'));
      },
    });
  }
}
