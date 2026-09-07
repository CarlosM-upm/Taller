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

@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly api = inject(ApiTaller);
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);

  readonly usuario = signal('');
  readonly contrasena = signal('');
  readonly enviando = signal(false);
  readonly fallo = signal<string | null>(null);

  entrar(): void {
    if (this.enviando()) return;

    const usuario = this.usuario().trim();
    const contrasena = this.contrasena();
    if (!usuario || !contrasena) {
      this.fallo.set('Escribe el usuario y la contraseña');
      return;
    }

    this.enviando.set(true);
    this.fallo.set(null);

    this.api.entrar(usuario, contrasena).subscribe({
      next: (respuesta) => {
        this.sesion.entrar(respuesta.token, respuesta.rol);
        // Vuelve a donde iba antes de que le echara el guardia.
        const volverA = new URLSearchParams(location.search).get('volverA');
        this.router.navigateByUrl(volverA && volverA !== '/login' ? volverA : '/pedidos');
      },
      error: (fallo) => {
        this.enviando.set(false);
        // El mensaje se enseña dentro de la tarjeta, no en un aviso flotante:
        // aquí el error es el centro de atención, no una notificación de paso.
        this.fallo.set(this.avisos.textoDe(fallo, 'No se ha podido entrar'));
      },
    });
  }
}
