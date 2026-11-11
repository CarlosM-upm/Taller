import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { Observable } from 'rxjs';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Maestros } from '../nucleo/maestros';
import { ClienteConDni } from '../nucleo/modelos';
import { contiene } from '../nucleo/busqueda';
import { Paginacion } from '../comun/paginacion';
import { confirmar } from '../comun/dialogo-confirmar';

/**
 * Alta, edición y borrado de clientes, con su DNI. Solo jefe.
 *
 * Va aparte de lista-maestros porque el cliente ya no es solo un nombre: el
 * DNI es obligatorio y los albaranes lo leen de aquí, así que no se teclea en
 * ningún otro sitio. Corregir nombre o DNI cambia todos sus documentos,
 * incluidos albaranes ya firmados: es para arreglar erratas.
 *
 * Lee su propia lista (/api/clientes/con-dni, solo jefe), porque la de
 * Maestros, que comparten las dos cuentas, no lleva el DNI.
 *
 * Los clientes anteriores al DNI obligatorio salen marcados con "Falta el DNI":
 * no se pueden elegir en ningún documento hasta que se les ponga. El filtro
 * "Solo los que no tienen DNI" sirve para ir poniéndoselo.
 *
 * Con cientos de clientes la lista va por páginas de 20, y se busca por un
 * trozo del nombre (sin tildes) o del DNI.
 */
@Component({
  selector: 'app-lista-clientes',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule, MatTooltipModule,
    MatInputModule,
    Paginacion,
  ],
  templateUrl: './lista-clientes.html',
  styleUrl: './lista-clientes.scss',
})
export class ListaClientes implements OnInit {
  private readonly api = inject(ApiTaller);
  private readonly avisos = inject(Avisos);
  private readonly maestros = inject(Maestros);
  private readonly dialogo = inject(MatDialog);

  readonly clientes = signal<ClienteConDni[]>([]);
  readonly nombre = signal('');
  readonly dni = signal('');
  readonly editandoId = signal<number | null>(null);
  readonly nombreEditado = signal('');
  readonly dniEditado = signal('');
  readonly ocupado = signal(false);

  // --- Buscar y paginar ---
  readonly porPagina = POR_PAGINA;
  readonly busqueda = signal('');
  readonly soloSinDni = signal(false);
  readonly pagina = signal(0);

  readonly cuantosSinDni = computed(() => this.clientes().filter((c) => !c.dni).length);

  readonly filtrados = computed(() =>
    this.clientes().filter((c) => (!this.soloSinDni() || !c.dni) && coincide(c, this.busqueda())),
  );

  /** Si al borrar se vacía la última página, se vuelve a la anterior. */
  readonly paginaActual = computed(() =>
    Math.min(this.pagina(), Math.max(0, Math.ceil(this.filtrados().length / POR_PAGINA) - 1)),
  );

  readonly deLaPagina = computed(() => {
    const desde = this.paginaActual() * POR_PAGINA;
    return this.filtrados().slice(desde, desde + POR_PAGINA);
  });

  ngOnInit(): void {
    this.cargar();
  }

  /** Cada búsqueda o filtro nuevo empieza por la primera página. */
  buscar(texto: string): void {
    this.busqueda.set(texto);
    this.pagina.set(0);
  }

  filtrarSinDni(solo: boolean): void {
    this.soloSinDni.set(solo);
    this.pagina.set(0);
  }

  crear(): void {
    const nombre = this.nombre().trim();
    const dni = this.dni().trim();
    if (!nombre || !dni || this.ocupado()) return;
    this.ejecutar(this.api.crearCliente(nombre, dni), 'Cliente añadido', () => {
      this.nombre.set('');
      this.dni.set('');
    });
  }

  editar(cliente: ClienteConDni): void {
    this.editandoId.set(cliente.id);
    this.nombreEditado.set(cliente.nombre);
    this.dniEditado.set(cliente.dni ?? '');
  }

  /** Pregunta antes: el cambio llega a todos sus documentos, también a los albaranes firmados. */
  guardar(id: number): void {
    const nombre = this.nombreEditado().trim();
    const dni = this.dniEditado().trim();
    if (!nombre || this.ocupado()) return;
    // Sin DNI no se manda: el servidor lo rechazaría igual, pero así el aviso
    // es inmediato y dice exactamente qué falta.
    if (!dni) {
      this.avisos.error(null, 'Indica el DNI del cliente');
      return;
    }
    const antes = this.clientes().find((c) => c.id === id)?.nombre ?? nombre;
    confirmar(this.dialogo, {
      titulo: `¿Guardar los cambios de ${antes}?`,
      mensaje:
        'El nombre y el DNI cambiarán en todos sus pedidos, trabajos y albaranes, ' +
        'también en los albaranes ya firmados.',
      aceptar: 'Guardar',
    }).then((seguro) => {
      if (!seguro) return;
      this.ejecutar(this.api.editarCliente(id, nombre, dni), 'Cliente cambiado en todos sus documentos',
        () => this.editandoId.set(null));
    });
  }

  borrar(cliente: ClienteConDni): void {
    confirmar(this.dialogo, {
      titulo: `¿Borrar a ${cliente.nombre}?`,
      mensaje:
        'Solo se puede borrar si no tiene pedidos, trabajos ni albaranes. ' +
        'Si los tiene, el servidor lo impedirá y dirá cuántos son.',
      aceptar: 'Borrar',
      peligroso: true,
    }).then((seguro) => {
      if (seguro) this.ejecutar(this.api.borrarCliente(cliente.id), 'Cliente borrado');
    });
  }

  private cargar(): void {
    this.api.clientesConDni().subscribe({
      next: (lista) => this.clientes.set(lista),
      error: (fallo) => this.avisos.error(fallo, 'No se han podido cargar los clientes'),
    });
  }

  /**
   * Tras cualquier cambio se recargan también los maestros: los desplegables
   * del resto de pantallas leen de ahí, y un cliente al que se acaba de poner
   * el DNI seguiría sin poder elegirse.
   */
  private ejecutar(peticion: Observable<unknown>, exito: string, despues?: () => void): void {
    this.ocupado.set(true);
    peticion.subscribe({
      next: () => {
        this.ocupado.set(false);
        despues?.();
        this.cargar();
        this.maestros.recargar();
        this.avisos.correcto(exito);
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.avisos.error(fallo, 'No se ha podido completar la operación');
      },
    });
  }
}

const POR_PAGINA = 20;

/** Por un trozo del nombre (sin tildes ni mayúsculas) o del DNI (sin puntos ni guiones). */
function coincide(cliente: ClienteConDni, consulta: string): boolean {
  if (contiene(cliente.nombre, consulta)) return true;
  const dni = consulta.toUpperCase().replace(/[\s.-]/g, '');
  return dni.length > 0 && (cliente.dni ?? '').includes(dni);
}
