import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Maestros } from '../nucleo/maestros';
import { Cliente, Trabajador } from '../nucleo/modelos';
import { DialogoConfirmar } from '../comun/dialogo-confirmar';

type Tipo = 'cliente' | 'trabajador';

/**
 * Alta, renombrado y borrado de clientes o de trabajadores.
 *
 * Es el mismo componente para los dos porque las dos listas se comportan
 * igual: un nombre, único, que no se puede borrar si tiene documentos. Lo que
 * cambia son los textos y a qué endpoints llama.
 *
 * Renombrar afecta a todos los documentos de esa persona, incluidos albaranes
 * ya firmados. Es intencionado: sirve para corregir erratas, y por eso el
 * mensaje lo avisa antes de guardar.
 */
@Component({
  selector: 'app-lista-maestros',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <h3>{{ titulo() }}</h3>

    <form class="alta" (ngSubmit)="crear()">
      <mat-form-field appearance="outline" class="crece">
        <mat-label>Añadir {{ singular() }}</mat-label>
        <input
          matInput
          [name]="'nuevo-' + tipo()"
          [ngModel]="nuevo()"
          (ngModelChange)="nuevo.set($event)"
          [disabled]="ocupado()"
        />
      </mat-form-field>
      <button matButton="filled" type="submit" [disabled]="ocupado() || !nuevo().trim()">
        Añadir
      </button>
    </form>

    @if (elementos().length === 0) {
      <p class="vacio">Todavía no hay ninguno.</p>
    }

    <ul class="lista">
      @for (elemento of elementos(); track elemento.id) {
        <li>
          @if (editandoId() === elemento.id) {
            <mat-form-field appearance="outline" class="crece">
              <input
                matInput
                [name]="'editar-' + elemento.id"
                [ngModel]="nombreEditado()"
                (ngModelChange)="nombreEditado.set($event)"
                [disabled]="ocupado()"
              />
            </mat-form-field>
            <button matIconButton aria-label="Guardar el nombre" [disabled]="ocupado()" (click)="guardarNombre(elemento.id)">
              <mat-icon>check</mat-icon>
            </button>
            <button matIconButton aria-label="Cancelar" [disabled]="ocupado()" (click)="cancelar()">
              <mat-icon>close</mat-icon>
            </button>
          } @else {
            <span class="nombre crece">{{ elemento.nombre }}</span>
            <button matIconButton [attr.aria-label]="'Renombrar ' + elemento.nombre" [disabled]="ocupado()" (click)="empezarEdicion(elemento)">
              <mat-icon>edit</mat-icon>
            </button>
            <button matIconButton [attr.aria-label]="'Borrar ' + elemento.nombre" [disabled]="ocupado()" (click)="borrar(elemento)">
              <mat-icon>delete</mat-icon>
            </button>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    .alta { display: flex; gap: 8px; align-items: flex-start; }
    .crece { flex: 1 1 auto; min-width: 0; }

    .lista { list-style: none; margin: 0; padding: 0; }
    .lista li {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 48px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    .nombre { padding: 4px 0; }
    .vacio { opacity: 0.7; }
  `,
})
export class ListaMaestros {
  private readonly api = inject(ApiTaller);
  private readonly avisos = inject(Avisos);
  private readonly maestros = inject(Maestros);
  private readonly dialogo = inject(MatDialog);

  readonly tipo = input.required<Tipo>();
  readonly titulo = input.required<string>();
  readonly singular = input.required<string>();
  readonly elementos = input.required<(Cliente | Trabajador)[]>();

  readonly nuevo = signal('');
  readonly editandoId = signal<number | null>(null);
  readonly nombreEditado = signal('');
  readonly ocupado = signal(false);

  crear(): void {
    const nombre = this.nuevo().trim();
    if (!nombre || this.ocupado()) return;

    this.ejecutar(
      this.tipo() === 'cliente'
        ? this.api.crearCliente(nombre)
        : this.api.crearTrabajador(nombre),
      `${this.mayuscula()} añadido`,
      () => this.nuevo.set(''),
    );
  }

  empezarEdicion(elemento: Cliente | Trabajador): void {
    this.editandoId.set(elemento.id);
    this.nombreEditado.set(elemento.nombre);
  }

  cancelar(): void {
    this.editandoId.set(null);
  }

  guardarNombre(id: number): void {
    const nombre = this.nombreEditado().trim();
    if (!nombre || this.ocupado()) return;

    this.ejecutar(
      this.tipo() === 'cliente'
        ? this.api.renombrarCliente(id, nombre)
        : this.api.renombrarTrabajador(id, nombre),
      'Nombre cambiado en todos sus documentos',
      () => this.editandoId.set(null),
    );
  }

  borrar(elemento: Cliente | Trabajador): void {
    this.dialogo
      .open(DialogoConfirmar, {
        data: {
          titulo: `¿Borrar a ${elemento.nombre}?`,
          mensaje:
            `Solo se puede borrar si no tiene pedidos, trabajos ni albaranes. ` +
            `Si los tiene, el servidor lo impedirá y dirá cuántos son.`,
          aceptar: 'Borrar',
          peligroso: true,
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.ejecutar(
          this.tipo() === 'cliente'
            ? this.api.borrarCliente(elemento.id)
            : this.api.borrarTrabajador(elemento.id),
          `${this.mayuscula()} borrado`,
        );
      });
  }

  /**
   * Tras cualquier cambio se recargan los maestros: los desplegables del resto
   * de pantallas leen de ahí y seguirían enseñando los nombres viejos.
   */
  private ejecutar(peticion: Observable<unknown>, exito: string, despues?: () => void): void {
    this.ocupado.set(true);
    peticion.subscribe({
      next: () => {
        this.ocupado.set(false);
        despues?.();
        this.maestros.recargar();
        this.avisos.correcto(exito);
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.avisos.error(fallo, 'No se ha podido completar la operación');
      },
    });
  }

  private mayuscula(): string {
    const s = this.singular();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
