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
 * En un FORMULARIO no ofrece opción de vaciar. La tuvo ("(sin asignar)") y era
 * mentira: el PATCH interpreta un id nulo como "no toques este campo", así que
 * elegirla no vaciaba nada. Para cambiar de cliente, se elige otro.
 *
 * En un FILTRO sí hace falta, y significa otra cosa: "todos". Para eso está
 * opcionTodos, que solo debe usarse en filtros. Sin ella, una vez elegido un
 * cliente en el listado no había forma de volver a ver los de todos.
 */
@Component({
  selector: 'app-selector-maestro',
  imports: [MatFormFieldModule, MatSelectModule],
  template: `
    <mat-form-field appearance="outline">
      <mat-label>{{ etiqueta() }}</mat-label>
      <mat-select [(value)]="valor" [disabled]="deshabilitado()">
        @if (opcionTodos(); as todos) {
          <mat-option [value]="null">{{ todos }}</mat-option>
        }
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
  /** SOLO en filtros: una primera opción que deja el valor a nulo = "todos". */
  readonly opcionTodos = input<string | null>(null);

  /** Dos direcciones: el padre escribe el valor inicial y recibe los cambios. */
  readonly valor = model<number | null>(null);
}
