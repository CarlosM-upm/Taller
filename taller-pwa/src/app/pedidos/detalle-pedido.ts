import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
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
import { Avisos } from '../nucleo/avisos';
import { Sesion } from '../nucleo/sesion';
import { Pedido } from '../nucleo/modelos';
import { DialogoConfirmar } from '../comun/dialogo-confirmar';
import { GaleriaFotos } from '../comun/galeria-fotos';
import { SelectorFotos } from '../comun/selector-fotos';

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
    GaleriaFotos,
    SelectorFotos,
  ],
  templateUrl: './detalle-pedido.html',
  styleUrl: './detalle-pedido.scss',
})
export class DetallePedido {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly dialogo = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  readonly sesion = inject(Sesion);

  private readonly selector = viewChild(SelectorFotos);

  /** Llega de la ruta /pedidos/:id gracias a withComponentInputBinding. */
  readonly id = input.required<string>();

  readonly pedido = signal<Pedido | null>(null);
  readonly cargando = signal(true);
  readonly ocupado = signal(false);
  readonly fallo = signal<string | null>(null);

  readonly editando = signal(false);
  readonly cliente = signal('');
  readonly trabajador = signal('');
  readonly descripcion = signal('');
  readonly errores = signal<Record<string, string>>({});

  readonly fotosNuevas = signal<Blob[]>([]);
  readonly huecos = computed(() => MAX_FOTOS - (this.pedido()?.fotoIds.length ?? 0));

  /** La galería necesita saber construir la URL de cada foto. */
  readonly urlFoto = computed(() => {
    const id = Number(this.id());
    return (fotoId: number) => this.api.urlFotoPedido(id, fotoId);
  });

  constructor() {
    // El input de ruta ya está resuelto cuando se construye el componente.
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

  empezarEdicion(): void {
    const pedido = this.pedido();
    if (!pedido) return;
    this.cliente.set(pedido.cliente);
    this.trabajador.set(pedido.trabajador);
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
        cliente: this.cliente().trim(),
        trabajador: this.trabajador().trim(),
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

  subirFotos(): void {
    const pedido = this.pedido();
    const fotos = this.fotosNuevas();
    if (!pedido || fotos.length === 0 || this.ocupado()) return;

    this.ocupado.set(true);
    this.api.subirFotosPedido(pedido.id, fotos).subscribe({
      next: (fotoIds) => {
        this.pedido.set({ ...pedido, fotoIds });
        this.selector()?.vaciar();
        this.ocupado.set(false);
        this.avisos.correcto('Fotos añadidas');
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.avisos.error(fallo, 'No se han podido subir las fotos');
      },
    });
  }

  borrarFoto(fotoId: number): void {
    const pedido = this.pedido();
    if (!pedido || this.ocupado()) return;

    this.confirmar({
      titulo: 'Borrar la foto',
      mensaje: 'Esta foto se borrará del pedido y no se puede recuperar.',
      aceptar: 'Borrar',
      peligroso: true,
    }).then((seguro) => {
      if (!seguro) return;
      this.ocupado.set(true);
      this.api.borrarFotoPedido(pedido.id, fotoId).subscribe({
        next: () => {
          this.pedido.set({
            ...pedido,
            fotoIds: pedido.fotoIds.filter((f) => f !== fotoId),
          });
          this.ocupado.set(false);
          this.avisos.correcto('Foto borrada');
        },
        error: (fallo) => {
          this.ocupado.set(false);
          this.avisos.error(fallo, 'No se ha podido borrar la foto');
        },
      });
    });
  }

  borrarPedido(): void {
    const pedido = this.pedido();
    if (!pedido || this.ocupado()) return;

    this.confirmar({
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

  private confirmar(datos: {
    titulo: string;
    mensaje: string;
    aceptar: string;
    peligroso: boolean;
  }): Promise<boolean> {
    return new Promise((resolver) => {
      this.dialogo
        .open(DialogoConfirmar, { data: datos, width: '420px' })
        .afterClosed()
        .subscribe((respuesta) => resolver(respuesta === true));
    });
  }
}
