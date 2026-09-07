import { Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { VisorFoto } from './visor-foto';

/**
 * Muestra las fotos que ya están guardadas en el servidor.
 *
 * Recibe los identificadores y una función que sabe construir la URL de cada
 * una, para poder usarla igual con pedidos, trabajos y albaranes sin que el
 * componente sepa nada de ninguno.
 *
 * Las imágenes se piden con <img src>, así que el token no viaja en la
 * cabecera. Funciona porque el navegador manda la petición al mismo origen y
 * el backend deja abierta la lectura de fotos a cualquiera que haya entrado.
 */
@Component({
  selector: 'app-galeria-fotos',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
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
