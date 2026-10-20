import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Maestros } from '../nucleo/maestros';
import { MaterialCatalogoConPrecio } from '../nucleo/modelos';
import { DialogoConfirmar } from '../comun/dialogo-confirmar';

/**
 * Los materiales del catálogo, familia a familia. Solo jefe.
 *
 * Se elige una familia en el desplegable y salen sus materiales para crear,
 * editar o borrar. Cada uno lleva unidad y tres campos de precio; el total por
 * unidad = precio + precio·extra% + transporte se ve calcularse al teclear,
 * repitiendo la misma cuenta que el servidor (que es el que manda al guardar).
 *
 * Borrar un material no rompe ningún documento: cada trabajo y albarán guarda
 * su propia copia del nombre, la unidad y el precio.
 */
@Component({
  selector: 'app-catalogo-materiales',
  imports: [
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h3>Materiales</h3>

    <mat-form-field appearance="outline" class="ancho">
      <mat-label>Familia</mat-label>
      <mat-select [value]="familiaId()" (valueChange)="elegirFamilia($event)" [disabled]="ocupado()">
        @for (familia of maestros.familias(); track familia.id) {
          <mat-option [value]="familia.id">{{ familia.nombre }}</mat-option>
        }
      </mat-select>
      @if (maestros.familias().length === 0) {
        <mat-hint>Crea antes una familia, en la tarjeta de arriba.</mat-hint>
      }
    </mat-form-field>

    @if (familiaId() !== null) {
      @if (deLaFamilia().length === 0 && editandoId() === null) {
        <p class="vacio">Esta familia aún no tiene materiales.</p>
      }

      <ul class="lista">
        @for (material of deLaFamilia(); track material.id) {
          <li>
            <span class="nombre crece">
              {{ material.nombre }} <small>({{ material.unidad }})</small>
            </span>
            <span class="precio">
              @if (material.precioTotal !== null) {
                {{ material.precioTotal | number: '1.2-2' }} €/{{ material.unidad }}
              } @else {
                <small>sin precio</small>
              }
            </span>
            <button matIconButton [attr.aria-label]="'Editar ' + material.nombre" [disabled]="ocupado()" (click)="editar(material)">
              <mat-icon>edit</mat-icon>
            </button>
            <button matIconButton [attr.aria-label]="'Borrar ' + material.nombre" [disabled]="ocupado()" (click)="borrar(material)">
              <mat-icon>delete</mat-icon>
            </button>
          </li>
        }
      </ul>

      @if (editandoId() === null) {
        <button matButton (click)="nuevo()" [disabled]="ocupado()">
          <mat-icon>add</mat-icon> Nuevo material
        </button>
      } @else {
        <form class="formulario" (ngSubmit)="guardar()">
          <h4>{{ editandoId() === 0 ? 'Nuevo material' : 'Editar material' }}</h4>

          <div class="fila">
            <mat-form-field appearance="outline" class="crece">
              <mat-label>Nombre</mat-label>
              <input matInput name="nombre" [ngModel]="nombre()" (ngModelChange)="nombre.set($event)" [disabled]="ocupado()" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="corto">
              <mat-label>Unidad</mat-label>
              <input matInput name="unidad" placeholder="m, ud, kg" [ngModel]="unidad()" (ngModelChange)="unidad.set($event)" [disabled]="ocupado()" />
            </mat-form-field>
          </div>

          <!-- type="text" con inputmode="decimal", no type="number": es la regla
               de los campos numéricos de este proyecto, y deja teclear con coma. -->
          <div class="fila">
            <mat-form-field appearance="outline" class="crece">
              <mat-label>Precio del material</mat-label>
              <input matInput name="precio" type="text" inputmode="decimal" [ngModel]="precio()" (ngModelChange)="precio.set($event)" [disabled]="ocupado()" />
              <span matTextSuffix>€</span>
            </mat-form-field>
            <mat-form-field appearance="outline" class="crece">
              <mat-label>Extra sobre el material</mat-label>
              <input matInput name="porcentajeExtra" type="text" inputmode="decimal" [ngModel]="extra()" (ngModelChange)="extra.set($event)" [disabled]="ocupado()" />
              <span matTextSuffix>%</span>
            </mat-form-field>
            <mat-form-field appearance="outline" class="crece">
              <mat-label>Transporte</mat-label>
              <input matInput name="transporte" type="text" inputmode="decimal" [ngModel]="transporte()" (ngModelChange)="transporte.set($event)" [disabled]="ocupado()" />
              <span matTextSuffix>€</span>
            </mat-form-field>
          </div>

          <div class="total">
            <span>Precio total por {{ unidad() || 'unidad' }}</span>
            <strong>
              @if (totalEnVivo() !== null) { {{ totalEnVivo() | number: '1.2-2' }} € } @else { — }
            </strong>
          </div>
          <p class="formula">precio + precio × extra % + transporte</p>

          <div class="acciones">
            <button matButton type="button" (click)="cancelar()" [disabled]="ocupado()">Cancelar</button>
            <button matButton="filled" type="submit" [disabled]="ocupado()">Guardar material</button>
          </div>
        </form>
      }
    }
  `,
  styles: `
    .ancho { width: 100%; }
    /* Nombre y unidad en una fila, y los tres campos del precio en otra.
       flex-basis 0 y width auto porque los mat-form-field van al 100 % de
       ancho por defecto: así cada uno ocupaba una fila entera. */
    .fila { display: flex; gap: 8px; }
    .fila mat-form-field { width: auto; }
    .crece { flex: 1 1 0; min-width: 0; }
    .corto { flex: 0 0 110px; }

    .lista { list-style: none; margin: 0 0 8px; padding: 0; }
    .lista li {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 48px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    .precio { white-space: nowrap; padding: 0 4px; }
    small { opacity: 0.65; }
    .vacio { opacity: 0.7; }

    .formulario {
      margin-top: 12px;
      padding: 12px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.04);
    }
    .formulario h4 { margin: 0 0 8px; }

    .total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-top: 8px;
      border-top: 2px solid rgba(0, 0, 0, 0.25);
      font-size: 17px;
    }
    .formula { margin: 2px 0 8px; font-size: 12px; opacity: 0.6; }
    .acciones { display: flex; justify-content: flex-end; gap: 8px; }
  `,
})
export class CatalogoMateriales implements OnInit {
  private readonly api = inject(ApiTaller);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);
  readonly maestros = inject(Maestros);

  readonly materiales = signal<MaterialCatalogoConPrecio[]>([]);
  readonly familiaId = signal<number | null>(null);
  readonly ocupado = signal(false);

  /** null: no se edita nada. 0: material nuevo. Otro: el id que se edita. */
  readonly editandoId = signal<number | null>(null);
  readonly nombre = signal('');
  readonly unidad = signal('ud');
  readonly precio = signal('');
  readonly extra = signal('');
  readonly transporte = signal('');

  readonly deLaFamilia = computed(() =>
    this.materiales().filter((m) => m.familiaId === this.familiaId()),
  );

  /** La misma cuenta que MaterialCatalogo.precioTotal() en el servidor. */
  readonly totalEnVivo = computed<number | null>(() => {
    const precio = aNumero(this.precio());
    if (precio === null) return null;
    const extra = aNumero(this.extra()) ?? 0;
    const transporte = aNumero(this.transporte()) ?? 0;
    return Math.round((precio + (precio * extra) / 100 + transporte) * 100) / 100;
  });

  ngOnInit(): void {
    this.maestros.asegurarCargados();
    this.cargar();
  }

  elegirFamilia(id: number): void {
    this.familiaId.set(id);
    this.editandoId.set(null);
  }

  nuevo(): void {
    this.rellenar(0, '', 'ud', null, 0, 0);
  }

  editar(material: MaterialCatalogoConPrecio): void {
    this.rellenar(material.id, material.nombre, material.unidad, material.precio,
      material.porcentajeExtra, material.transporte);
  }

  cancelar(): void {
    this.editandoId.set(null);
  }

  guardar(): void {
    const familiaId = this.familiaId();
    const editando = this.editandoId();
    if (familiaId === null || editando === null || this.ocupado()) return;

    const datos = {
      familiaId,
      nombre: this.nombre().trim(),
      unidad: this.unidad().trim(),
      precio: aNumero(this.precio()),
      porcentajeExtra: aNumero(this.extra()),
      transporte: aNumero(this.transporte()),
    };
    const peticion = editando === 0
      ? this.api.crearMaterialCatalogo(datos)
      : this.api.editarMaterialCatalogo(editando, datos);

    this.ocupado.set(true);
    peticion.subscribe({
      next: () => {
        this.editandoId.set(null);
        this.despuesDeCambiar('Material guardado');
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.avisos.error(fallo, 'No se ha podido guardar el material');
      },
    });
  }

  borrar(material: MaterialCatalogoConPrecio): void {
    this.dialogo
      .open(DialogoConfirmar, {
        data: {
          titulo: `¿Borrar ${material.nombre}?`,
          mensaje:
            'Desaparece del catálogo y no se podrá elegir en trabajos nuevos. ' +
            'Los trabajos y albaranes que ya lo llevan no cambian: guardan su propia copia.',
          aceptar: 'Borrar',
          peligroso: true,
        },
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.ocupado.set(true);
        this.api.borrarMaterialCatalogo(material.id).subscribe({
          next: () => this.despuesDeCambiar('Material borrado'),
          error: (fallo) => {
            this.ocupado.set(false);
            this.avisos.error(fallo, 'No se ha podido borrar el material');
          },
        });
      });
  }

  private cargar(): void {
    this.api.catalogoConPrecios().subscribe({
      next: (lista) => {
        this.materiales.set(lista);
        this.ocupado.set(false);
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.avisos.error(fallo, 'No se ha podido cargar el catálogo');
      },
    });
  }

  /**
   * Además de la lista de aquí, hay que recargar los maestros: los desplegables
   * de materiales de los trabajos leen de ahí y seguirían con la lista vieja.
   */
  private despuesDeCambiar(mensaje: string): void {
    this.cargar();
    this.maestros.recargar();
    this.avisos.correcto(mensaje);
  }

  private rellenar(id: number, nombre: string, unidad: string, precio: number | null,
                   extra: number, transporte: number): void {
    this.editandoId.set(id);
    this.nombre.set(nombre);
    this.unidad.set(unidad);
    this.precio.set(aTexto(precio));
    this.extra.set(aTexto(extra));
    this.transporte.set(aTexto(transporte));
  }
}

function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio.length === 0) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

function aTexto(valor: number | null): string {
  return valor === null || valor === undefined ? '' : String(valor).replace('.', ',');
}
