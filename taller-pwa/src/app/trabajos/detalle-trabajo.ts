import { Component, computed, inject, input, OnInit, signal, viewChild } from '@angular/core';
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
import { Trabajo, TrabajoDatos, Albaran, MaterialLinea } from '../nucleo/modelos';
import { DialogoConfirmar } from '../comun/dialogo-confirmar';
import { DialogoGenerarAlbaran } from '../albaranes/dialogo-generar-albaran';
import { GaleriaFotos } from '../comun/galeria-fotos';
import { FilasMateriales } from '../comun/filas-materiales';
import { SelectorFotos } from '../comun/selector-fotos';
import { SelectorMaestro } from '../comun/selector-maestro';
import { LienzoFirma } from '../comun/lienzo-firma';
import { SrcSeguro } from '../comun/src-seguro';

const MAX_FOTOS = 5;

/** Los mismos que exige TrabajoService.camposQueFaltan() en el servidor. */
const OBLIGATORIOS_PARA_ENVIAR = [
  { campo: 'cliente', etiqueta: 'cliente' },
  { campo: 'trabajador', etiqueta: 'trabajador' },
  { campo: 'descripcion', etiqueta: 'qué se ha hecho' },
  { campo: 'materiales', etiqueta: 'materiales' },
  { campo: 'horas', etiqueta: 'horas' },
] as const;

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
    SrcSeguro,
    DatePipe,
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
    SelectorFotos,
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

  private readonly selector = viewChild(SelectorFotos);

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

  readonly fotosNuevas = signal<Blob[]>([]);

  /**
   * El albarán que salió de este trabajo, si ya existe.
   *
   * La API no dice en el trabajo si tiene albarán, así que se busca en la
   * lista de albaranes el que apunte a este trabajo. Es una llamada de más,
   * pero la lista es pequeña y evita tocar el backend. Si algún día crece
   * mucho, lo suyo sería añadir el dato a TrabajoResponse.
   */
  readonly albaran = signal<Albaran | null>(null);

  readonly esBorrador = computed(() => this.trabajo()?.estado === 'BORRADOR');

  /** Un trabajo enviado solo lo toca el jefe. */
  readonly puedeEditar = computed(
    () => this.trabajo() !== null && (this.esBorrador() || this.sesion.esJefe())
  );

  /**
   * Firmar lo puede hacer el trabajador en borrador y también en un enviado
   * SIN firma: lo normal es enviarlo desde el taller y que el cliente firme
   * después. Lo que no puede es sustituir la firma de un enviado; eso es del
   * jefe (y el servidor responde 403 aunque se fuerce desde aquí).
   */
  readonly puedeFirmar = computed(() => {
    const t = this.trabajo();
    if (!t) return false;
    return this.esBorrador() || !t.tieneFirma || this.sesion.esJefe();
  });

  /** Quitar la firma: en un borrador cualquiera, en un enviado solo el jefe. */
  readonly puedeQuitarFirma = computed(() => {
    const t = this.trabajo();
    return !!t && t.tieneFirma && (this.esBorrador() || this.sesion.esJefe());
  });

  /**
   * Con marca de tiempo para saltarse la caché del navegador: sin ella, al
   * firmar de nuevo se seguiría viendo la firma anterior (misma URL).
   */
  readonly urlFirma = signal('');

  readonly huecos = computed(() => MAX_FOTOS - (this.trabajo()?.fotoIds.length ?? 0));

  readonly urlFoto = computed(() => {
    const id = Number(this.id());
    return (fotoId: number) => this.api.urlFotoTrabajo(id, fotoId);
  });

  /** Qué falta para poder enviarlo, con los nombres que ve el usuario. */
  readonly faltan = computed(() => {
    // Relleno, no relleno: cliente y trabajador ya no son texto sino una
    // elección, y los materiales son una lista.
    const relleno: Record<string, boolean> = {
      cliente: this.clienteId() !== null,
      trabajador: this.trabajadorId() !== null,
      descripcion: this.descripcion().trim().length > 0,
      materiales: this.materiales().length > 0,
      horas: this.horas().trim().length > 0,
    };
    return OBLIGATORIOS_PARA_ENVIAR.filter((c) => !relleno[c.campo]).map((c) => c.etiqueta);
  });

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

    this.confirmar({
      titulo: 'Enviar el trabajo',
      mensaje:
        'Al enviarlo se le pone fecha y deja de ser un borrador. A partir de ese momento solo el jefe podrá modificarlo.',
      aceptar: 'Enviar',
      peligroso: false,
    }).then((seguro) => {
      if (!seguro) return;
      this.ocupado.set(true);

      const enviarAhora = () => {
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
      };

      if (this.hayCambios()) {
        this.api.editarTrabajo(Number(this.id()), datos).subscribe({
          next: (trabajo) => {
            this.aplicar(trabajo);
            enviarAhora();
          },
          error: (fallo) => {
            this.ocupado.set(false);
            this.avisos.error(fallo, 'No se han podido guardar los cambios antes de enviar');
          },
        });
      } else {
        enviarAhora();
      }
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

    this.confirmar({
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

  subirFotos(): void {
    const t = this.trabajo();
    const fotos = this.fotosNuevas();
    if (!t || fotos.length === 0 || this.ocupado()) return;

    this.ocupado.set(true);
    this.api.subirFotosTrabajo(t.id, fotos).subscribe({
      next: (fotoIds) => {
        this.trabajo.set({ ...t, fotoIds });
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
    const t = this.trabajo();
    if (!t || this.ocupado()) return;

    this.confirmar({
      titulo: 'Borrar la foto',
      mensaje: 'Esta foto se borrará del trabajo y no se puede recuperar.',
      aceptar: 'Borrar',
      peligroso: true,
    }).then((seguro) => {
      if (!seguro) return;
      this.ocupado.set(true);
      this.api.borrarFotoTrabajo(t.id, fotoId).subscribe({
        next: () => {
          this.trabajo.set({ ...t, fotoIds: t.fotoIds.filter((f) => f !== fotoId) });
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

  // ---------- auxiliares ----------

  firmar(): void {
    const t = this.trabajo();
    if (!t || this.ocupado()) return;

    this.dialogo
      .open(LienzoFirma, { width: '640px', maxWidth: '96vw', disableClose: true })
      .afterClosed()
      .subscribe((firma: Blob | null | undefined) => {
        if (!firma) return;
        this.ocupado.set(true);
        this.api.guardarFirmaTrabajo(t.id, firma).subscribe({
          next: (actualizado) => {
            this.aplicar(actualizado);
            this.ocupado.set(false);
            this.avisos.correcto('Firma del cliente guardada');
          },
          error: (fallo) => {
            this.ocupado.set(false);
            this.avisos.error(fallo, 'No se ha podido guardar la firma');
          },
        });
      });
  }

  quitarFirma(): void {
    const t = this.trabajo();
    if (!t || this.ocupado()) return;

    this.dialogo
      .open(DialogoConfirmar, {
        data: {
          titulo: '¿Quitar la firma?',
          mensaje: 'Se borra la firma que el cliente puso en este trabajo.',
          aceptar: 'Quitar',
          peligroso: true,
        },
        width: '440px',
      })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.ocupado.set(true);
        this.api.borrarFirmaTrabajo(t.id).subscribe({
          next: (actualizado) => {
            this.aplicar(actualizado);
            this.ocupado.set(false);
            this.avisos.correcto('Firma quitada');
          },
          error: (fallo) => {
            this.ocupado.set(false);
            this.avisos.error(fallo, 'No se ha podido quitar la firma');
          },
        });
      });
  }

  private aplicar(trabajo: Trabajo): void {
    this.trabajo.set(trabajo);
    this.urlFirma.set(
      trabajo.tieneFirma ? `${this.api.urlFirmaTrabajo(trabajo.id)}?v=${Date.now()}` : '',
    );
    this.clienteId.set(trabajo.clienteId);
    this.trabajadorId.set(trabajo.trabajadorId);
    this.descripcion.set(trabajo.descripcion ?? '');
    this.materiales.set(trabajo.materiales);
    this.horas.set(trabajo.horas !== null ? String(trabajo.horas) : '');
    this.errorHoras.set(null);

    // Solo tiene sentido buscar el albarán si el trabajo está enviado y quien
    // mira es el jefe: para el trabajador, /api/albaranes responde 403.
    if (trabajo.estado === 'ENVIADO' && this.sesion.esJefe()) {
      this.buscarAlbaran(trabajo.id);
    } else {
      this.albaran.set(null);
    }
  }

  private buscarAlbaran(trabajoId: number): void {
    this.api.albaranes().subscribe({
      next: (lista) => this.albaran.set(lista.find((a) => a.trabajoIds.includes(trabajoId)) ?? null),
      // Si falla, simplemente no se enseña el enlace. No es información
      // crítica y no merece molestar al usuario con un aviso.
      error: () => this.albaran.set(null),
    });
  }

  generarAlbaran(): void {
    const t = this.trabajo();
    if (!t || this.ocupado()) return;

    this.dialogo
      .open(DialogoGenerarAlbaran, { width: '440px' })
      .afterClosed()
      .subscribe((datos) => {
        if (!datos) return;
        this.ocupado.set(true);
        this.api.crearAlbaranDesdeTrabajo(t.id, datos).subscribe({
          next: (albaran) => {
            this.ocupado.set(false);
            this.avisos.correcto(`Albarán nº ${albaran.numero} generado`);
            this.router.navigate(['/albaranes', albaran.id]);
          },
          error: (fallo) => {
            this.ocupado.set(false);
            this.avisos.error(fallo, 'No se ha podido generar el albarán');
          },
        });
      });
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
