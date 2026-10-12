import { Component, computed, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Descargas } from '../nucleo/descargas';
import { Maestros } from '../nucleo/maestros';
import { Albaran, MaterialLinea } from '../nucleo/modelos';
import { DialogoConfirmar } from '../comun/dialogo-confirmar';
import { FilasMateriales } from '../comun/filas-materiales';
import { GaleriaFotos } from '../comun/galeria-fotos';
import { LienzoFirma } from '../comun/lienzo-firma';
import { SelectorFotos } from '../comun/selector-fotos';
import { SelectorMaestro } from '../comun/selector-maestro';
import { SrcSeguro } from '../comun/src-seguro';

const MAX_FOTOS = 5;

/**
 * Ficha del albarán. Territorio exclusivo del jefe.
 *
 * A diferencia del pedido y del trabajo, aquí se puede editar el NÚMERO (el
 * jefe reencauza la serie si algo salió torcido) y la FECHA, que aquí la elige
 * él y no la pone el servidor.
 *
 * Editar este albarán no toca el trabajo del que salió: es una copia
 * instantánea a propósito, para que el documento archivado no cambie si luego
 * se corrige el trabajo.
 */
@Component({
  selector: 'app-detalle-albaran',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    GaleriaFotos,
    FilasMateriales,
    MatCheckboxModule,
    MatSelectModule,
    SelectorFotos,
    SelectorMaestro,
    SrcSeguro,
  ],
  templateUrl: './detalle-albaran.html',
  styleUrl: './detalle-albaran.scss',
})
export class DetalleAlbaran implements OnInit {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly dialogo = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  private readonly descargas = inject(Descargas);

  private readonly selector = viewChild(SelectorFotos);

  readonly id = input.required<string>();

  readonly maestros = inject(Maestros);

  readonly albaran = signal<Albaran | null>(null);
  readonly cargando = signal(true);
  readonly ocupado = signal(false);
  readonly fallo = signal<string | null>(null);

  readonly editando = signal(false);
  readonly numero = signal('');
  readonly fecha = signal('');
  readonly clienteId = signal<number | null>(null);
  readonly dniCliente = signal('');
  readonly trabajadorIds = signal<number[]>([]);
  readonly descripcion = signal('');

  // Precios: el jefe los pone aquí y el coste se recalcula al vuelo.
  readonly horas = signal('');
  readonly materiales = signal<MaterialLinea[]>([]);
  readonly precioHora = signal('');
  readonly importeExtra = signal('');
  readonly incluirTotal = signal(false);
  readonly errores = signal<Record<string, string>>({});

  /**
   * El coste mientras se teclea, sin esperar a guardar.
   *
   * Repite la misma aritmética que el servidor (redondeo por línea incluido)
   * para que el jefe vea el total al momento. Manda el del servidor: al
   * guardar, el albarán se recarga con el suyo.
   */
  readonly costeSumadoEnVivo = computed(() => {
    const lineas = this.materiales().reduce((suma, linea) => {
      if (linea.cantidad === null || linea.precio === null || linea.precio === undefined) {
        return suma;
      }
      return suma + redondear(linea.cantidad * linea.precio);
    }, 0);
    const horas = aNumero(this.horas());
    const precio = aNumero(this.precioHora());
    const mano = horas !== null && precio !== null ? redondear(horas * precio) : 0;
    return redondear(lineas + mano);
  });

  readonly costeTotalEnVivo = computed(() =>
    redondear(this.costeSumadoEnVivo() + (aNumero(this.importeExtra()) ?? 0)),
  );

  readonly fotosNuevas = signal<Blob[]>([]);
  readonly huecos = computed(() => MAX_FOTOS - (this.albaran()?.fotoIds.length ?? 0));

  /**
   * Se le añade una marca de tiempo para saltarse la caché del navegador.
   * Sin eso, al firmar de nuevo se seguiría viendo la firma anterior: la URL
   * es la misma y el navegador da por buena la imagen que ya tenía.
   */
  readonly urlFirma = signal('');

  readonly urlFoto = computed(() => {
    const id = Number(this.id());
    return (fotoId: number) => this.api.urlFotoAlbaran(id, fotoId);
  });

  /** Ver el comentario de DetallePedido: los inputs no existen en el constructor. */
  ngOnInit(): void {
    this.maestros.asegurarCargados();
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);

