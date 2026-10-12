import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MaterialLinea } from '../nucleo/modelos';

/** Una fila mientras se teclea: todo texto, incluidos los números. */
interface Fila {
  nombre: string;
  cantidad: string;
  precio: string;
}

/**
 * Las líneas de material: nombre y cantidad, más el precio en los albaranes.
 *
 * Empieza con una fila y crece con el botón "+", de una en una. Las cantidades
 * y los precios se guardan aquí como TEXTO, no como número, y se convierten al
 * emitirlos. Es la regla de los campos numéricos de este proyecto: con
 * type="number" Angular emite un número por ngModelChange mientras el
 * componente trabaja con texto, y además así se puede escribir "12,5" con coma,
 * que es como se teclea aquí.
 *
 * Los campos van con ngModelOptions standalone: este componente lleva su
 * propio estado y emite por (cambio), así que no tiene por qué registrarse en
 * el <form> del padre. Sin eso Angular avisa con NG01354 en cada pulsación.
 *
 * No se alimenta de vuelta desde el padre: las filas iniciales se leen una sola
 * vez al crear el componente. Si el padre devolviera la lista ya convertida en
 * cada pulsación, un "2," a medio escribir se convertiría en "2" y no habría
 * forma de teclear decimales.
 */
@Component({
  selector: 'app-filas-materiales',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <div class="materiales">
      <div class="encabezado">
        <span class="col-nombre">Material</span>
        <span class="col-cantidad">Cantidad</span>
        @if (conPrecio()) {
          <span class="col-precio">Precio/ud</span>
        }
        <span class="col-borrar"></span>
      </div>

      @for (fila of filas(); track $index) {
        <div class="fila">
          <mat-form-field appearance="outline" class="col-nombre">
            <input
              matInput
              [name]="'material-nombre-' + $index"
              placeholder="Tornillo 3mm"
              [ngModel]="fila.nombre"
              [ngModelOptions]="{ standalone: true }"
              (ngModelChange)="cambiarNombre($index, $event)"
              [disabled]="deshabilitado()"
            />
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-cantidad">
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
          </mat-form-field>

          @if (conPrecio()) {
            <mat-form-field appearance="outline" class="col-precio">
              <input
                matInput
                type="text"
                inputmode="decimal"
                [name]="'material-precio-' + $index"
                placeholder="3,33"
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

      <button
        matButton
        type="button"
        class="anadir"
        [disabled]="deshabilitado()"
        (click)="anadir()"
      >
        <mat-icon>add</mat-icon>
        Añadir material
      </button>
    </div>
  `,
  styles: `
    .materiales { display: block; }

    .encabezado {
      display: flex;
      gap: 8px;
      font-size: 12px;
      opacity: 0.7;
      padding: 0 4px 4px;
    }

    .fila {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    /* El nombre se lleva el espacio sobrante; cantidad y precio van fijos para
       que las columnas no bailen de una fila a otra. */
    .col-nombre { flex: 1 1 auto; min-width: 0; }
    .col-cantidad, .col-precio { flex: 0 0 104px; }
    .col-borrar { flex: 0 0 48px; }

    .encabezado .col-borrar { flex: 0 0 48px; }

    .anadir { margin-top: 4px; }
  `,
})
export class FilasMateriales implements OnInit {
  /** Se leen UNA vez, al crear el componente. Ver el comentario de la clase. */
  readonly lineasIniciales = input<MaterialLinea[]>([]);
  readonly conPrecio = input(false);
  readonly deshabilitado = input(false);

  readonly cambio = output<MaterialLinea[]>();

  readonly filas = signal<Fila[]>([]);

  ngOnInit(): void {
    const iniciales = this.lineasIniciales();
    this.filas.set(
      iniciales.length > 0
        ? iniciales.map((linea) => ({
            nombre: linea.nombre ?? '',
            cantidad: texto(linea.cantidad),
            precio: texto(linea.precio),
          }))
        : [filaVacia()],
    );
  }

  anadir(): void {
    this.filas.update((filas) => [...filas, filaVacia()]);
    this.emitir();
  }

  quitar(indice: number): void {
    this.filas.update((filas) => filas.filter((_, i) => i !== indice));
    this.emitir();
  }

  cambiarNombre(indice: number, valor: string): void {
    this.actualizar(indice, (fila) => ({ ...fila, nombre: valor }));
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
   * Se emiten solo las filas con algo escrito: la fila vacía del final, que
   * está ahí para que se pueda seguir escribiendo, no es un material.
   */
  private emitir(): void {
    const lineas = this.filas()
      .filter((fila) => fila.nombre.trim().length > 0 || fila.cantidad.trim().length > 0)
      .map((fila) => ({
        nombre: fila.nombre.trim(),
        cantidad: numero(fila.cantidad),
        precio: this.conPrecio() ? numero(fila.precio) : null,
      }));
    this.cambio.emit(lineas);
  }
}

function filaVacia(): Fila {
  return { nombre: '', cantidad: '', precio: '' };
}

/** Del número del servidor al texto del campo, con coma decimal. */
function texto(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace('.', ',');
}

/**
 * Del texto tecleado al número que espera el servidor. Devuelve null si no es
 * un número: la validación de verdad la hace el backend, que responde 400
 * señalando la fila exacta.
 */
function numero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio.length === 0) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}
