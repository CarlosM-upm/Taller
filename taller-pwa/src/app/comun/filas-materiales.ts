import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Maestros } from '../nucleo/maestros';
import { MaterialCatalogo, MaterialLinea } from '../nucleo/modelos';

/** Una fila mientras se edita: los números, como TEXTO. */
interface Fila {
  /** Material elegido del catálogo. Nulo en una fila nueva o en una antigua. */
  catalogoId: number | null;
  /** Solo para las líneas antiguas sin catálogo, que se enseñan tal cual. */
  nombreAntiguo: string | null;
  unidadAntigua: string | null;
  cantidad: string;
  precio: string;
}

interface GrupoFamilia {
  familia: string;
  materiales: MaterialCatalogo[];
}

/**
 * Las líneas de material: un material DEL CATÁLOGO y su cantidad, más el precio
 * en los albaranes. Empieza con una fila y crece con el botón "+".
 *
 * El material se elige de un solo desplegable con las familias como cabeceras,
 * en lugar de dos encadenados (familia y luego material): en una tablet, con
 * guantes, un toque menos se nota. La unidad sale pegada a la cantidad.
 *
 * Las líneas que vienen sin catálogo (anteriores a él, o cuyo material se
 * borró) se enseñan con su nombre como texto fijo: se pueden quitar o cambiar de
 * cantidad, pero no convertir en otro material. El servidor solo admite líneas
 * sin catálogo si ya existían en el documento.
 *
 * Reglas de este componente que no hay que romper:
 * - Los números se guardan como TEXTO y se convierten al emitir. Con
 *   type="number" Angular emite un número mientras el componente trabaja con
 *   texto, y así además se puede escribir "12,5" con coma.
 * - No se alimenta de vuelta desde el padre: las filas iniciales se leen una
 *   vez. Si la lista ya convertida volviera en cada pulsación, un "2," a medio
 *   escribir se quedaría en "2".
 * - Los campos van standalone: el componente lleva su propio estado y emite
 *   por (cambio), así que no tiene por qué registrarse en el <form> del padre
 *   (sin eso Angular avisa con NG01354).
 */
