import { Injectable, computed, signal } from '@angular/core';
import { Rol } from './modelos';

const CLAVE_TOKEN = 'taller.token';
const CLAVE_ROL = 'taller.rol';

/**
 * Guarda quién ha entrado y con qué token.
 *
 * Se usa localStorage y no memoria porque en el taller la tablet se bloquea,
 * se recarga la página o se cierra la pestaña constantemente, y volver a
 * teclear la contraseña cada vez sería insufrible. El backend acompaña esa
 * decisión: el token vive en base de datos y no caduca, así que sigue siendo
 * válido incluso después de apagar el servidor por la noche.
 *
 * La sesión solo termina con el botón de salir, que además la invalida en el
 * servidor.
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly _token = signal<string | null>(localStorage.getItem(CLAVE_TOKEN));
  private readonly _rol = signal<Rol | null>(localStorage.getItem(CLAVE_ROL) as Rol | null);

  readonly token = this._token.asReadonly();
  readonly rol = this._rol.asReadonly();

  readonly haEntrado = computed(() => this._token() !== null);
  readonly esJefe = computed(() => this._rol() === 'JEFE');

  /** Nombre legible del rol, para la barra superior. */
  readonly nombreRol = computed(() => (this._rol() === 'JEFE' ? 'Jefe' : 'Taller'));

  entrar(token: string, rol: Rol): void {
    localStorage.setItem(CLAVE_TOKEN, token);
    localStorage.setItem(CLAVE_ROL, rol);
    this._token.set(token);
    this._rol.set(rol);
  }

  /** Borra la sesión local. La invalidación en el servidor la hace ApiTaller. */
  limpiar(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_ROL);
    this._token.set(null);
    this._rol.set(null);
  }
}
