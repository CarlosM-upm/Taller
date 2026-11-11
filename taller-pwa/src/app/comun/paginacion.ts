import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * "‹ Anterior · 1–15 de 270 · Siguiente ›" debajo de una lista larga.
 *
 * Solo pinta los botones: qué elementos caen en cada página lo calcula la
 * lista, que es la que sabe qué está filtrando. No aparece si todo cabe en
 * una página. La página empieza en 0.
 */
/**
 * Cuántos caben en una página. Uno solo para todas las listas largas (clientes
 * y materiales de Ajustes), para que no se desigualen: se cambia aquí y ya.
 */
export const POR_PAGINA = 15;

@Component({
  selector: 'app-paginacion',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './paginacion.html',
  styleUrl: './paginacion.scss',
})
export class Paginacion {
  /** Para distinguirla de otras en la misma página ("Páginas de clientes"). */
  readonly etiqueta = input('Páginas');
  readonly total = input.required<number>();
  readonly porPagina = input(POR_PAGINA);
  readonly pagina = input(0);
  readonly paginaChange = output<number>();

  readonly desde = computed(() => (this.total() === 0 ? 0 : this.pagina() * this.porPagina() + 1));
  readonly hasta = computed(() => Math.min(this.total(), (this.pagina() + 1) * this.porPagina()));
}
