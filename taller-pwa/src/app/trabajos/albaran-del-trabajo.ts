import { Component, inject, input, model, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Albaran } from '../nucleo/modelos';
import { DialogoGenerarAlbaran } from '../albaranes/dialogo-generar-albaran';

/**
 * El albarán de un trabajo enviado, en su ficha: el enlace si ya existe, o el
 * botón para generarlo. Solo para el jefe: la ficha no lo pinta para la tablet,
 * porque a ella /api/albaranes le responde 403.
 */
@Component({
  selector: 'app-albaran-del-trabajo',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './albaran-del-trabajo.html',
  styleUrl: './albaran-del-trabajo.scss',
})
export class AlbaranDelTrabajo implements OnInit {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly dialogo = inject(MatDialog);
  private readonly avisos = inject(Avisos);

  readonly trabajoId = input.required<number>();
  /** De dos direcciones con la ficha, como en la tarjeta de fotos. */
  readonly ocupado = model(false);

  /**
   * El albarán que salió de este trabajo, si ya existe.
   *
   * La API no dice en el trabajo cuál es su albarán, así que se busca en la
   * lista de albaranes el que apunte a este trabajo. Es una llamada de más,
   * pero la lista es pequeña. Si algún día crece mucho, lo suyo sería añadir
   * el dato a TrabajoResponse.
   */
  readonly albaran = signal<Albaran | null>(null);

  /** En ngOnInit y no en el constructor: el input no existe todavía allí. */
  ngOnInit(): void {
    this.api.albaranes().subscribe({
      next: (lista) => this.albaran.set(lista.find((a) => a.trabajoIds.includes(this.trabajoId())) ?? null),
      // Si falla, simplemente no se enseña el enlace. No es información
      // crítica y no merece molestar al usuario con un aviso.
      error: () => this.albaran.set(null),
    });
  }

  generar(): void {
    if (this.ocupado()) return;

    this.dialogo
      .open(DialogoGenerarAlbaran, { width: '440px' })
      .afterClosed()
      .subscribe((datos) => {
        if (!datos) return;
        this.ocupado.set(true);
        this.api.crearAlbaranDesdeTrabajo(this.trabajoId(), datos).subscribe({
          next: (albaran) => {
            this.ocupado.set(false);
            this.avisos.correcto(`Albarán nº ${albaran.numero} generado`);
            this.router.navigate(['/albaranes', albaran.id]);
          },
          error: (fallo) => {
            this.ocupado.set(false);
            this.avisos.error(fallo, 'No se ha podido generar el albarán');
          },
        });
      });
  }
}
