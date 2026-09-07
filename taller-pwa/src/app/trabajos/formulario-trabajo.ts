import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { TrabajoDatos } from '../nucleo/modelos';

/**
 * Empezar un trabajo.
 *
 * A diferencia del pedido, aquí NO se exige nada: el trabajo nace como
 * borrador y puede guardarse a medias. Es el caso de uso de "lo empiezo hoy y
 * lo termino otro día", así que se puede apuntar solo el cliente y seguir el
 * jueves. La comprobación de que está completo llega al enviarlo, no antes.
 *
 * Las fotos no se piden aquí: se añaden desde la ficha, cuando el trabajo ya
 * existe y normalmente cuando ya hay algo que fotografiar.
 */
@Component({
  selector: 'app-formulario-trabajo',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './formulario-trabajo.html',
  styleUrl: './formulario-trabajo.scss',
})
export class FormularioTrabajo {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);

  readonly cliente = signal('');
  readonly trabajador = signal('');
  readonly descripcion = signal('');
  readonly materiales = signal('');
  readonly horas = signal<string>('');

  readonly guardando = signal(false);
  readonly errorHoras = signal<string | null>(null);

  guardar(): void {
    if (this.guardando()) return;

    const horas = this.horasComoNumero();
    if (horas === 'invalido') {
      this.errorHoras.set('Escribe un número de horas mayor que cero');
      return;
    }

    const datos: TrabajoDatos = {
      cliente: this.vacioONulo(this.cliente()),
      trabajador: this.vacioONulo(this.trabajador()),
      descripcion: this.vacioONulo(this.descripcion()),
      materiales: this.vacioONulo(this.materiales()),
      horas,
    };

    this.guardando.set(true);
    this.errorHoras.set(null);

    this.api.crearTrabajo(datos).subscribe({
      next: (trabajo) => {
        this.avisos.correcto('Trabajo empezado. Puedes terminarlo cuando quieras.');
        this.router.navigate(['/trabajos', trabajo.id]);
      },
      error: (fallo) => {
        this.guardando.set(false);
        this.avisos.error(fallo, 'No se ha podido empezar el trabajo');
      },
    });
  }

  /** Un campo en blanco viaja como null, no como cadena vacía. */
  private vacioONulo(valor: string): string | null {
    const limpio = valor.trim();
    return limpio.length > 0 ? limpio : null;
  }

  private horasComoNumero(): number | null | 'invalido' {
    const texto = this.horas().trim().replace(',', '.');
    if (texto.length === 0) return null;

    const numero = Number(texto);
    if (!Number.isFinite(numero) || numero <= 0) return 'invalido';
    // El backend guarda 2 decimales; redondear aquí evita que se rechace algo
    // como 1.333 después de haberlo tecleado.
    return Math.round(numero * 100) / 100;
  }
}
