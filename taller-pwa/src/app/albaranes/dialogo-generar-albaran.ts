import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AlbaranNuevo } from '../nucleo/modelos';

/**
 * Pide los dos datos que el albarán NO hereda del trabajo.
 *
 * La fecha, porque aquí la elige el jefe (no es automática como en el pedido),
 * y el DNI del cliente, que solo existe en el albarán y se teclea a mano.
 * Todo lo demás —cliente, trabajador, descripción y fotos— se copia del
 * trabajo en el servidor.
 */
@Component({
  selector: 'app-dialogo-generar-albaran',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Generar albarán</h2>
    <mat-dialog-content>
      <p class="explicacion">
        El cliente, el trabajador, la descripción y las fotos se copian del
        trabajo. Solo faltan estos dos datos.
      </p>

      <mat-form-field appearance="outline">
        <mat-label>Fecha del albarán</mat-label>
        <input matInput name="fecha" type="date" [ngModel]="fecha()" (ngModelChange)="fecha.set($event)" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>DNI del cliente</mat-label>
        <input matInput name="dni" [ngModel]="dni()" (ngModelChange)="dni.set($event)" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton (click)="cancelar()">Cancelar</button>
      <button matButton="filled" (click)="generar()">Generar</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content { display: flex; flex-direction: column; gap: 4px; }
    .explicacion { margin: 0 0 12px; color: var(--mat-sys-on-surface-variant); font-size: 0.9rem; }
    mat-form-field { width: 100%; }
    mat-dialog-actions { padding: 16px 24px; gap: 8px; }
    button { min-height: 48px; }
  `,
})
export class DialogoGenerarAlbaran {
  private readonly referencia = inject(MatDialogRef<DialogoGenerarAlbaran, AlbaranNuevo | null>);

  /** Por defecto hoy, en el formato que espera <input type="date"> y la API. */
  readonly fecha = signal(new Date().toISOString().slice(0, 10));
  readonly dni = signal('');

  generar(): void {
    this.referencia.close({
      fecha: this.fecha() || null,
      dniCliente: this.dni().trim() || null,
    });
  }

  cancelar(): void {
    this.referencia.close(null);
  }
}