@Component({
  selector: 'app-filas-materiales',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <div class="materiales">
      @for (fila of filas(); track $index) {
        <div class="fila">
          @if (fila.nombreAntiguo !== null) {
            <div class="col-nombre antiguo" [attr.data-material]="fila.nombreAntiguo">
              <span>{{ fila.nombreAntiguo }}</span>
              <small>fuera del catálogo</small>
            </div>
          } @else {
            <mat-form-field appearance="outline" class="col-nombre">
              <mat-label>Material</mat-label>
              <mat-select
                [attr.data-fila]="$index"
                [value]="fila.catalogoId"
                (valueChange)="elegir($index, $event)"
                [disabled]="deshabilitado()"
              >
                @for (grupo of grupos(); track grupo.familia) {
                  <mat-optgroup [label]="grupo.familia">
                    @for (material of grupo.materiales; track material.id) {
                      <mat-option [value]="material.id">{{ material.nombre }}</mat-option>
                    }
                  </mat-optgroup>
                }
              </mat-select>
              @if (grupos().length === 0) {
                <mat-hint>El catálogo está vacío: se rellena en Ajustes.</mat-hint>
              }
            </mat-form-field>
          }

          <mat-form-field appearance="outline" class="col-cantidad">
            <mat-label>Cantidad</mat-label>
            <input
              matInput
              type="text"
              inputmode="decimal"
              [name]="'material-cantidad-' + $index"
              placeholder="5"
              [ngModel]="fila.cantidad"
              [ngModelOptions]="{ standalone: true }"
              (ngModelChange)="cambiarCantidad($index, $event)"
              [disabled]="deshabilitado()"
            />
            @if (unidadDe(fila); as unidad) {
              <span matTextSuffix>{{ unidad }}</span>
            }
          </mat-form-field>

          @if (conPrecio()) {
            <mat-form-field appearance="outline" class="col-precio">
              <mat-label>Precio/ud</mat-label>
              <input
                matInput
                type="text"
                inputmode="decimal"
                [name]="'material-precio-' + $index"
                placeholder="del catálogo"
                [ngModel]="fila.precio"
                [ngModelOptions]="{ standalone: true }"
                (ngModelChange)="cambiarPrecio($index, $event)"
                [disabled]="deshabilitado()"
              />
              <span matTextSuffix>€</span>
            </mat-form-field>
          }

          <button
            matIconButton
            type="button"
            class="col-borrar"
            aria-label="Quitar esta línea de material"
            [disabled]="deshabilitado() || filas().length === 1"
            (click)="quitar($index)"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      <button matButton type="button" class="anadir" [disabled]="deshabilitado()" (click)="anadir()">
        <mat-icon>add</mat-icon>
        Añadir material
      </button>
    </div>
  `,
  styles: `
    .materiales { display: block; }

    .fila {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    /* El material se lleva el espacio sobrante; cantidad y precio van fijos
       para que las columnas no bailen de una fila a otra. */
    .col-nombre { flex: 1 1 auto; min-width: 0; }
    .col-cantidad { flex: 0 0 120px; }
    .col-precio { flex: 0 0 120px; }
    .col-borrar { flex: 0 0 48px; margin-top: 4px; }

    .antiguo {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 56px;
      padding: 0 4px 22px;
    }
    .antiguo small { opacity: 0.6; }

    .anadir { margin-top: 4px; }
  `,
})
export class FilasMateriales implements OnInit {
  private readonly maestros = inject(Maestros);

  /** Se leen UNA vez, al crear el componente. Ver el comentario de la clase. */
  readonly lineasIniciales = input<MaterialLinea[]>([]);
  readonly conPrecio = input(false);
  readonly deshabilitado = input(false);

  readonly cambio = output<MaterialLinea[]>();

  readonly filas = signal<Fila[]>([]);

  /** El catálogo agrupado por familia, en el orden en que llega (familia, nombre). */
  readonly grupos = computed<GrupoFamilia[]>(() => {
    const grupos: GrupoFamilia[] = [];
    for (const material of this.maestros.catalogo()) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.familia === material.familia) ultimo.materiales.push(material);
      else grupos.push({ familia: material.familia, materiales: [material] });
    }
    return grupos;
  });

  ngOnInit(): void {
    this.maestros.asegurarCargados();
    const iniciales = this.lineasIniciales();
    this.filas.set(
      iniciales.length > 0
        ? iniciales.map((linea) => ({
            catalogoId: linea.catalogoId ?? null,
            nombreAntiguo: linea.catalogoId ? null : (linea.nombre ?? ''),
            unidadAntigua: linea.catalogoId ? null : (linea.unidad ?? null),
            cantidad: texto(linea.cantidad),
            precio: texto(linea.precio),
          }))
        : [filaVacia()],
    );
  }

  unidadDe(fila: Fila): string | null {
    if (fila.catalogoId === null) return fila.unidadAntigua;
    return this.maestros.catalogo().find((m) => m.id === fila.catalogoId)?.unidad ?? null;
  }

  anadir(): void {
    this.filas.update((filas) => [...filas, filaVacia()]);
    this.emitir();
  }

  quitar(indice: number): void {
    this.filas.update((filas) => filas.filter((_, i) => i !== indice));
    this.emitir();
  }

  elegir(indice: number, catalogoId: number): void {
    this.actualizar(indice, (fila) => ({ ...fila, catalogoId }));
  }

  cambiarCantidad(indice: number, valor: string): void {
    this.actualizar(indice, (fila) => ({ ...fila, cantidad: valor }));
  }

  cambiarPrecio(indice: number, valor: string): void {
    this.actualizar(indice, (fila) => ({ ...fila, precio: valor }));
  }

  private actualizar(indice: number, cambio: (fila: Fila) => Fila): void {
    this.filas.update((filas) => filas.map((fila, i) => (i === indice ? cambio(fila) : fila)));
    this.emitir();
  }

  /**
   * Se emiten solo las filas con material elegido (o las antiguas): la fila
   * vacía del final, que está para seguir añadiendo, no es un material.
   */
  private emitir(): void {
    const lineas: MaterialLinea[] = this.filas()
      .filter((fila) => fila.catalogoId !== null || fila.nombreAntiguo !== null)
      .map((fila) => ({
        catalogoId: fila.catalogoId,
        nombre: fila.nombreAntiguo,
        cantidad: numero(fila.cantidad),
        precio: this.conPrecio() ? numero(fila.precio) : null,
      }));
    this.cambio.emit(lineas);
  }
}

function filaVacia(): Fila {
  return { catalogoId: null, nombreAntiguo: null, unidadAntigua: null, cantidad: '', precio: '' };
}

/** Del número del servidor al texto del campo, con coma decimal. */
function texto(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace('.', ',');
}

/**
 * Del texto tecleado al número que espera el servidor. Nulo si no es un
 * número: la validación de verdad la hace el backend, que responde 400
 * señalando la fila exacta.
 */
function numero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio.length === 0) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}
