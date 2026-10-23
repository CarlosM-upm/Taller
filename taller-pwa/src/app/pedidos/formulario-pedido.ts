import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
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
import { Maestros } from '../nucleo/maestros';
import { SelectorFotos } from '../comun/selector-fotos';
import { SelectorMaestro } from '../comun/selector-maestro';

const MAX_FOTOS = 5;

/** Lo que se guarda en el navegador si el envío falla. */
interface PedidoAMedias {
  clienteId: number | null;
  trabajadorId: number | null;
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
    SelectorMaestro,
  ],
  templateUrl: './formulario-pedido.html',
  styleUrl: './formulario-pedido.scss',
})
export class FormularioPedido implements OnInit {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);
  private readonly borrador = inject(BorradorLocal);

  private readonly selector = viewChild(SelectorFotos);

  readonly maxFotos = MAX_FOTOS;

  readonly clienteId = signal<number | null>(null);
  readonly trabajadorId = signal<number | null>(null);
  readonly descripcion = signal('');
  readonly fotos = signal<Blob[]>([]);

  readonly guardando = signal(false);
  readonly errores = signal<Record<string, string>>({});
  readonly recuperado = signal(false);

  readonly maestros = inject(Maestros);

  constructor() {
    // Si un intento anterior se quedó a medias (típicamente porque falló el
    // wifi al guardar), se recupera lo escrito en vez de hacer teclearlo otra
    // vez. Las fotos no se pueden recuperar: son binarios y no caben aquí.
    const previo = this.borrador.recuperar<PedidoAMedias>(CLAVE_BORRADOR);
    // El 'clienteId' in previo no sobra: un borrador guardado cuando cliente y
    // trabajador eran texto tecleado tiene otra forma, y restaurarlo dejaría el
    // formulario vacío con el cartel de "recuperado" puesto, que es peor que no
    // recuperar nada.
    if (previo && 'clienteId' in previo) {
      this.clienteId.set(previo.clienteId);
      this.trabajadorId.set(previo.trabajadorId);
      this.descripcion.set(previo.descripcion);
      this.recuperado.set(true);
    }
  }

  ngOnInit(): void {
    this.maestros.asegurarCargados();
  }

  descartarRecuperado(): void {
    this.borrador.olvidar(CLAVE_BORRADOR);
    this.clienteId.set(null);
    this.trabajadorId.set(null);
    this.descripcion.set('');
    this.recuperado.set(false);
  }

  guardar(): void {
    if (this.guardando()) return;

    const datos = {
      clienteId: this.clienteId(),
      trabajadorId: this.trabajadorId(),
      descripcion: this.descripcion().trim(),
    };

    const faltan = camposQueFaltan(datos);
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
      next: (pedido) => this.subirFotos(pedido.id),
      error: (fallo) => {
        this.guardando.set(false);
        this.errores.set(this.avisos.camposDe(fallo));
        this.avisos.error(fallo, 'No se ha podido guardar el pedido');
      },
    });
  }

  /** Con el pedido ya creado, sus fotos (si hay). */
  private subirFotos(pedidoId: number): void {
    const fotos = this.fotos();
    if (fotos.length === 0) {
      this.terminar(pedidoId, 'Pedido guardado');
      return;
    }
    this.api.subirFotosPedido(pedidoId, fotos).subscribe({
      next: () => this.terminar(pedidoId, 'Pedido guardado con sus fotos'),
      error: (fallo) => {
        // El pedido SÍ se creó: se lleva al usuario a su ficha para que
        // reintente las fotos, en lugar de dejarlo en un formulario que
        // ya no debe volver a enviar.
        this.guardando.set(false);
        this.avisos.error(fallo, 'El pedido se guardó, pero las fotos no se pudieron subir');
        this.router.navigate(['/pedidos', pedidoId]);
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

/**
 * Comprobación local para no gastar un viaje al servidor; la de verdad, la que
 * manda, sigue estando en el backend.
 */
function camposQueFaltan(datos: {
  clienteId: number | null;
  trabajadorId: number | null;
  descripcion: string;
}): Record<string, string> {
  const faltan: Record<string, string> = {};
  if (!datos.clienteId) faltan['cliente'] = 'Elige el cliente';
  if (!datos.trabajadorId) faltan['trabajador'] = 'Elige el trabajador';
  if (!datos.descripcion) faltan['descripcion'] = 'Indica qué han pedido';
  return faltan;
}
