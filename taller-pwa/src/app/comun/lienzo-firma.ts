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
 * - El tamaño se toma de `clientWidth`/`clientHeight`, NO de
 *   getBoundingClientRect: el diálogo se abre creciendo desde el 80% y el
 *   lienzo se prepara justo entonces, así que la caja medía el 80% y el dibujo
 *   salía estirado (hasta 111px desviado abajo a la derecha). Además la caja
 *   incluye el borde de 2px, que no es zona de dibujo. Por lo mismo, el punto
 *   del puntero descuenta la escala y el borde.
 *
 * - Nada debajo del recuadro que aparezca o desaparezca al firmar: el diálogo
 *   está centrado y, al cambiar de alto, el recuadro se movía bajo el dedo.
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
    // Sin borde y sin la animación de apertura del diálogo (ver arriba).
    const ancho = lienzo.clientWidth;
    const alto = lienzo.clientHeight;
    if (ancho === 0 || alto === 0) return;

    const densidad = window.devicePixelRatio || 1;
    lienzo.width = Math.round(ancho * densidad);
    lienzo.height = Math.round(alto * densidad);

    const pincel = lienzo.getContext('2d');
    if (!pincel) return;

    pincel.scale(densidad, densidad);
    // Fondo blanco: sin esto el PNG sale con fondo transparente y la firma
    // resulta invisible al imprimirla o al verla sobre fondo oscuro.
    pincel.fillStyle = '#ffffff';
    pincel.fillRect(0, 0, ancho, alto);

    pincel.strokeStyle = '#111111';
    pincel.lineWidth = 2.5;
    pincel.lineCap = 'round';
    pincel.lineJoin = 'round';

    this.pincel = pincel;
    this.hayTrazo.set(false);
  }

  /**
   * Del puntero en la pantalla al punto dentro de la zona de dibujo. Si el
   * diálogo aún está creciendo, la caja en pantalla es más pequeña que la real:
   * se corrige con la escala, y se descuenta el borde.
   */
  private puntoDe(evento: PointerEvent): { x: number; y: number } {
    const lienzo = this.lienzoRef().nativeElement;
    const caja = lienzo.getBoundingClientRect();
    const escalaX = caja.width / (lienzo.offsetWidth || caja.width);
    const escalaY = caja.height / (lienzo.offsetHeight || caja.height);
    return {
      x: (evento.clientX - caja.left) / escalaX - lienzo.clientLeft,
      y: (evento.clientY - caja.top) / escalaY - lienzo.clientTop,
    };
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
