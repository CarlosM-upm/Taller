import { Component, inject, signal, viewChild } from '@angular/core';
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
import { BorradorLocal } from '../nucleo/borrador-local';
import { SelectorFotos } from '../comun/selector-fotos';

const MAX_FOTOS = 5;

/** Lo que se guarda en el navegador si el envío falla. */
interface PedidoAMedias {
  cliente: string;
  trabajador: string;
  descripcion: string;
}

const CLAVE_BORRADOR = 'pedido-nuevo';

/**
 * Alta de un pedido.
 *
 * La fecha no aparece por ninguna parte: la pone el servidor al crear, y no se
 * teclea ni se edita nunca.
 *
 * Las fotos se suben DESPUÉS de crear el pedido, porque el backend las cuelga
 * de una entidad que ya debe existir (POST /api/pedidos/{id}/fotos). Por eso
 * el guardado son dos pasos, y si el segundo falla el pedido ya está a salvo:
 * se avisa de que las fotos no subieron, en vez de perderlo todo.
 */
@Component({
  selector: 'app-formulario-pedido',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    SelectorFotos,
  ],
  templateUrl: './formulario-pedido.html',
  styleUrl: './formulario-pedido.scss',
})
export class FormularioPedido {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);
  private readonly borrador = inject(BorradorLocal);

  private readonly selector = viewChild(SelectorFotos);

  readonly maxFotos = MAX_FOTOS;

  readonly cliente = signal('');
  readonly trabajador = signal('');
  readonly descripcion = signal('');
  readonly fotos = signal<Blob[]>([]);

  readonly guardando = signal(false);
  readonly errores = signal<Record<string, string>>({});
  readonly recuperado = signal(false);

  constructor() {
    // Si un intento anterior se quedó a medias (típicamente porque falló el
    // wifi al guardar), se recupera lo escrito en vez de hacer teclearlo otra
    // vez. Las fotos no se pueden recuperar: son binarios y no caben aquí.
    const previo = this.borrador.recuperar<PedidoAMedias>(CLAVE_BORRADOR);
    if (previo) {
      this.cliente.set(previo.cliente);
      this.trabajador.set(previo.trabajador);
      this.descripcion.set(previo.descripcion);
      this.recuperado.set(true);
    }
  }

  descartarRecuperado(): void {
    this.borrador.olvidar(CLAVE_BORRADOR);
    this.cliente.set('');
    this.trabajador.set('');
    this.descripcion.set('');
    this.recuperado.set(false);
  }

  guardar(): void {
    if (this.guardando()) return;

    const datos = {
      cliente: this.cliente().trim(),
      trabajador: this.trabajador().trim(),
      descripcion: this.descripcion().trim(),
    };

    // Comprobación local para no gastar un viaje al servidor; la de verdad,
    // la que manda, sigue estando en el backend.
    const faltan: Record<string, string> = {};
    if (!datos.cliente) faltan['cliente'] = 'Indica el cliente';
    if (!datos.trabajador) faltan['trabajador'] = 'Indica el trabajador';
    if (!datos.descripcion) faltan['descripcion'] = 'Indica qué han pedido';
    if (Object.keys(faltan).length > 0) {
      this.errores.set(faltan);
      return;
    }

    this.guardando.set(true);
    this.errores.set({});
    // Se guarda ANTES de enviar: si la petición no llega, lo tecleado ya está
    // a salvo en el navegador.
    this.borrador.guardar(CLAVE_BORRADOR, datos);

    this.api.crearPedido(datos).subscribe({
      next: (pedido) => {
        const fotos = this.fotos();
        if (fotos.length === 0) {
          this.terminar(pedido.id, 'Pedido guardado');
          return;
        }
        this.api.subirFotosPedido(pedido.id, fotos).subscribe({
          next: () => this.terminar(pedido.id, 'Pedido guardado con sus fotos'),
          error: (fallo) => {
            // El pedido SÍ se creó: se lleva al usuario a su ficha para que
            // reintente las fotos, en lugar de dejarlo en un formulario que
            // ya no debe volver a enviar.
            this.guardando.set(false);
            this.avisos.error(
              fallo,
              'El pedido se guardó, pero las fotos no se pudieron subir'
            );
            this.router.navigate(['/pedidos', pedido.id]);
          },
        });
      },
      error: (fallo) => {
        this.guardando.set(false);
        this.errores.set(this.avisos.camposDe(fallo));
        this.avisos.error(fallo, 'No se ha podido guardar el pedido');
      },
    });
  }

  private terminar(id: number, mensaje: string): void {
    // Ya está guardado en el servidor: el borrador local sobra.
    this.borrador.olvidar(CLAVE_BORRADOR);
    this.selector()?.vaciar();
    this.avisos.correcto(mensaje);
    this.router.navigate(['/pedidos', id]);
  }
}
