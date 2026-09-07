import { Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { VisorFoto } from './visor-foto';
import { SrcSeguro } from './src-seguro';

/**
 * Muestra las fotos que ya están guardadas en el servidor.
 *
 * Recibe los identificadores y una función que sabe construir la URL de cada
 * una, para poder usarla igual con pedidos, trabajos y albaranes sin que el
 * componente sepa nada de ninguno.
 *
 * Las imágenes se cargan con la directiva appSrcSeguro y no con un src normal:
 * un <img src> no manda la cabecera del token y el servidor devolvería 401.
 */
@Component({
  selector: 'app-galeria-fotos',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, SrcSeguro],
  templateUrl: './galeria-fotos.html',
  styleUrl: './galeria-fotos.scss',
})
export class GaleriaFotos {
  private readonly dialogo = inject(MatDialog);

  readonly fotoIds = input.required<number[]>();
  readonly urlDe = input.required<(fotoId: number) => string>();
  readonly puedeBorrar = input(false);
  readonly desactivado = input(false);

  readonly borrar = output<number>();

  ver(fotoId: number): void {
    this.dialogo.open(VisorFoto, {
      data: { url: this.urlDe()(fotoId) },
      maxWidth: '100vw',
      maxHeight: '100vh',
      panelClass: 'visor-panel',
    });
  }
}
