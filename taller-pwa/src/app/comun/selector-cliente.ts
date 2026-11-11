import { Component, computed, input, linkedSignal, model } from '@angular/core';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { Cliente } from '../nucleo/modelos';
import { contiene } from '../nucleo/busqueda';

/**
 * El campo para elegir cliente: se busca escribiendo o se despliega la lista.
 *
 * Con cientos de clientes, deslizar un desplegable no basta. Funciona igual que
 * el de materiales: lo escrito tiene que estar contenido en el nombre, sin
 * distinguir mayúsculas ni tildes, y la flecha enseña la lista entera.
 *
 * El valor solo cambia al TOCAR un cliente de la lista. Si se escribe y se sale
 * sin elegir, el campo vuelve a enseñar el cliente que había: así nunca queda
 * un texto que no corresponde a ningún cliente.
 *
 * En un FORMULARIO no hay opción de vaciar (el PATCH entiende un id nulo como
 * "no toques este campo"). En un FILTRO, opcionTodos añade la de "todos".
 */
@Component({
  selector: 'app-selector-cliente',
  imports: [MatAutocompleteModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatTooltipModule, MatInputModule],
  templateUrl: './selector-cliente.html',
  styleUrl: './selector-cliente.scss',
})
export class SelectorCliente {
  readonly etiqueta = input('Cliente');
  readonly opciones = input.required<Cliente[]>();
  readonly deshabilitado = input(false);
  /** SOLO en filtros: una primera opción que deja el valor a nulo = "todos". */
  readonly opcionTodos = input<string | null>(null);
  /**
   * En los FORMULARIOS: los clientes sin DNI salen deshabilitados, porque el
   * albarán lo lee del cliente. Se respeta el que ya estuviera puesto, igual
   * que hace el servidor. En los filtros no hace falta.
   */
  readonly soloConDni = input(false);

  /** Dos direcciones: el padre escribe el valor inicial y recibe los cambios. */
  readonly valor = model<number | null>(null);

  /** Lo que hay escrito. Vuelve al nombre del cliente elegido cada vez que este cambia. */
  readonly texto = linkedSignal(() => this.nombreDe(this.valor()));

  /**
   * Si lo escrito es el nombre del cliente ya elegido, se enseña la lista
   * entera: el usuario ha abierto el campo para cambiarlo, no ha buscado nada.
   */
  readonly visibles = computed(() => {
    const escrito = this.texto();
    if (escrito === this.nombreDe(this.valor())) return this.opciones();
    return this.opciones().filter((c) => contiene(c.nombre, escrito));
  });

  readonly hayAlgunoSinDni = computed(() => this.opciones().some((c) => !c.tieneDni));

  /** Para el autocompletado: del id al nombre que se ve en el campo. */
  readonly nombreDe = (id: number | null): string =>
    id === null ? '' : (this.opciones().find((c) => c.id === id)?.nombre ?? '');

  bloqueado(cliente: Cliente): boolean {
    return this.soloConDni() && !cliente.tieneDni && cliente.id !== this.valor();
  }

  elegir(id: number | null): void {
    this.valor.set(id);
    this.texto.set(this.nombreDe(id));
  }

  /** Al cerrar la lista sin elegir, el campo vuelve a enseñar el cliente que había. */
  alCerrar(): void {
    this.texto.set(this.nombreDe(this.valor()));
  }

  verTodos(disparador: MatAutocompleteTrigger, evento: Event): void {
    evento.stopPropagation();
    this.texto.set(this.nombreDe(this.valor()));
    disparador.openPanel();
  }
}
