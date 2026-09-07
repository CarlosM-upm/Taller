import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Trabajo } from '../nucleo/modelos';

type Filtro = 'TODOS' | 'BORRADOR' | 'ENVIADO';

@Component({
  selector: 'app-lista-trabajos',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './lista-trabajos.html',
  styleUrl: './lista-trabajos.scss',
})
export class ListaTrabajos {
  private readonly api = inject(ApiTaller);
  private readonly avisos = inject(Avisos);

  readonly trabajos = signal<Trabajo[]>([]);
  readonly cargando = signal(true);
  readonly fallo = signal<string | null>(null);
  readonly filtro = signal<Filtro>('TODOS');

  /**
   * El filtro se aplica en el cliente, no llamando otra vez al servidor.
   * Son pocos registros y así cambiar de pestaña es instantáneo, sin que la
   * pantalla parpadee cada vez en un wifi lento.
   */
  readonly visibles = computed(() => {
    const filtro = this.filtro();
    const lista = this.trabajos();
    return filtro === 'TODOS' ? lista : lista.filter((t) => t.estado === filtro);
  });

  readonly cuantosBorradores = computed(
    () => this.trabajos().filter((t) => t.estado === 'BORRADOR').length
  );

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);

    this.api.trabajos().subscribe({
      next: (lista) => {
        // Los borradores primero: son los que están a medias y hay que
        // terminar. Dentro de cada grupo, lo más reciente arriba.
        this.trabajos.set(
          [...lista].sort((a, b) => {
            if (a.estado !== b.estado) return a.estado === 'BORRADOR' ? -1 : 1;
            return b.id - a.id;
          })
        );
        this.cargando.set(false);
      },
      error: (fallo) => {
        this.cargando.set(false);
        this.fallo.set(this.avisos.textoDe(fallo, 'No se han podido cargar los trabajos'));
      },
    });
  }
}
