import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Sesion } from '../nucleo/sesion';

/**
 * Ajustes del jefe: la numeración de albaranes y su contraseña.
 *
 * Ojo con el cambio de contraseña: el servidor cierra TODAS las sesiones del
 * usuario, incluida esta. Es deliberado (si se cambia la de "tablet" porque se
 * fue un trabajador, los tres tienen que salir), así que al terminar hay que
 * llevar a la pantalla de entrada en vez de dejar la aplicación con un token
 * que ya no vale.
 */
@Component({
  selector: 'app-configuracion',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
})
export class Configuracion {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly sesion = inject(Sesion);
  private readonly avisos = inject(Avisos);

  readonly cargando = signal(true);
  readonly ocupado = signal(false);

  // --- Contador ---
  readonly proximoNumero = signal('');
  readonly numeroGuardado = signal<number | null>(null);
  readonly errorNumero = signal<string | null>(null);

  // --- Contraseña ---
  readonly actual = signal('');
  readonly nueva = signal('');
  readonly repetida = signal('');
  readonly errorContrasena = signal<string | null>(null);

  constructor() {
    this.cargarContador();
  }

  cargarContador(): void {
    this.cargando.set(true);
    this.api.proximoNumeroAlbaran().subscribe({
      next: ({ proximoNumeroAlbaran }) => {
        this.numeroGuardado.set(proximoNumeroAlbaran);
        this.proximoNumero.set(String(proximoNumeroAlbaran));
        this.cargando.set(false);
      },
      error: (fallo) => {
        this.cargando.set(false);
        this.avisos.error(fallo, 'No se ha podido leer el contador');
      },
    });
  }

  guardarContador(): void {
    if (this.ocupado()) return;

    const numero = Number(this.proximoNumero().trim());
    if (!Number.isInteger(numero) || numero < 1) {
      this.errorNumero.set('Escribe un número entero de 1 en adelante');
      return;
    }

    this.ocupado.set(true);
    this.errorNumero.set(null);

    this.api.cambiarProximoNumeroAlbaran(numero).subscribe({
      next: ({ proximoNumeroAlbaran }) => {
        this.numeroGuardado.set(proximoNumeroAlbaran);
        this.ocupado.set(false);
        this.avisos.correcto(`El próximo albarán llevará el número ${proximoNumeroAlbaran}`);
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.avisos.error(fallo, 'No se ha podido cambiar el contador');
      },
    });
  }

  cambiarContrasena(): void {
    if (this.ocupado()) return;

    const actual = this.actual();
    const nueva = this.nueva();

    if (!actual) {
      this.errorContrasena.set('Escribe tu contraseña actual');
      return;
    }
    if (nueva.length < 6) {
      this.errorContrasena.set('La nueva debe tener al menos 6 caracteres');
      return;
    }
    // Se pide dos veces porque no se ve lo que se escribe y, si se equivoca,
    // el servidor cierra la sesión y quedaría fuera sin saber la contraseña.
    if (nueva !== this.repetida()) {
      this.errorContrasena.set('Las dos contraseñas nuevas no coinciden');
      return;
    }

    this.ocupado.set(true);
    this.errorContrasena.set(null);

    this.api.cambiarContrasena(actual, nueva).subscribe({
      next: () => {
        this.ocupado.set(false);
        // El servidor ya invalidó el token: la sesión local no sirve de nada.
        this.sesion.limpiar();
        this.avisos.correcto('Contraseña cambiada. Vuelve a entrar con la nueva.');
        this.router.navigateByUrl('/login');
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.errorContrasena.set(this.avisos.textoDe(fallo, 'No se ha podido cambiar'));
      },
    });
  }
}