    this.api.albaran(Number(this.id())).subscribe({
      next: (albaran) => {
        this.aplicar(albaran);
        this.cargando.set(false);
      },
      error: (fallo) => {
        this.cargando.set(false);
        this.fallo.set(this.avisos.textoDe(fallo, 'No se ha podido cargar el albarán'));
      },
    });
  }

  /** Los nombres de los trabajadores del albarán, separados por comas. */
  nombresTrabajadores(albaran: Albaran): string {
    return albaran.trabajadores.map((t) => t.nombre).join(', ') || '—';
  }

  empezarEdicion(): void {
    const a = this.albaran();
    if (!a) return;
    this.numero.set(String(a.numero));
    this.fecha.set(a.fecha);
    this.clienteId.set(a.clienteId);
    this.dniCliente.set(a.dniCliente ?? '');
    this.trabajadorIds.set(a.trabajadores.map((t) => t.id));
    this.descripcion.set(a.descripcion);
    this.horas.set(a.horas !== null ? String(a.horas).replace('.', ',') : '');
    this.materiales.set(a.materiales);
    this.precioHora.set(a.precioHora !== null ? String(a.precioHora).replace('.', ',') : '');
    this.importeExtra.set(a.importeExtra !== null ? String(a.importeExtra).replace('.', ',') : '');
    this.incluirTotal.set(a.incluirTotal);
    this.errores.set({});
    this.editando.set(true);
  }

  cancelarEdicion(): void {
    this.editando.set(false);
    this.errores.set({});
  }

  guardar(): void {
    const a = this.albaran();
    if (!a || this.ocupado()) return;

    const numero = Number(this.numero().trim());
    if (!Number.isInteger(numero) || numero < 1) {
      this.errores.set({ numero: 'El número debe ser un entero de 1 en adelante' });
      return;
    }

    this.ocupado.set(true);
    this.errores.set({});

    this.api
      .editarAlbaran(a.id, {
        numero,
        fecha: this.fecha(),
        clienteId: this.clienteId() ?? undefined,
        dniCliente: this.dniCliente().trim(),
        trabajadorIds: this.trabajadorIds(),
        descripcion: this.descripcion().trim(),
        horas: aNumero(this.horas()),
        materiales: this.materiales(),
        precioHora: aNumero(this.precioHora()),
        importeExtra: aNumero(this.importeExtra()),
        incluirTotal: this.incluirTotal(),
      })
      .subscribe({
        next: (actualizado) => {
          this.aplicar(actualizado);
          this.editando.set(false);
          this.ocupado.set(false);
          this.avisos.correcto('Albarán actualizado');
        },
        error: (fallo) => {
          this.ocupado.set(false);
          this.errores.set(this.avisos.camposDe(fallo));
          // El choque de número (409) llega con su mensaje explicando cuál.
          this.avisos.error(fallo, 'No se han podido guardar los cambios');
        },
      });
  }

  /** El documento para imprimir y archivar: lleva la firma y las fotos. */
  descargarPdf(): void {
    const a = this.albaran();
    if (!a || this.ocupado()) return;

    this.ocupado.set(true);
    this.descargas
      .descargar(
        this.api.urlPdfAlbaran(a.id),
        `albaran-${a.numero}.pdf`,
        'No se ha podido descargar el albarán en PDF'
      )
      .then(() => this.ocupado.set(false));
  }

  firmar(): void {
    const a = this.albaran();
    if (!a || this.ocupado()) return;

    this.dialogo
      .open(LienzoFirma, { width: '640px', maxWidth: '96vw', disableClose: true })
      .afterClosed()
      .subscribe((firma: Blob | null | undefined) => {
        if (!firma) return;
        this.ocupado.set(true);
        this.api.guardarFirma(a.id, firma).subscribe({
          next: (actualizado) => {
            this.aplicar(actualizado);
            this.ocupado.set(false);
            this.avisos.correcto('Firma guardada');
          },
          error: (fallo) => {
            this.ocupado.set(false);
            this.avisos.error(fallo, 'No se ha podido guardar la firma');
          },
        });
      });
  }

  subirFotos(): void {
    const a = this.albaran();
    const fotos = this.fotosNuevas();
    if (!a || fotos.length === 0 || this.ocupado()) return;

    this.ocupado.set(true);
    this.api.subirFotosAlbaran(a.id, fotos).subscribe({
      next: (fotoIds) => {
        this.albaran.set({ ...a, fotoIds });
        this.selector()?.vaciar();
        this.ocupado.set(false);
        this.avisos.correcto('Fotos añadidas');
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.avisos.error(fallo, 'No se han podido subir las fotos');
      },
    });
  }

  borrarFoto(fotoId: number): void {
    const a = this.albaran();
    if (!a || this.ocupado()) return;

    this.confirmar({
      titulo: 'Borrar la foto',
      mensaje: 'Esta foto se borrará del albarán y no se puede recuperar.',
      aceptar: 'Borrar',
      peligroso: true,
    }).then((seguro) => {
      if (!seguro) return;
      this.ocupado.set(true);
      this.api.borrarFotoAlbaran(a.id, fotoId).subscribe({
        next: () => {
          this.albaran.set({ ...a, fotoIds: a.fotoIds.filter((f) => f !== fotoId) });
          this.ocupado.set(false);
          this.avisos.correcto('Foto borrada');
        },
        error: (fallo) => {
          this.ocupado.set(false);
          this.avisos.error(fallo, 'No se ha podido borrar la foto');
        },
      });
    });
  }

  borrar(): void {
    const a = this.albaran();
    if (!a || this.ocupado()) return;

    this.confirmar({
      titulo: 'Borrar el albarán',
      mensaje: `Se borrará el albarán nº ${a.numero} con su firma y sus fotos. No se puede deshacer.`,
      aceptar: 'Borrar',
      peligroso: true,
    }).then((seguro) => {
      if (!seguro) return;
      this.ocupado.set(true);
      this.api.borrarAlbaran(a.id).subscribe({
        next: () => {
          this.avisos.correcto('Albarán borrado');
          this.router.navigate(['/albaranes']);
        },
        error: (fallo) => {
          this.ocupado.set(false);
          this.avisos.error(fallo, 'No se ha podido borrar el albarán');
        },
      });
    });
  }

  private aplicar(albaran: Albaran): void {
    this.albaran.set(albaran);
    this.urlFirma.set(
      albaran.tieneFirma ? `${this.api.urlFirma(albaran.id)}?v=${Date.now()}` : ''
    );
  }

  private confirmar(datos: {
    titulo: string;
    mensaje: string;
    aceptar: string;
    peligroso: boolean;
  }): Promise<boolean> {
    return new Promise((resolver) => {
      this.dialogo
        .open(DialogoConfirmar, { data: datos, width: '440px' })
        .afterClosed()
        .subscribe((respuesta) => resolver(respuesta === true));
    });
  }
}

/** Del texto tecleado (con coma o con punto) al número que espera el servidor. */
function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio.length === 0) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

/** Dos decimales, como el servidor. */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
