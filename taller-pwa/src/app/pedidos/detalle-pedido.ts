import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiTaller } from '../nucleo/api';
import { Maestros } from '../nucleo/maestros';
import { Avisos } from '../nucleo/avisos';
import { Descargas } from '../nucleo/descargas';
import { Sesion } from '../nucleo/sesion';
import { Pedido } from '../nucleo/modelos';
import { confirmar } from '../comun/dialogo-confirmar';
import { TarjetaFotos } from '../comun/tarjeta-fotos';
import { SelectorMaestro } from '../comun/selector-maestro';

const MAX_FOTOS = 5;

/**
 * Ficha de un pedido.
 *
 * El trabajador la ve y puede añadir fotos; editar los datos y borrar (el
 * pedido o sus fotos) es cosa del jefe, porque el pedido nace ya finalizado y
 * no tiene estado de borrador.
 *
 * Los botones se ocultan según el rol, pero eso es solo comodidad: si alguien
 * forzara la petición, el backend responde 403 igualmente.
 */
@Component({
  selector: 'app-detalle-pedido',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    TarjetaFotos,
    SelectorMaestro,
  ],
  templateUrl: './detalle-pedido.html',
  styleUrl: './detalle-pedido.scss',
})
export class DetallePedido implements OnInit {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly dialogo = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  private readonly descargas = inject(Descargas);
  readonly sesion = inject(Sesion);

  /** Llega de la ruta /pedidos/:id gracias a withComponentInputBinding. */
  readonly id = input.required<string>();

  readonly maestros = inject(Maestros);

  readonly pedido = signal<Pedido | null>(null);
  readonly cargando = signal(true);
  readonly ocupado = signal(false);
  readonly fallo = signal<string | null>(null);

  readonly editando = signal(false);
  readonly clienteId = signal<number | null>(null);
  readonly trabajadorId = signal<number | null>(null);
  readonly descripcion = signal('');
  readonly errores = signal<Record<string, string>>({});

  /** La galería necesita saber construir la URL de cada foto. */
  readonly maxFotos = MAX_FOTOS;
  readonly subirFotos = (fotos: Blob[]) => this.api.subirFotosPedido(Number(this.id()), fotos);
  readonly borrarFoto = (fotoId: number) => this.api.borrarFotoPedido(Number(this.id()), fotoId);

  readonly urlFoto = computed(() => {
    const id = Number(this.id());
    return (fotoId: number) => this.api.urlFotoPedido(id, fotoId);
  });

  /**
   * OJO: la carga va en ngOnInit y NO en el constructor.
   *
   * Un input obligatorio de tipo signal todavía no tiene valor mientras se
   * construye el componente: el router lo inyecta después. Leer this.id()
   * en el constructor lanza NG0950 ("Input is required but no value is
   * available yet"), el componente no llega a crearse y el router aborta la
   * navegación. El efecto que se ve es que pinchar en la lista no hace nada,
   * sin ningún aviso. Ocurrió, y por eso existe la comprobación de humo (e2e/).
   */
  ngOnInit(): void {
    this.maestros.asegurarCargados();
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);

    this.api.pedido(Number(this.id())).subscribe({
      next: (pedido) => {
        this.pedido.set(pedido);
        this.cargando.set(false);
      },
      error: (fallo) => {
        this.cargando.set(false);
        this.fallo.set(this.avisos.textoDe(fallo, 'No se ha podido cargar el pedido'));
      },
    });
  }

  /** Solo jefe: el backend responde 403 al trabajador aunque fuerce la URL. */
  descargarPdf(): void {
    const pedido = this.pedido();
    if (!pedido || this.ocupado()) return;

    this.ocupado.set(true);
    this.descargas
      .descargar(
        this.api.urlPdfPedido(pedido.id),
        `pedido-${pedido.id}.pdf`,
        'No se ha podido descargar el pedido en PDF'
      )
      .then(() => this.ocupado.set(false));
  }

  empezarEdicion(): void {
    const pedido = this.pedido();
    if (!pedido) return;
    this.clienteId.set(pedido.clienteId);
    this.trabajadorId.set(pedido.trabajadorId);
    this.descripcion.set(pedido.descripcion);
    this.errores.set({});
    this.editando.set(true);
  }

  cancelarEdicion(): void {
    this.editando.set(false);
    this.errores.set({});
  }

  guardar(): void {
    const pedido = this.pedido();
    if (!pedido || this.ocupado()) return;

    this.ocupado.set(true);
    this.errores.set({});

    this.api
      .editarPedido(pedido.id, {
        clienteId: this.clienteId(),
        trabajadorId: this.trabajadorId(),
        descripcion: this.descripcion().trim(),
      })
      .subscribe({
        next: (actualizado) => {
          this.pedido.set(actualizado);
          this.editando.set(false);
          this.ocupado.set(false);
          this.avisos.correcto('Pedido actualizado');
        },
        error: (fallo) => {
          this.ocupado.set(false);
          this.errores.set(this.avisos.camposDe(fallo));
          this.avisos.error(fallo, 'No se han podido guardar los cambios');
        },
      });
  }

  borrarPedido(): void {
    const pedido = this.pedido();
    if (!pedido || this.ocupado()) return;

    confirmar(this.dialogo, {
      titulo: 'Borrar el pedido',
      mensaje: `Se borrará el pedido de ${pedido.cliente} junto con sus fotos. No se puede deshacer.`,
      aceptar: 'Borrar',
      peligroso: true,
    }).then((seguro) => {
      if (!seguro) return;
      this.ocupado.set(true);
      this.api.borrarPedido(pedido.id).subscribe({
        next: () => {
          this.avisos.correcto('Pedido borrado');
          this.router.navigate(['/pedidos']);
        },
        error: (fallo) => {
          this.ocupado.set(false);
          this.avisos.error(fallo, 'No se ha podido borrar el pedido');
        },
      });
    });
  }

  /** Tras subir o borrar en la tarjeta de fotos. */
  fotosCambiadas(fotoIds: number[]): void {
    this.pedido.update((actual) => (actual ? { ...actual, fotoIds } : actual));
  }
}
