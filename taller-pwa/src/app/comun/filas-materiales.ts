import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Maestros } from '../nucleo/maestros';
import { MaterialCatalogo, MaterialLinea } from '../nucleo/modelos';

/** Una fila mientras se edita: los números, como TEXTO. */
interface Fila {
  /**
   * Lo que hay en el campo del material: un NÚMERO si se ha elegido un material
   * del catálogo (su id), o el TEXTO que se está escribiendo para buscar. Es lo
   * que entrega el autocompletado: el texto mientras se teclea y el valor de la
   * opción al elegirla.
   */
  valor: string | number | null;
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
 * El material se elige en un campo que es desplegable y buscador a la vez:
 * - la flecha de la derecha abre el catálogo entero, agrupado por familias,
 *   para quien prefiera deslizar;
 * - si se escribe, la lista se filtra al momento por cualquier trozo del
 *   nombre ("nill" encuentra "Tornillo" y "Anilla"), sin mirar mayúsculas ni
 *   tildes, que en una tablet nadie pone.
 * Con un catálogo de cientos de materiales, deslizar hasta el que toca con
 * guantes era lento; buscar lo resuelve, y la lista completa sigue ahí.
 *
 * Solo vale lo que se elige de la lista: si se escribe algo y no se elige, el
 * campo avisa y esa fila no cuenta. El servidor lo exige igual.
 *
 * Las líneas que vienen sin catálogo (anteriores a él, o cuyo material se
 * borró) se enseñan con su nombre como texto fijo: se pueden quitar o cambiar de
 * cantidad, pero no convertir en otro material.
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
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './filas-materiales.html',
  styleUrl: './filas-materiales.scss',
})
export class FilasMateriales implements OnInit {
  private readonly maestros = inject(Maestros);

  /** Se leen UNA vez, al crear el componente. Ver el comentario de la clase. */
  readonly lineasIniciales = input<MaterialLinea[]>([]);
  readonly conPrecio = input(false);
  readonly deshabilitado = input(false);

  readonly cambio = output<MaterialLinea[]>();

  readonly filas = signal<Fila[]>([]);

  readonly catalogoVacio = computed(() => this.maestros.catalogo().length === 0);

  /**
   * Nombres de los materiales de las líneas iniciales. Hacen falta para pintar
   * el nombre de un material ya elegido aunque el catálogo aún no haya llegado
   * del servidor: el autocompletado traduce el id a texto UNA vez, al cargar.
   */
  private readonly nombresIniciales = new Map<number, string>();

  ngOnInit(): void {
    this.maestros.asegurarCargados();
    const iniciales = this.lineasIniciales();
    for (const linea of iniciales) {
      if (linea.catalogoId && linea.nombre) this.nombresIniciales.set(linea.catalogoId, linea.nombre);
    }
    this.filas.set(
      iniciales.length > 0
        ? iniciales.map((linea) => ({
            valor: linea.catalogoId ?? null,
            nombreAntiguo: linea.catalogoId ? null : (linea.nombre ?? ''),
            unidadAntigua: linea.catalogoId ? null : (linea.unidad ?? null),
            cantidad: texto(linea.cantidad),
            precio: texto(linea.precio),
          }))
        : [filaVacia()],
    );
  }

  /**
   * Lo que pinta el campo cuando el valor es un material elegido. Es una
   * propiedad (función flecha) y no un método porque el autocompletado la
   * llama suelta, sin "this".
   */
  readonly nombreDe = (valor: string | number | null): string => {
    if (typeof valor !== 'number') return valor ?? '';
    return (
      this.maestros.catalogo().find((m) => m.id === valor)?.nombre ??
      this.nombresIniciales.get(valor) ??
      ''
    );
  };

  /**
   * Los grupos que se enseñan en la lista de esta fila.
   *
   * Sin texto escrito (o con un material ya elegido), el catálogo entero: así
   * la flecha sirve también para cambiar de material. Con texto, solo los
   * materiales cuyo nombre CONTIENE lo escrito, en cualquier posición, sin
   * mayúsculas ni tildes: "nill" encuentra "Tornillo" y "Anilla".
   */
  gruposPara(fila: Fila): GrupoFamilia[] {
    const consulta = typeof fila.valor === 'string' ? normalizar(fila.valor.trim()) : '';
    const grupos: GrupoFamilia[] = [];
    for (const material of this.maestros.catalogo()) {
      if (consulta && !normalizar(material.nombre).includes(consulta)) continue;
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.familia === material.familia) ultimo.materiales.push(material);
      else grupos.push({ familia: material.familia, materiales: [material] });
    }
    return grupos;
  }

  /** Hay algo escrito pero no se ha elegido ningún material de la lista. */
  sinElegir(fila: Fila): boolean {
    return typeof fila.valor === 'string' && fila.valor.trim().length > 0;
  }

  unidadDe(fila: Fila): string | null {
    if (fila.nombreAntiguo !== null) return fila.unidadAntigua;
    if (typeof fila.valor !== 'number') return null;
    return this.maestros.catalogo().find((m) => m.id === fila.valor)?.unidad ?? null;
  }

  /**
   * La flecha: abre la lista ENTERA. Si había una búsqueda a medias sin elegir
   * nada, se borra, porque si no la lista seguiría filtrada por ella.
   */
  verTodos(indice: number, disparador: MatAutocompleteTrigger, evento: Event): void {
    evento.stopPropagation();
    if (this.sinElegir(this.filas()[indice])) this.cambiarValor(indice, '');
    disparador.openPanel();
  }

  anadir(): void {
    this.filas.update((filas) => [...filas, filaVacia()]);
    this.emitir();
  }

  quitar(indice: number): void {
    this.filas.update((filas) => filas.filter((_, i) => i !== indice));
    this.emitir();
  }

  cambiarValor(indice: number, valor: string | number | null): void {
    this.actualizar(indice, (fila) => ({ ...fila, valor }));
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
   * Se emiten solo las filas con material ELEGIDO (o las antiguas): ni la fila
   * vacía del final ni una búsqueda a medias son un material.
   */
  private emitir(): void {
    const lineas: MaterialLinea[] = this.filas()
      .filter((fila) => typeof fila.valor === 'number' || fila.nombreAntiguo !== null)
      .map((fila) => ({
        catalogoId: typeof fila.valor === 'number' ? fila.valor : null,
        nombre: fila.nombreAntiguo,
        cantidad: numero(fila.cantidad),
        precio: this.conPrecio() ? numero(fila.precio) : null,
      }));
    this.cambio.emit(lineas);
  }
}

function filaVacia(): Fila {
  return { valor: null, nombreAntiguo: null, unidadAntigua: null, cantidad: '', precio: '' };
}

/**
 * Para comparar al buscar: sin mayúsculas y sin tildes. NFD separa cada letra
 * de su tilde, y luego se quitan las tildes sueltas: "Tubería" queda "tuberia".
 */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
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
