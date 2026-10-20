import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiTaller } from './api';
import { Cliente, FamiliaMaterial, MaterialCatalogo, Trabajador } from './modelos';

/**
 * Clientes, trabajadores y el catálogo de materiales, cargados una vez y
 * compartidos.
 *
 * Los necesitan casi todas las pantallas para poblar sus desplegables. Sin
 * esto, abrir el alta de un pedido, la de un trabajo y la ficha de un albarán
 * pediría las mismas dos listas tres veces, y en una tablet por wifi eso se
 * nota.
 *
 * Después de tocarlos en Ajustes hay que llamar a recargar(), o los
 * desplegables seguirían enseñando los nombres viejos.
 */
@Injectable({ providedIn: 'root' })
export class Maestros {
  private readonly api = inject(ApiTaller);

  readonly clientes = signal<Cliente[]>([]);
  readonly trabajadores = signal<Trabajador[]>([]);
  readonly familias = signal<FamiliaMaterial[]>([]);
  /** Sin precios: es la versión que puede recibir la tablet. */
  readonly catalogo = signal<MaterialCatalogo[]>([]);
  readonly cargando = signal(false);

  private cargado = false;

  /** Carga las listas si aún no están. Llamar desde ngOnInit de cada pantalla. */
  asegurarCargados(): void {
    if (this.cargado || this.cargando()) return;
    this.recargar();
  }

  recargar(): void {
    this.cargando.set(true);
    forkJoin({
      clientes: this.api.clientes(),
      trabajadores: this.api.trabajadores(),
      familias: this.api.familiasMaterial(),
      catalogo: this.api.catalogo(),
    }).subscribe({
      next: ({ clientes, trabajadores, familias, catalogo }) => {
        this.clientes.set(clientes);
        this.trabajadores.set(trabajadores);
        this.familias.set(familias);
        this.catalogo.set(catalogo);
        this.cargado = true;
        this.cargando.set(false);
      },
      // Si fallan, los desplegables salen vacíos y la pantalla lo dice. No se
      // avisa aquí para no soltar dos mensajes por el mismo problema cuando la
      // pantalla ya está informando de que no ha podido cargar.
      error: () => this.cargando.set(false),
    });
  }

  nombreCliente(id: number | null | undefined): string {
    return this.clientes().find((c) => c.id === id)?.nombre ?? '';
  }

  nombreTrabajador(id: number | null | undefined): string {
    return this.trabajadores().find((t) => t.id === id)?.nombre ?? '';
  }
}
