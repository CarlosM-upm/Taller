import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Avisos } from './avisos';

/**
 * Descarga un fichero protegido de la API (los PDF de los documentos).
 *
 * Es el mismo problema que resuelve la directiva appSrcSeguro con las
 * imágenes: un enlace normal <a href="/api/..."> o un window.open los pide el
 * navegador por su cuenta, sin pasar por HttpClient, así que **no lleva la
 * cabecera Authorization** y el servidor responde 401. Encima ese 401 activa
 * el interceptor de errores y echa al usuario al login, que es lo último que
 * uno espera al pulsar "Descargar PDF".
 *
 * Aquí el fichero se pide con HttpClient (que sí pone el token), y luego se
 * guarda con un enlace temporal que apunta a una URL de objeto en memoria.
 */
@Injectable({ providedIn: 'root' })
export class Descargas {
  private readonly http = inject(HttpClient);
  private readonly avisos = inject(Avisos);

  /**
   * Pide el fichero y lo guarda con ese nombre.
   * Devuelve una promesa para que la pantalla pueda apagar su indicador de
   * ocupado cuando termine, salga bien o mal.
   */
  descargar(url: string, nombre: string, mensajeDeFallo: string): Promise<void> {
    return new Promise((terminar) => {
      this.http.get(url, { responseType: 'blob' }).subscribe({
        next: (fichero) => {
          this.guardar(fichero, nombre);
          terminar();
        },
        error: (fallo) => {
          // El cuerpo del error viene como Blob (lo pedimos así), de modo que
          // el mensaje del servidor no se puede leer sin más: se avisa con un
          // texto propio. Avisos sí distingue el "sin conexión" (status 0),
          // que es el caso que de verdad pasa en el taller.
          this.avisos.error(fallo, mensajeDeFallo);
          terminar();
        },
      });
    });
  }

  private guardar(fichero: Blob, nombre: string): void {
    const url = URL.createObjectURL(fichero);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();

    // No se libera en el acto: el navegador todavía está leyendo la URL para
    // escribir el fichero y revocarla ahí deja la descarga a medias.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
