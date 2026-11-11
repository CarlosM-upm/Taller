import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Lo que se ve cuando una lista está vacía: un icono, qué pasa y, si tiene
 * sentido, el botón para empezar (va dentro, como contenido).
 *
 * Sobre todo para el primer día en la tablet: una frase suelta en gris no
 * dice qué hacer; un botón de "Nuevo trabajo" sí.
 */
@Component({
  selector: 'app-estado-vacio',
  imports: [MatIconModule],
  templateUrl: './estado-vacio.html',
  styleUrl: './estado-vacio.scss',
})
export class EstadoVacio {
  readonly icono = input.required<string>();
  readonly titulo = input.required<string>();
  readonly texto = input<string | null>(null);
}
