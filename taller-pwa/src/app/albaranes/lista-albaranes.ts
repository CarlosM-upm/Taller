import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Albaran } from '../nucleo/modelos';

/**
 * Listado de albaranes. Solo lo ve el jefe.
 *
 * No hay botón de "nuevo": un albarán nace siempre de un trabajo enviado,
 * nunca desde cero. Se genera desde la ficha del trabajo.
 */
@Component({
  selector: 'app-lista-albaranes',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './lista-albaranes.html',
  styleUrl: './lista-albaranes.scss',
})
export class ListaAlbaranes {
  private readonly api = inject(ApiTaller);
  private readonly avisos = inject(Avisos);

  readonly albaranes = signal<Albaran[]>([]);
  readonly cargando = signal(true);
  readonly fallo = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);

    this.api.albaranes().subscribe({
      next: (lista) => {
        // Por número descendente: el último emitido es el que se busca.
        this.albaranes.set([...lista].sort((a, b) => b.numero - a.numero));
        this.cargando.set(false);
      },
      error: (fallo) => {
        this.cargando.set(false);
        this.fallo.set(this.avisos.textoDe(fallo, 'No se han podido cargar los albaranes'));
      },
    });
  }
}
