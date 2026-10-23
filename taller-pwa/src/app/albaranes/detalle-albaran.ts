import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
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
import { aNumero, aTexto, redondear } from '../nucleo/numeros';
import { costeSumado } from './coste-en-vivo';
import { confirmar } from '../comun/dialogo-confirmar';
import { FilasMateriales } from '../comun/filas-materiales';
import { LienzoFirma } from '../comun/lienzo-firma';
import { TarjetaFotos } from '../comun/tarjeta-fotos';
import { SelectorMaestro } from '../comun/selector-maestro';
import { SrcSeguro } from '../comun/src-seguro';

/**
 * 15, como en el servidor (FotosAlbaran.MAX_FOTOS): un albarán unificado junta
 * las fotos de varios trabajos. Aquí ponía 5 y no dejaba añadir más.
 */
const MAX_FOTOS = 15;

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
    FilasMateriales,
    MatCheckboxModule,
    MatSelectModule,
    TarjetaFotos,
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
  readonly trabajadorIds = signal<number[]>([]);
  readonly descripcion = signal('');

  // Precios: el jefe los pone aquí y el coste se recalcula al vuelo.
  readonly horas = signal('');
  readonly materiales = signal<MaterialLinea[]>([]);
  readonly precioHora = signal('');
  readonly importeExtra = signal('');
  readonly incluirTotal = signal(false);
  readonly errores = signal<Record<string, string>>({});

  /** El coste mientras se teclea, sin esperar a guardar (ver coste-en-vivo.ts). */
  readonly costeSumadoEnVivo = computed(() =>
    costeSumado(this.materiales(), aNumero(this.horas()), aNumero(this.precioHora())),
  );

  readonly costeTotalEnVivo = computed(() =>
    redondear(this.costeSumadoEnVivo() + (aNumero(this.importeExtra()) ?? 0)),
  );

  /**
   * Se le añade una marca de tiempo para saltarse la caché del navegador.
   * Sin eso, al firmar de nuevo se seguiría viendo la firma anterior: la URL
   * es la misma y el navegador da por buena la imagen que ya tenía.
   */
  readonly urlFirma = signal('');

  readonly maxFotos = MAX_FOTOS;
  readonly subirFotos = (fotos: Blob[]) => this.api.subirFotosAlbaran(Number(this.id()), fotos);
  readonly borrarFoto = (fotoId: number) => this.api.borrarFotoAlbaran(Number(this.id()), fotoId);

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
    this.trabajadorIds.set(a.trabajadores.map((t) => t.id));
    this.descripcion.set(a.descripcion);
    this.horas.set(aTexto(a.horas));
    this.materiales.set(a.materiales);
    this.precioHora.set(aTexto(a.precioHora));
    this.importeExtra.set(aTexto(a.importeExtra));
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

  borrar(): void {
    const a = this.albaran();
    if (!a || this.ocupado()) return;

    confirmar(this.dialogo, {
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

  /** Tras subir o borrar en la tarjeta de fotos. */
  fotosCambiadas(fotoIds: number[]): void {
    this.albaran.update((actual) => (actual ? { ...actual, fotoIds } : actual));
  }
}
