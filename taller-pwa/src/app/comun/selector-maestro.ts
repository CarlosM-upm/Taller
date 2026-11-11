import { Component, input, model } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

/** Lo mínimo que necesita el selector. */
export interface OpcionMaestra {
  id: number;
  nombre: string;
}

/**
 * Desplegable para elegir un trabajador. Son dos o tres: deslizar basta. Los
 * clientes, que son cientos, se eligen con SelectorCliente (buscar o desplegar).
 *
 * No ofrece opción de vaciar. La tuvo ("(sin asignar)") y era mentira: el PATCH
 * interpreta un id nulo como "no toques este campo", así que elegirla no
 * vaciaba nada. Para cambiar de trabajador, se elige otro.
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
