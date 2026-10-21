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
import { FamiliaMaterial, Trabajador } from '../nucleo/modelos';
import { DialogoConfirmar } from '../comun/dialogo-confirmar';

type Tipo = 'trabajador' | 'familia';
type Elemento = Trabajador | FamiliaMaterial;

/**
 * Alta, renombrado y borrado de trabajadores o familias de materiales. Los
 * clientes tienen su propia lista (lista-clientes), porque llevan DNI.
 *
 * Es el mismo componente para las tres listas porque se comportan igual: un
 * nombre, único, que no se puede borrar mientras tenga algo colgando
 * (documentos, o materiales en el caso de una familia). Lo que cambia son los
 * textos y a qué endpoints llama.
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
  readonly elementos = input.required<Elemento[]>();

  readonly nuevo = signal('');
  readonly editandoId = signal<number | null>(null);
  readonly nombreEditado = signal('');
  readonly ocupado = signal(false);

  crear(): void {
    const nombre = this.nuevo().trim();
    if (!nombre || this.ocupado()) return;

    const peticiones = {
      trabajador: () => this.api.crearTrabajador(nombre),
      familia: () => this.api.crearFamiliaMaterial(nombre),
    };
    this.ejecutar(
      peticiones[this.tipo()](),
      { trabajador: 'Trabajador añadido', familia: 'Familia añadida' }[
        this.tipo()
      ],
      () => this.nuevo.set(''),
    );
  }

  empezarEdicion(elemento: Elemento): void {
    this.editandoId.set(elemento.id);
    this.nombreEditado.set(elemento.nombre);
  }

  cancelar(): void {
    this.editandoId.set(null);
  }

  guardarNombre(id: number): void {
    const nombre = this.nombreEditado().trim();
    if (!nombre || this.ocupado()) return;

    const peticiones = {
      trabajador: () => this.api.renombrarTrabajador(id, nombre),
      familia: () => this.api.renombrarFamiliaMaterial(id, nombre),
    };
    this.ejecutar(
      peticiones[this.tipo()](),
      this.tipo() === 'familia' ? 'Familia renombrada' : 'Nombre cambiado en todos sus documentos',
      () => this.editandoId.set(null),
    );
  }

  borrar(elemento: Elemento): void {
    this.dialogo
      .open(DialogoConfirmar, {
        data: {
          titulo: `¿Borrar a ${elemento.nombre}?`,
          mensaje:
            this.tipo() === 'familia'
              ? `Solo se puede borrar si no tiene materiales dentro. ` +
                `Si los tiene, el servidor lo impedirá y dirá cuántos son.`
              : `Solo se puede borrar si no tiene pedidos, trabajos ni albaranes. ` +
                `Si los tiene, el servidor lo impedirá y dirá cuántos son.`,
          aceptar: 'Borrar',
          peligroso: true,
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        const peticiones = {
          trabajador: () => this.api.borrarTrabajador(elemento.id),
          familia: () => this.api.borrarFamiliaMaterial(elemento.id),
        };
        this.ejecutar(
          peticiones[this.tipo()](),
          { trabajador: 'Trabajador borrado', familia: 'Familia borrada' }[
            this.tipo()
          ],
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

}
