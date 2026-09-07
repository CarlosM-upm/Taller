import { Injectable } from '@angular/core';

/** Lado mayor al que se reduce la foto antes de subirla. */
const LADO_MAXIMO = 1600;
const CALIDAD_JPEG = 0.8;

/** Lo que admite el backend (foto/ValidadorImagen.java). */
const TIPOS_ADMITIDOS = ['image/jpeg', 'image/png'];

/**
 * Prepara las fotos antes de mandarlas al servidor.
 *
 * Dos motivos, los dos importantes en un taller:
 *
 * 1. TAMAÑO. Una foto de tablet pesa entre 4 y 8 MB. Con cinco por trabajo
 *    son 40 MB por wifi de nave industrial, y encima acaban dentro de
 *    PostgreSQL, engordando la copia de seguridad nocturna. Reducida a
 *    1600 px de lado mayor baja a 300-500 KB sin perder detalle útil para
 *    documentar una reja o una puerta.
 *
 * 2. ORIENTACIÓN. Las cámaras no giran la imagen: guardan los píxeles como
 *    salen del sensor y anotan aparte, en los metadatos EXIF, cómo había que
 *    girarla. Si se ignora ese dato, las fotos hechas en vertical se ven
 *    tumbadas. createImageBitmap con imageOrientation 'from-image' aplica el
 *    giro al decodificar, así que lo que se sube ya está derecho y no hace
 *    falta ninguna librería.
 */
@Injectable({ providedIn: 'root' })
export class Fotos {
  /** Reduce y reorienta. Devuelve un JPEG listo para subir. */
  async preparar(fichero: File): Promise<Blob> {
    if (!TIPOS_ADMITIDOS.includes(fichero.type)) {
      throw new Error('Solo se admiten fotos JPEG o PNG');
    }

    const imagen = await createImageBitmap(fichero, { imageOrientation: 'from-image' });

    try {
      const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
      const ancho = Math.round(imagen.width * escala);
      const alto = Math.round(imagen.height * escala);

      const lienzo = document.createElement('canvas');
      lienzo.width = ancho;
      lienzo.height = alto;

      const pincel = lienzo.getContext('2d');
      if (!pincel) throw new Error('El navegador no permite procesar la imagen');
      pincel.drawImage(imagen, 0, 0, ancho, alto);

      return await this.aBlob(lienzo, 'image/jpeg', CALIDAD_JPEG);
    } finally {
      // Sin esto, la memoria de la imagen decodificada no se libera hasta que
      // pase el recolector. Con cinco fotos seguidas en una tablet, se nota.
      imagen.close();
    }
  }

  /** Prepara varias en serie: en paralelo, una tablet modesta se ahoga. */
  async prepararVarias(ficheros: File[]): Promise<Blob[]> {
    const listas: Blob[] = [];
    for (const fichero of ficheros) {
      listas.push(await this.preparar(fichero));
    }
    return listas;
  }

  /** canvas.toBlob es de callback; aquí se envuelve en promesa. */
  private aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad?: number): Promise<Blob> {
    return new Promise((resolver, rechazar) => {
      lienzo.toBlob(
        (blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo generar la imagen'))),
        tipo,
        calidad
      );
    });
  }
}
