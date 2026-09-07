import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RespuestaError } from './modelos';

/**
 * Traduce cualquier fallo a una frase que un herrero pueda entender, y la
 * muestra abajo.
 *
 * El backend ya devuelve el motivo en castellano dentro de "mensaje" (y el
 * detalle por campo en "campos"), así que casi siempre basta con enseñarlo.
 * Los casos que no traen cuerpo son los interesantes: status 0 es "no hay red
 * o el servidor está apagado", que en un taller pasa de verdad.
 */
@Injectable({ providedIn: 'root' })
export class Avisos {
  private readonly barra = inject(MatSnackBar);

  correcto(texto: string): void {
    this.barra.open(texto, 'Vale', { duration: 3000 });
  }

  error(fallo: unknown, porDefecto = 'No se ha podido completar la operación'): void {
    this.barra.open(this.textoDe(fallo, porDefecto), 'Vale', { duration: 6000 });
  }

  /** Extrae el mensaje legible de un fallo HTTP. */
  textoDe(fallo: unknown, porDefecto = 'No se ha podido completar la operación'): string {
    if (!(fallo instanceof HttpErrorResponse)) {
      return porDefecto;
    }

    // status 0: la petición no llegó a salir. Servidor apagado, wifi caído,
    // o el mini-PC todavía arrancando por la mañana.
    if (fallo.status === 0) {
      return 'Sin conexión con el servidor del taller. Comprueba el wifi e inténtalo otra vez.';
    }

    const cuerpo = fallo.error as RespuestaError | null;

    if (cuerpo?.campos && Object.keys(cuerpo.campos).length > 0) {
      const detalle = Object.entries(cuerpo.campos)
        .map(([campo, motivo]) => `${campo}: ${motivo}`)
        .join('; ');
      return `${cuerpo.mensaje} (${detalle})`;
    }

    if (cuerpo?.mensaje) {
      return cuerpo.mensaje;
    }

    return porDefecto;
  }

  /** Errores por campo, para pintarlos bajo cada input del formulario. */
  camposDe(fallo: unknown): Record<string, string> {
    if (fallo instanceof HttpErrorResponse) {
      const cuerpo = fallo.error as RespuestaError | null;
      if (cuerpo?.campos) return cuerpo.campos;
    }
    return {};
  }
}
