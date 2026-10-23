import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface DatosConfirmar {
  titulo: string;
  mensaje: string;
  /** Texto del botón que confirma. Por defecto "Aceptar". */
  aceptar?: string;
  /** true si la acción es destructiva: pinta el botón en rojo. */
  peligroso?: boolean;
}

/**
 * Diálogo de confirmación para acciones que no tienen vuelta atrás.
 *
 * Se usa sobre todo antes de borrar. En una tablet que se maneja de pie y con
 * prisa, un toque accidental sobre "borrar" es fácil, y aquí no hay papelera:
 * lo que se borra en el servidor desaparece.
 */
@Component({
  selector: 'app-dialogo-confirmar',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ datos.titulo }}</h2>
    <mat-dialog-content>
      <p>{{ datos.mensaje }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton (click)="cerrar(false)">Cancelar</button>
      <button
        matButton="filled"
        [class.peligro]="datos.peligroso"
        (click)="cerrar(true)"
      >
        {{ datos.aceptar ?? 'Aceptar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    p { margin: 0; font-size: 1rem; }
    mat-dialog-actions { padding: 16px 24px; gap: 8px; }
    button { min-height: 48px; }
    .peligro {
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
    }
  `,
})
export class DialogoConfirmar {
  private readonly referencia = inject(MatDialogRef<DialogoConfirmar, boolean>);
  readonly datos = inject<DatosConfirmar>(MAT_DIALOG_DATA);

  cerrar(respuesta: boolean): void {
    this.referencia.close(respuesta);
  }
}

/**
 * Abre la confirmación y resuelve true solo si se pulsa el botón de aceptar
 * (cerrar el diálogo o pulsar Cancelar es "no"). Lo usan las fichas antes de
 * enviar o borrar; antes cada una llevaba su propia copia de esto.
 */
export function confirmar(dialogo: MatDialog, datos: DatosConfirmar): Promise<boolean> {
  return new Promise((resolver) => {
    dialogo
      .open(DialogoConfirmar, { data: datos, width: '440px' })
      .afterClosed()
      .subscribe((respuesta) => resolver(respuesta === true));
  });
}
