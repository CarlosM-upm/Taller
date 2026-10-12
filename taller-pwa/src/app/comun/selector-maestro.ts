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
 * Deja elegir "(ninguno)" solo si se le pide: en un pedido el cliente es
 * obligatorio, pero en un borrador de trabajo puede faltar todavía.
 */
@Component({
  selector: 'app-selector-maestro',
  imports: [MatFormFieldModule, MatSelectModule],
  template: `
    <mat-form-field appearance="outline">
      <mat-label>{{ etiqueta() }}</mat-label>
      <mat-select [(value)]="valor" [disabled]="deshabilitado()">
        @if (admiteVacio()) {
          <mat-option [value]="null">(sin asignar)</mat-option>
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
  readonly admiteVacio = input(false);

  /** Dos direcciones: el padre escribe el valor inicial y recibe los cambios. */
  readonly valor = model<number | null>(null);
}
