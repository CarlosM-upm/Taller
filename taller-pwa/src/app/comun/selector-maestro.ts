import { Component, input, model } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

/** Lo mínimo que necesita el selector: vale para clientes y para trabajadores. */
export interface OpcionMaestra {
  id: number;
  nombre: string;
}

/**
 * Desplegable para elegir un cliente o un trabajador.
 *
 * Sustituye a los campos de texto que se tecleaban a mano, que era de donde
 * salía el mismo cliente escrito de tres formas distintas.
 *
 * No ofrece una opción de "(sin asignar)". La tuvo, y era mentira: el PATCH
 * interpreta un id nulo como "no toques este campo", así que elegirla no
 * vaciaba nada y el usuario se quedaba creyendo que sí. Mientras no se ha
 * elegido nada el desplegable ya sale vacío, que es el mismo estado; para
 * cambiar de cliente, se elige otro.
 */
@Component({
  selector: 'app-selector-maestro',
  imports: [MatFormFieldModule, MatSelectModule],
  template: `
    <mat-form-field appearance="outline">
      <mat-label>{{ etiqueta() }}</mat-label>
      <mat-select [(value)]="valor" [disabled]="deshabilitado()">
        @for (opcion of opciones(); track opcion.id) {
          <mat-option [value]="opcion.id">{{ opcion.nombre }}</mat-option>
        }
      </mat-select>
      @if (opciones().length === 0) {
        <mat-hint>No hay ninguno dado de alta. Se añaden en Ajustes.</mat-hint>
      }
    </mat-form-field>
  `,
  styles: `
    mat-form-field { width: 100%; }
  `,
})
export class SelectorMaestro {
  readonly etiqueta = input.required<string>();
  readonly opciones = input.required<OpcionMaestra[]>();
  readonly deshabilitado = input(false);

  /** Dos direcciones: el padre escribe el valor inicial y recibe los cambios. */
  readonly valor = model<number | null>(null);
}
