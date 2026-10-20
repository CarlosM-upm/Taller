import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Maestros } from '../nucleo/maestros';
import { Sesion } from '../nucleo/sesion';
import { Trabajo } from '../nucleo/modelos';
import { SelectorMaestro } from '../comun/selector-maestro';
import { DialogoGenerarAlbaran } from '../albaranes/dialogo-generar-albaran';

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
    MatCheckboxModule,
    SelectorMaestro,
  ],
  templateUrl: './lista-trabajos.html',
  styleUrl: './lista-trabajos.scss',
})
export class ListaTrabajos implements OnInit {
  private readonly api = inject(ApiTaller);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);
  private readonly router = inject(Router);
  readonly sesion = inject(Sesion);
  readonly maestros = inject(Maestros);

  readonly trabajos = signal<Trabajo[]>([]);
  readonly cargando = signal(true);
  readonly fallo = signal<string | null>(null);
  readonly filtro = signal<Filtro>('TODOS');

  /** Filtro por cliente, para poder juntar sus trabajos en un solo albarán. */
  readonly clienteId = signal<number | null>(null);
  readonly seleccionados = signal<Set<number>>(new Set());
  readonly generando = signal(false);

  /**
   * El filtro se aplica en el cliente, no llamando otra vez al servidor.
   * Son pocos registros y así cambiar de pestaña es instantáneo, sin que la
   * pantalla parpadee cada vez en un wifi lento.
   */
  readonly visibles = computed(() => {
    const filtro = this.filtro();
    const cliente = this.clienteId();
    let lista = this.trabajos();
    if (filtro !== 'TODOS') lista = lista.filter((t) => t.estado === filtro);
    if (cliente !== null) lista = lista.filter((t) => t.clienteId === cliente);
    return lista;
  });

  /**
   * Unificar solo tiene sentido con trabajos enviados de UN cliente concreto:
   * son los que pueden ir al mismo albarán. Y solo lo hace el jefe.
   */
  readonly puedeUnificar = computed(
    () => this.sesion.esJefe() && this.filtro() === 'ENVIADO' && this.clienteId() !== null,
  );

  readonly cuantosSeleccionados = computed(() => this.seleccionados().size);

  readonly cuantosBorradores = computed(
    () => this.trabajos().filter((t) => t.estado === 'BORRADOR').length
  );

  constructor() {
    this.cargar();
  }

  ngOnInit(): void {
    this.maestros.asegurarCargados();
  }

  /** Al cambiar de cliente o de pestaña, lo marcado deja de tener sentido. */
  cambiarCliente(id: number | null | undefined): void {
    // Al elegir "Todos los clientes" llega nulo: se quita el filtro y se ven
    // todos los enviados. Sin cliente concreto tampoco se puede unificar.
    this.clienteId.set(id ?? null);
    this.seleccionados.set(new Set());
  }

  cambiarFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
    this.seleccionados.set(new Set());
  }

  estaSeleccionado(id: number): boolean {
    return this.seleccionados().has(id);
  }

  alternar(trabajo: Trabajo): void {
    if (trabajo.enAlbaran) return;
    this.seleccionados.update((previos) => {
      const copia = new Set(previos);
      if (copia.has(trabajo.id)) copia.delete(trabajo.id);
      else copia.add(trabajo.id);
      return copia;
    });
  }

  /**
   * Un albarán con los trabajos marcados. El servidor hace la unificación:
   * concatena descripciones, suma horas y agrupa materiales.
   */
  generarAlbaranUnificado(): void {
    const ids = [...this.seleccionados()];
    if (ids.length === 0 || this.generando()) return;

    this.dialogo
      .open(DialogoGenerarAlbaran)
      .afterClosed()
      .subscribe((datos) => {
        if (!datos) return;
        this.generando.set(true);
        this.api.crearAlbaranUnificado({ ...datos, trabajoIds: ids }).subscribe({
          next: (albaran) => {
            this.generando.set(false);
            this.seleccionados.set(new Set());
            this.avisos.correcto(`Albarán nº ${albaran.numero} generado con ${ids.length} trabajos`);
            this.router.navigate(['/albaranes', albaran.id]);
          },
          error: (fallo) => {
            this.generando.set(false);
            this.avisos.error(fallo, 'No se ha podido generar el albarán');
          },
        });
      });
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
