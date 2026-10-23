import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiTaller } from '../nucleo/api';
import { Maestros } from '../nucleo/maestros';
import { Avisos } from '../nucleo/avisos';
import { Descargas } from '../nucleo/descargas';
import { Sesion } from '../nucleo/sesion';
import { Trabajo, TrabajoDatos, MaterialLinea } from '../nucleo/modelos';
import { confirmar } from '../comun/dialogo-confirmar';
import { FilasMateriales } from '../comun/filas-materiales';
import { TarjetaFotos } from '../comun/tarjeta-fotos';
import { SelectorMaestro } from '../comun/selector-maestro';
import { AlbaranDelTrabajo } from './albaran-del-trabajo';
import { FirmaDelTrabajo } from './firma-del-trabajo';
import { queFaltaParaEnviar } from './para-enviar';

const MAX_FOTOS = 5;

/**
 * Ficha de un trabajo: donde vive el ciclo borrador → enviado.
 *
 * Mientras es borrador cualquiera lo edita y puede guardarlo incompleto.
 * Al enviarlo, el servidor comprueba que esté completo y estampa la fecha,
 * y a partir de ahí pasa a ser territorio del jefe: el trabajador puede
 * seguir consultándolo, pero no tocarlo.
 *
 * Los campos que faltan se calculan también aquí para avisar en el momento,
 * sin gastar un viaje al servidor. Pero quien decide sigue siendo el backend:
 * si su respuesta no coincide con lo que creíamos, se muestra la suya.
 */
@Component({
  selector: 'app-detalle-trabajo',
  imports: [
    AlbaranDelTrabajo,
    FirmaDelTrabajo,
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    FilasMateriales,
    TarjetaFotos,
    SelectorMaestro,
  ],
  templateUrl: './detalle-trabajo.html',
  styleUrl: './detalle-trabajo.scss',
})
export class DetalleTrabajo implements OnInit {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly dialogo = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  private readonly descargas = inject(Descargas);
  readonly sesion = inject(Sesion);

  readonly id = input.required<string>();

  readonly maestros = inject(Maestros);

  readonly trabajo = signal<Trabajo | null>(null);
  readonly cargando = signal(true);
  readonly ocupado = signal(false);
  readonly fallo = signal<string | null>(null);

  readonly clienteId = signal<number | null>(null);
  readonly trabajadorId = signal<number | null>(null);
  readonly descripcion = signal('');
  readonly materiales = signal<MaterialLinea[]>([]);
  readonly horas = signal('');
  readonly errorHoras = signal<string | null>(null);

  readonly esBorrador = computed(() => this.trabajo()?.estado === 'BORRADOR');

  /** Un trabajo enviado solo lo toca el jefe. */
  readonly puedeEditar = computed(
    () => this.trabajo() !== null && (this.esBorrador() || this.sesion.esJefe())
  );

  readonly maxFotos = MAX_FOTOS;
  readonly subirFotos = (fotos: Blob[]) => this.api.subirFotosTrabajo(Number(this.id()), fotos);
  readonly borrarFoto = (fotoId: number) => this.api.borrarFotoTrabajo(Number(this.id()), fotoId);

  readonly urlFoto = computed(() => {
    const id = Number(this.id());
    return (fotoId: number) => this.api.urlFotoTrabajo(id, fotoId);
  });

  /** Qué falta para poder enviarlo, con los nombres que ve el usuario. */
  readonly faltan = computed(() =>
    queFaltaParaEnviar({
      clienteId: this.clienteId(),
      trabajadorId: this.trabajadorId(),
      descripcion: this.descripcion(),
      materiales: this.materiales(),
      horas: this.horas(),
    }),
  );

  readonly hayCambios = computed(() => {
    const t = this.trabajo();
    if (!t) return false;
    return (
      this.clienteId() !== t.clienteId ||
      this.trabajadorId() !== t.trabajadorId ||
      this.descripcion().trim() !== (t.descripcion ?? '') ||
      JSON.stringify(this.materiales()) !== JSON.stringify(t.materiales) ||
      this.horas().trim() !== (t.horas !== null ? String(t.horas) : '')
    );
  });

  /**
   * OJO: la carga va en ngOnInit y NO en el constructor.
   *
   * Un input obligatorio de tipo signal todavía no tiene valor mientras se
   * construye el componente: el router lo inyecta después. Leer this.id()
   * en el constructor lanza NG0950 ("Input is required but no value is
   * available yet"), el componente no llega a crearse y el router aborta la
   * navegación. El efecto que se ve es que pinchar en la lista no hace nada,
   * sin ningún aviso. Ocurrió, y por eso existe la comprobación de humo (e2e/).
   */
  ngOnInit(): void {
    this.maestros.asegurarCargados();
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);

