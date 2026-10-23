import { Component, computed, inject, input, model, output, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { Avisos } from '../nucleo/avisos';
import { DialogoConfirmar } from './dialogo-confirmar';
import { GaleriaFotos } from './galeria-fotos';
import { SelectorFotos } from './selector-fotos';

/**
 * La tarjeta de fotos de una ficha: ver, añadir y borrar.
 *
 * La usan las tres fichas (pedido, trabajo y albarán), que antes llevaban cada
 * una su copia de esta lógica. Lo que cambia entre ellas entra por fuera: el
 * máximo (5, o 15 en el albarán), quién puede añadir o borrar, y las dos
 * llamadas a la API, que cada ficha pasa ya preparadas para su documento.
 *
 * "ocupado" es de dos direcciones con la ficha: mientras se suben o borran
 * fotos, la ficha enseña su barra de progreso y bloquea sus otros botones, y al
 * revés, si la ficha está ocupada aquí no se puede tocar nada.
 */
@Component({
  selector: 'app-tarjeta-fotos',
  imports: [MatButtonModule, MatCardModule, GaleriaFotos, SelectorFotos],
  templateUrl: './tarjeta-fotos.html',
  styleUrl: './tarjeta-fotos.scss',
})
export class TarjetaFotos {
  private readonly dialogo = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  private readonly selector = viewChild(SelectorFotos);

  readonly fotoIds = input.required<number[]>();
  readonly maximo = input.required<number>();
  readonly urlDe = input.required<(fotoId: number) => string>();
  /** "pedido", "trabajo" o "albarán": para los textos ("Este pedido no tiene fotos"). */
  readonly documento = input.required<string>();
  readonly puedeAnadir = input(true);
  readonly puedeBorrar = input(false);
  readonly subir = input.required<(fotos: Blob[]) => Observable<number[]>>();
  readonly borrar = input.required<(fotoId: number) => Observable<void>>();

  readonly ocupado = model(false);
  /** La lista nueva de fotos, tras subir o borrar. */
  readonly cambio = output<number[]>();

  readonly fotosNuevas = signal<Blob[]>([]);
  readonly huecos = computed(() => this.maximo() - this.fotoIds().length);

  subirFotos(): void {
    const fotos = this.fotosNuevas();
    if (fotos.length === 0 || this.ocupado()) return;

    this.ocupado.set(true);
    this.subir()(fotos).subscribe({
      next: (fotoIds) => {
        this.cambio.emit(fotoIds);
        this.selector()?.vaciar();
        this.ocupado.set(false);
        this.avisos.correcto('Fotos añadidas');
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.avisos.error(fallo, 'No se han podido subir las fotos');
      },
    });
  }

  borrarFoto(fotoId: number): void {
    if (this.ocupado()) return;

    this.dialogo
      .open(DialogoConfirmar, {
        data: {
          titulo: 'Borrar la foto',
          mensaje: `Esta foto se borrará del ${this.documento()} y no se puede recuperar.`,
          aceptar: 'Borrar',
          peligroso: true,
        },
        width: '440px',
      })
      .afterClosed()
      .subscribe((seguro) => {
        if (seguro === true) this.borrarConfirmada(fotoId);
      });
  }

  private borrarConfirmada(fotoId: number): void {
    this.ocupado.set(true);
    this.borrar()(fotoId).subscribe({
      next: () => {
        this.cambio.emit(this.fotoIds().filter((f) => f !== fotoId));
        this.ocupado.set(false);
        this.avisos.correcto('Foto borrada');
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.avisos.error(fallo, 'No se ha podido borrar la foto');
      },
    });
  }
}
