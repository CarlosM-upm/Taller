import { Injectable, signal } from '@angular/core';

/**
 * Guarda en el navegador lo que se está escribiendo, para no perderlo.
 *
 * El caso real es el del taller: se rellena un pedido de pie junto a la
 * furgoneta, se pulsa guardar y justo entonces el wifi parpadea. Sin esto, el
 * usuario ve un error y su texto ha desaparecido. Con esto, al volver a abrir
 * el formulario está todo como lo dejó.
 *
 * Se usa localStorage y no memoria porque el caso incluye que la tablet se
 * bloquee o se recargue la pestaña.
 *
 * Solo guarda borradores de FORMULARIOS. No cachea datos del servidor: mostrar
 * un listado de ayer como si fuera de hoy haría más daño que avisar de que no
 * hay conexión.
 */
@Injectable({ providedIn: 'root' })
export class BorradorLocal {
  private readonly prefijo = 'taller.borrador.';

  /** Cuántos días se conserva algo que nunca se llegó a enviar. */
  private readonly diasQueDura = 7;

  guardar(clave: string, datos: unknown): void {
    try {
      localStorage.setItem(
        this.prefijo + clave,
        JSON.stringify({ momento: Date.now(), datos })
      );
    } catch {
      // Si el almacenamiento está lleno o bloqueado, no pasa nada grave:
      // simplemente no habrá red de seguridad. No merece molestar al usuario.
    }
  }

  recuperar<T>(clave: string): T | null {
    try {
      const crudo = localStorage.getItem(this.prefijo + clave);
      if (!crudo) return null;

      const { momento, datos } = JSON.parse(crudo) as { momento: number; datos: T };
      const dias = (Date.now() - momento) / (1000 * 60 * 60 * 24);
      if (dias > this.diasQueDura) {
        this.olvidar(clave);
        return null;
      }
      return datos;
    } catch {
      // Un borrador corrupto se descarta sin más.
      this.olvidar(clave);
      return null;
    }
  }

  olvidar(clave: string): void {
    try {
      localStorage.removeItem(this.prefijo + clave);
    } catch {
      /* nada que hacer */
    }
  }
}

/**
 * Estado de la conexión con el servidor del taller.
 *
 * navigator.onLine solo dice si hay red, no si el mini-PC responde: la tablet
 * puede tener wifi perfecto y el servidor estar apagado. Aun así sirve para
 * avisar del caso más habitual, que es alejarse de la nave.
 */
@Injectable({ providedIn: 'root' })
export class EstadoConexion {
  private readonly _hayRed = signal(navigator.onLine);
  readonly hayRed = this._hayRed.asReadonly();

  constructor() {
    window.addEventListener('online', () => this._hayRed.set(true));
    window.addEventListener('offline', () => this._hayRed.set(false));
  }
}