    this.api.trabajo(Number(this.id())).subscribe({
      next: (trabajo) => {
        this.aplicar(trabajo);
        this.cargando.set(false);
      },
      error: (fallo) => {
        this.cargando.set(false);
        this.fallo.set(this.avisos.textoDe(fallo, 'No se ha podido cargar el trabajo'));
      },
    });
  }

  guardar(): void {
    if (!this.puedeEditar() || this.ocupado()) return;
    const datos = this.datosDelFormulario();
    if (datos === null) return;

    this.ocupado.set(true);
    this.api.editarTrabajo(Number(this.id()), datos).subscribe({
      next: (trabajo) => {
        this.aplicar(trabajo);
        this.ocupado.set(false);
        this.avisos.correcto('Cambios guardados');
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.avisos.error(fallo, 'No se han podido guardar los cambios');
      },
    });
  }

  /**
   * Enviar guarda antes lo que haya cambiado. Si no, el usuario que rellena el
   * último campo y pulsa "Enviar" recibiría un "falta ese campo" que en su
   * pantalla está claramente escrito.
   */
  enviar(): void {
    if (this.ocupado()) return;

    const queFalta = this.faltan();
    if (queFalta.length > 0) {
      this.avisos.error(null, `Antes de enviar falta rellenar: ${queFalta.join(', ')}`);
      return;
    }

    const datos = this.datosDelFormulario();
    if (datos === null) return;

    confirmar(this.dialogo, {
      titulo: 'Enviar el trabajo',
      mensaje:
        'Al enviarlo se le pone fecha y deja de ser un borrador. A partir de ese momento solo el jefe podrá modificarlo.',
      aceptar: 'Enviar',
      peligroso: false,
    }).then((seguro) => {
      if (!seguro) return;
      this.ocupado.set(true);
      if (this.hayCambios()) this.guardarYEnviar(datos);
      else this.enviarYa();
    });
  }

  private guardarYEnviar(datos: TrabajoDatos): void {
    this.api.editarTrabajo(Number(this.id()), datos).subscribe({
      next: (trabajo) => {
        this.aplicar(trabajo);
        this.enviarYa();
      },
      error: (fallo) => {
        this.ocupado.set(false);
        this.avisos.error(fallo, 'No se han podido guardar los cambios antes de enviar');
      },
    });
  }

  private enviarYa(): void {
    this.api.enviarTrabajo(Number(this.id())).subscribe({
      next: (trabajo) => {
        this.aplicar(trabajo);
        this.ocupado.set(false);
        this.avisos.correcto('Trabajo enviado');
      },
      error: (fallo) => {
        this.ocupado.set(false);
        // El servidor manda: si dice que falta algo, se enseña su mensaje.
        this.avisos.error(fallo, 'No se ha podido enviar el trabajo');
      },
    });
  }

  /**
   * Solo jefe. Un borrador también se puede imprimir: sale con guiones donde
   * falten datos, que es lo que el jefe quiere ver si lo repasa en papel.
   */
  descargarPdf(): void {
    const t = this.trabajo();
    if (!t || this.ocupado()) return;

    this.ocupado.set(true);
    this.descargas
      .descargar(
        this.api.urlPdfTrabajo(t.id),
        `trabajo-${t.id}.pdf`,
        'No se ha podido descargar el trabajo en PDF'
      )
      .then(() => this.ocupado.set(false));
  }

  borrar(): void {
    const t = this.trabajo();
    if (!t || this.ocupado()) return;

    confirmar(this.dialogo, {
      titulo: this.esBorrador() ? 'Descartar el borrador' : 'Borrar el trabajo',
      mensaje: this.esBorrador()
        ? 'Se perderá lo apuntado hasta ahora, junto con sus fotos.'
        : 'Se borrará el trabajo y sus fotos. No se puede deshacer.',
      aceptar: this.esBorrador() ? 'Descartar' : 'Borrar',
      peligroso: true,
    }).then((seguro) => {
      if (!seguro) return;
      this.ocupado.set(true);
      this.api.borrarTrabajo(t.id).subscribe({
        next: () => {
          this.avisos.correcto(this.esBorrador() ? 'Borrador descartado' : 'Trabajo borrado');
          this.router.navigate(['/trabajos']);
        },
        error: (fallo) => {
          this.ocupado.set(false);
          this.avisos.error(fallo, 'No se ha podido borrar');
        },
      });
    });
  }

  /** También lo llama la tarjeta de firma, con el trabajo ya firmado. */
  protected aplicar(trabajo: Trabajo): void {
    this.trabajo.set(trabajo);
    this.clienteId.set(trabajo.clienteId);
    this.trabajadorId.set(trabajo.trabajadorId);
    this.descripcion.set(trabajo.descripcion ?? '');
    this.materiales.set(trabajo.materiales);
    this.horas.set(trabajo.horas !== null ? String(trabajo.horas) : '');
    this.errorHoras.set(null);
  }

  /** Devuelve null si las horas no valen, tras marcar el error. */
  private datosDelFormulario(): TrabajoDatos | null {
    const texto = this.horas().trim().replace(',', '.');
    let horas: number | null = null;

    if (texto.length > 0) {
      const numero = Number(texto);
      if (!Number.isFinite(numero) || numero <= 0) {
        this.errorHoras.set('Escribe un número de horas mayor que cero');
        return null;
      }
      horas = Math.round(numero * 100) / 100;
    }
    this.errorHoras.set(null);

    const vacioONulo = (v: string) => (v.trim().length > 0 ? v.trim() : null);
    return {
      clienteId: this.clienteId(),
      trabajadorId: this.trabajadorId(),
      descripcion: vacioONulo(this.descripcion()),
      materiales: this.materiales(),
      horas,
    };
  }

  /** Tras subir o borrar en la tarjeta de fotos. */
  fotosCambiadas(fotoIds: number[]): void {
    this.trabajo.update((actual) => (actual ? { ...actual, fotoIds } : actual));
  }
}
