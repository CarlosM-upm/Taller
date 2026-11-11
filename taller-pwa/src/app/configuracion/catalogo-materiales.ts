import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Maestros } from '../nucleo/maestros';
import { MaterialCatalogoConPrecio } from '../nucleo/modelos';
import { aNumero, aTexto } from '../nucleo/numeros';
import { contiene } from '../nucleo/busqueda';
import { confirmar } from '../comun/dialogo-confirmar';
import { Paginacion } from '../comun/paginacion';

/**
 * Los materiales del catálogo. Solo jefe.
 *
 * Se ven todos, o los de una familia si se elige en el desplegable ("Todas las
 * familias" vuelve a todos). El buscador filtra dentro de lo que se ve, y la
 * lista va por páginas de 20, como los clientes. Cada material lleva unidad y
 * tres campos de precio; el total por unidad = precio + precio·extra% +
 * transporte se ve calcularse al teclear, repitiendo la misma cuenta que el
 * servidor (que es el que manda al guardar).
 *
 * Para AÑADIR hay que elegir antes la familia. Editar pregunta antes de guardar.
 * Borrar o editar un material no cambia ningún documento hecho: cada trabajo y
 * albarán guarda su propia copia del nombre, la unidad y el precio.
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
    Paginacion,
  ],
  templateUrl: './catalogo-materiales.html',
  styleUrl: './catalogo-materiales.scss',
})
export class CatalogoMateriales implements OnInit {
  private readonly api = inject(ApiTaller);
  private readonly avisos = inject(Avisos);
  private readonly dialogo = inject(MatDialog);
  readonly maestros = inject(Maestros);

  readonly materiales = signal<MaterialCatalogoConPrecio[]>([]);
  /** El filtro de la lista. null: todas las familias. */
  readonly familiaId = signal<number | null>(null);
  readonly ocupado = signal(false);

  /** null: no se edita nada. 0: material nuevo. Otro: el id que se edita. */
  readonly editandoId = signal<number | null>(null);
  /** La familia del material del formulario: no tiene por qué ser la del filtro. */
  private familiaDelFormulario: number | null = null;
  private nombreOriginal = '';
  readonly nombre = signal('');
  readonly unidad = signal('ud');
  readonly precio = signal('');
  readonly extra = signal('');
  readonly transporte = signal('');

  // --- Buscar y paginar ---
  readonly porPagina = POR_PAGINA;
  readonly busqueda = signal('');
  readonly pagina = signal(0);

  /** Los de la familia elegida (o de todas) cuyo nombre contiene lo buscado. */
  readonly visibles = computed(() => {
    const familia = this.familiaId();
    return this.materiales().filter(
      (m) => (familia === null || m.familiaId === familia) && contiene(m.nombre, this.busqueda()),
    );
  });

  /** Si al borrar se vacía la última página, se vuelve a la anterior. */
  readonly paginaActual = computed(() =>
    Math.min(this.pagina(), Math.max(0, Math.ceil(this.visibles().length / POR_PAGINA) - 1)),
  );

  readonly deLaPagina = computed(() => {
    const desde = this.paginaActual() * POR_PAGINA;
    return this.visibles().slice(desde, desde + POR_PAGINA);
  });

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

  /** Cada familia o búsqueda nueva empieza por la primera página. */
  elegirFamilia(id: number | null): void {
    this.familiaId.set(id);
    this.pagina.set(0);
    this.editandoId.set(null);
  }

  buscar(texto: string): void {
    this.busqueda.set(texto);
    this.pagina.set(0);
  }

  /** Se añade en la familia elegida en el filtro. */
  nuevo(): void {
    this.familiaDelFormulario = this.familiaId();
    this.nombreOriginal = '';
    this.rellenar(0, '', 'ud', null, 0, 0);
  }

  /** Se guarda en SU familia, aunque se esté viendo "Todas" u otra búsqueda. */
  editar(material: MaterialCatalogoConPrecio): void {
    this.familiaDelFormulario = material.familiaId;
    this.nombreOriginal = material.nombre;
    this.rellenar(material.id, material.nombre, material.unidad, material.precio,
      material.porcentajeExtra, material.transporte);
  }

  cancelar(): void {
    this.editandoId.set(null);
  }

  guardar(): void {
    const familiaId = this.familiaDelFormulario;
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
    if (editando === 0) {
      this.enviar(this.api.crearMaterialCatalogo(datos));
      return;
    }
    confirmar(this.dialogo, {
      titulo: `¿Guardar los cambios de ${this.nombreOriginal}?`,
      mensaje:
        'Los trabajos y albaranes que ya lo llevan no cambian: guardan su propia copia. ' +
        'Lo nuevo se usará a partir de ahora.',
      aceptar: 'Guardar',
    }).then((seguro) => {
      if (seguro) this.enviar(this.api.editarMaterialCatalogo(editando, datos));
    });
  }

  borrar(material: MaterialCatalogoConPrecio): void {
    confirmar(this.dialogo, {
      titulo: `¿Borrar ${material.nombre}?`,
      mensaje:
        'Desaparece del catálogo y no se podrá elegir en trabajos nuevos. ' +
        'Los trabajos y albaranes que ya lo llevan no cambian: guardan su propia copia.',
      aceptar: 'Borrar',
      peligroso: true,
    }).then((seguro) => {
      if (!seguro) return;
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

  private enviar(peticion: Observable<unknown>): void {
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

const POR_PAGINA = 20;
