import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Observable } from 'rxjs';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Maestros } from '../nucleo/maestros';
import { ClienteConDni } from '../nucleo/modelos';
import { DialogoConfirmar } from '../comun/dialogo-confirmar';

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
 * no se pueden elegir en ningún documento hasta que se les ponga.
 */
@Component({
  selector: 'app-lista-clientes',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <h3>Clientes</h3>

    <form class="alta" (ngSubmit)="crear()">
      <mat-form-field appearance="outline" class="crece">
        <mat-label>Añadir cliente</mat-label>
        <input matInput name="nuevo-cliente" [ngModel]="nombre()" (ngModelChange)="nombre.set($event)" [disabled]="ocupado()" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="dni">
        <mat-label>DNI</mat-label>
        <input matInput name="nuevo-dni" placeholder="12345678Z" [ngModel]="dni()" (ngModelChange)="dni.set($event)" [disabled]="ocupado()" />
      </mat-form-field>
      <button matButton="filled" type="submit" [disabled]="ocupado() || !nombre().trim() || !dni().trim()">
        Añadir
      </button>
    </form>

    @if (clientes().length === 0) {
      <p class="vacio">Todavía no hay ninguno.</p>
    }

    <ul class="lista">
      @for (cliente of clientes(); track cliente.id) {
        <li>
          @if (editandoId() === cliente.id) {
            <form class="edicion" (ngSubmit)="guardar(cliente.id)">
              <mat-form-field appearance="outline" class="crece">
                <mat-label>Nombre</mat-label>
                <input matInput [name]="'editar-nombre-' + cliente.id" [ngModel]="nombreEditado()" (ngModelChange)="nombreEditado.set($event)" [disabled]="ocupado()" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="dni">
                <mat-label>DNI</mat-label>
                <input matInput [name]="'editar-dni-' + cliente.id" [ngModel]="dniEditado()" (ngModelChange)="dniEditado.set($event)" [disabled]="ocupado()" />
              </mat-form-field>
              <button matIconButton type="submit" aria-label="Guardar el cliente" [disabled]="ocupado()">
                <mat-icon>check</mat-icon>
              </button>
              <button matIconButton type="button" aria-label="Cancelar" [disabled]="ocupado()" (click)="editandoId.set(null)">
                <mat-icon>close</mat-icon>
              </button>
            </form>
          } @else {
            <span class="nombre crece">
              <span>{{ cliente.nombre }}</span>
              @if (cliente.dni) {
                <small>{{ cliente.dni }}</small>
              } @else {
                <span class="falta">Falta el DNI</span>
              }
            </span>
            <button matIconButton [attr.aria-label]="'Editar ' + cliente.nombre" [disabled]="ocupado()" (click)="editar(cliente)">
              <mat-icon>edit</mat-icon>
            </button>
            <button matIconButton [attr.aria-label]="'Borrar ' + cliente.nombre" [disabled]="ocupado()" (click)="borrar(cliente)">
              <mat-icon>delete</mat-icon>
            </button>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    /* En la tablet caben en una fila; en un móvil el DNI baja debajo. */
    .alta, .edicion { display: flex; flex-wrap: wrap; gap: 0 8px; align-items: flex-start; width: 100%; }
    .alta mat-form-field, .edicion mat-form-field { width: auto; }
    .crece { flex: 1 1 180px; min-width: 0; }
    .dni { flex: 0 1 170px; min-width: 130px; }
    .alta button[type='submit'] { margin-top: 4px; }

    .lista { list-style: none; margin: 0; padding: 0; }
    .lista li {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 48px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    .nombre { padding: 4px 0; }
    .nombre small { margin-left: 8px; opacity: 0.65; }
    /* Sin DNI no se puede elegir en ningún documento: tiene que verse. */
    .falta {
      margin-left: 8px;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.78rem;
      font-weight: 500;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .vacio { opacity: 0.7; }
  `,
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

  ngOnInit(): void {
    this.cargar();
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
    this.ejecutar(this.api.editarCliente(id, nombre, dni), 'Cliente cambiado en todos sus documentos',
      () => this.editandoId.set(null));
  }

  borrar(cliente: ClienteConDni): void {
    this.dialogo
      .open(DialogoConfirmar, {
        data: {
          titulo: `¿Borrar a ${cliente.nombre}?`,
          mensaje:
            'Solo se puede borrar si no tiene pedidos, trabajos ni albaranes. ' +
            'Si los tiene, el servidor lo impedirá y dirá cuántos son.',
          aceptar: 'Borrar',
          peligroso: true,
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (confirmado) this.ejecutar(this.api.borrarCliente(cliente.id), 'Cliente borrado');
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
