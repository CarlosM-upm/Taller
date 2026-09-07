import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SrcSeguro } from './src-seguro';

/** Ve una foto a tamaño completo. Se cierra tocando en cualquier sitio. */
@Component({
  selector: 'app-visor-foto',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, SrcSeguro],
  template: `
    <div class="visor" (click)="cerrar()">
      <button matIconButton class="cerrar" aria-label="Cerrar">
        <mat-icon>close</mat-icon>
      </button>
      <img [appSrcSeguro]="datos.url" alt="Foto a tamaño completo" />
    </div>
  `,
  styles: `
    .visor {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      cursor: zoom-out;
    }
    img {
      max-width: 96vw;
      max-height: 88vh;
      object-fit: contain;
      display: block;
    }
    .cerrar {
      position: absolute;
      top: 8px;
      right: 8px;
      color: #fff;
      background: rgb(0 0 0 / 45%);
    }
  `,
})
export class VisorFoto {
  private readonly referencia = inject(MatDialogRef<VisorFoto>);
  readonly datos = inject<{ url: string }>(MAT_DIALOG_DATA);

  cerrar(): void {
    this.referencia.close();
  }
}
