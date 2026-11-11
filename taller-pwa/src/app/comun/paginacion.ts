import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * "‹ Anterior · 1–20 de 270 · Siguiente ›" debajo de una lista larga.
 *
 * Solo pinta los botones: qué elementos caen en cada página lo calcula la
 * lista, que es la que sabe qué está filtrando. No aparece si todo cabe en
 * una página. La página empieza en 0.
 */
@Component({
  selector: 'app-paginacion',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './paginacion.html',
  styleUrl: './paginacion.scss',
})
export class Paginacion {
  readonly total = input.required<number>();
  readonly porPagina = input(20);
  readonly pagina = input(0);
  readonly paginaChange = output<number>();

  readonly desde = computed(() => (this.total() === 0 ? 0 : this.pagina() * this.porPagina() + 1));
  readonly hasta = computed(() => Math.min(this.total(), (this.pagina() + 1) * this.porPagina()));
}
