import {
  Directive,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';

/**
 * Carga una imagen protegida de la API en un <img>.
 *
 * Hace falta porque un `<img src="/api/...">` normal **no envía la cabecera
 * Authorization**: el navegador pide la imagen por su cuenta, al margen de
 * HttpClient y de los interceptores. Como toda la API exige token, el servidor
 * respondía 401 y ni las fotos ni las firmas llegaban a verse. Peor aún: ese
 * 401 activaba el interceptor de errores y echaba al usuario al login.
 *
 * Aquí la imagen se pide con HttpClient (que sí pasa por el interceptor y
 * lleva el token), se convierte en una URL de objeto y se le asigna al <img>.
 *
 * La alternativa habría sido dejar abiertas las rutas de imágenes, pero eso
 * expondría las fotos de los clientes a cualquiera que esté en la red del
 * taller.
 *
 * Uso:  <img [appSrcSeguro]="urlDeLaFoto" alt="..." />
 */
@Directive({
  selector: 'img[appSrcSeguro]',
})
export class SrcSeguro implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly elemento = inject<ElementRef<HTMLImageElement>>(ElementRef);

  readonly appSrcSeguro = input.required<string>();

  private urlObjeto: string | null = null;

  constructor() {
    // Dentro de un effect sí se puede leer el input: se ejecuta después de que
    // Angular lo haya asignado, no durante la construcción del componente.
    effect(() => {
      const url = this.appSrcSeguro();
      this.liberar();
      if (!url) return;

      this.http.get(url, { responseType: 'blob' }).subscribe({
        next: (blob) => {
          this.urlObjeto = URL.createObjectURL(blob);
          this.elemento.nativeElement.src = this.urlObjeto;
        },
        error: () => {
          // Se deja el <img> vacío. El aviso del fallo, si procede, lo da la
          // pantalla que lo contiene; una miniatura rota no merece un mensaje.
          this.elemento.nativeElement.removeAttribute('src');
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.liberar();
  }

  /** Sin esto, cada imagen vista se queda en memoria hasta recargar la página. */
  private liberar(): void {
    if (this.urlObjeto) {
      URL.revokeObjectURL(this.urlObjeto);
      this.urlObjeto = null;
    }
  }
}
