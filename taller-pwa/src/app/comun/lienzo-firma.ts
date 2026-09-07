import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

/**
 * Lienzo para que el cliente firme con el dedo.
 *
 * Detalles que parecen menores y no lo son:
 *
 * - Eventos de PUNTERO (pointerdown/move/up), no de ratón ni de táctil por
 *   separado. Un solo juego de eventos cubre dedo, lápiz y ratón, así que la
 *   firma se puede probar en el portátil y funciona igual en la tablet.
 *
 * - `touch-action: none` en el CSS. Sin eso, arrastrar el dedo por el lienzo
 *   hace scroll en la página en lugar de dibujar, y la firma no sale.
 *
 * - El lienzo se dimensiona según devicePixelRatio. Si se deja al tamaño CSS,
 *   en la pantalla de una tablet el trazo se ve borroso y dentado.
 *
 * - `setPointerCapture`: si el dedo se sale del recuadro a mitad del trazo, el
 *   dibujo continúa en vez de cortarse de golpe.
 *
 * Se exporta a PNG, que es uno de los dos formatos que admite el servidor.
 */
@Component({
  selector: 'app-lienzo-firma',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './lienzo-firma.html',
  styleUrl: './lienzo-firma.scss',
})
export class LienzoFirma implements AfterViewInit, OnDestroy {
  private readonly referencia = inject(MatDialogRef<LienzoFirma, Blob | null>);
  private readonly lienzoRef = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');

  private pincel: CanvasRenderingContext2D | null = null;
  private dibujando = false;
  private observador: ResizeObserver | null = null;

  readonly hayTrazo = signal(false);

  ngAfterViewInit(): void {
    this.preparar();
    // Si cambia el tamaño (girar la tablet, por ejemplo) hay que rehacer el
    // lienzo. Se pierde lo dibujado, pero es preferible a que quede deformado.
    this.observador = new ResizeObserver(() => this.preparar());
    this.observador.observe(this.lienzoRef().nativeElement);
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }

  private preparar(): void {
    const lienzo = this.lienzoRef().nativeElement;
    const caja = lienzo.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) return;

    const densidad = window.devicePixelRatio || 1;
    lienzo.width = Math.round(caja.width * densidad);
    lienzo.height = Math.round(caja.height * densidad);

    const pincel = lienzo.getContext('2d');
    if (!pincel) return;

    pincel.scale(densidad, densidad);
    // Fondo blanco: sin esto el PNG sale con fondo transparente y la firma
    // resulta invisible al imprimirla o al verla sobre fondo oscuro.
    pincel.fillStyle = '#ffffff';
    pincel.fillRect(0, 0, caja.width, caja.height);

    pincel.strokeStyle = '#111111';
    pincel.lineWidth = 2.5;
    pincel.lineCap = 'round';
    pincel.lineJoin = 'round';

    this.pincel = pincel;
    this.hayTrazo.set(false);
  }

  private puntoDe(evento: PointerEvent): { x: number; y: number } {
    const caja = this.lienzoRef().nativeElement.getBoundingClientRect();
    return { x: evento.clientX - caja.left, y: evento.clientY - caja.top };
  }

  empezar(evento: PointerEvent): void {
    if (!this.pincel) return;
    evento.preventDefault();
    this.lienzoRef().nativeElement.setPointerCapture(evento.pointerId);

    const punto = this.puntoDe(evento);
    this.pincel.beginPath();
    this.pincel.moveTo(punto.x, punto.y);
    this.dibujando = true;
    this.hayTrazo.set(true);
  }

  mover(evento: PointerEvent): void {
    if (!this.dibujando || !this.pincel) return;
    evento.preventDefault();
    const punto = this.puntoDe(evento);
    this.pincel.lineTo(punto.x, punto.y);
    this.pincel.stroke();
  }

  terminar(evento: PointerEvent): void {
    if (!this.dibujando) return;
    this.dibujando = false;
    this.lienzoRef().nativeElement.releasePointerCapture(evento.pointerId);
  }

  limpiar(): void {
    this.preparar();
  }

  guardar(): void {
    if (!this.hayTrazo()) return;
    this.lienzoRef().nativeElement.toBlob(
      (blob) => this.referencia.close(blob ?? null),
      'image/png'
    );
  }

  cancelar(): void {
    this.referencia.close(null);
  }
}
