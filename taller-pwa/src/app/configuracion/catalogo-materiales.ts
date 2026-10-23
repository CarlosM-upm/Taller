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
import { aNumero, aTexto } from '../nucleo/numeros';
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
  templateUrl: './catalogo-materiales.html',
  styleUrl: './catalogo-materiales.scss',
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
