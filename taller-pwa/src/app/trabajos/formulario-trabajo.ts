import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Maestros } from '../nucleo/maestros';
import { MaterialLinea, TrabajoDatos } from '../nucleo/modelos';
import { FilasMateriales } from '../comun/filas-materiales';
import { SelectorMaestro } from '../comun/selector-maestro';
import { SelectorCliente } from '../comun/selector-cliente';
import { aHoras, vacioONulo } from './campos-del-trabajo';

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
    MatIconModule, MatTooltipModule,
    MatInputModule,
    MatProgressBarModule,
    FilasMateriales,
    SelectorMaestro,
    SelectorCliente,
  ],
  templateUrl: './formulario-trabajo.html',
  styleUrl: './formulario-trabajo.scss',
})
export class FormularioTrabajo implements OnInit {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);
  readonly maestros = inject(Maestros);

  readonly clienteId = signal<number | null>(null);
  readonly trabajadorId = signal<number | null>(null);
  readonly descripcion = signal('');
  readonly materiales = signal<MaterialLinea[]>([]);
  readonly horas = signal<string>('');

  ngOnInit(): void {
    this.maestros.asegurarCargados();
  }

  readonly guardando = signal(false);
  readonly errorHoras = signal<string | null>(null);

  guardar(): void {
    if (this.guardando()) return;

    const horas = aHoras(this.horas());
    if (horas === 'invalido') {
      this.errorHoras.set('Escribe un número de horas mayor que cero');
      return;
    }

    const datos: TrabajoDatos = {
      clienteId: this.clienteId(),
      trabajadorId: this.trabajadorId(),
      descripcion: vacioONulo(this.descripcion()),
      materiales: this.materiales(),
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
}
