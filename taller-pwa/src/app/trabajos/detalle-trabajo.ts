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
import { Avisos } from '../nucleo/avisos';
import { Sesion } from '../nucleo/sesion';
import { Trabajo, TrabajoDatos } from '../nucleo/modelos';
import { DialogoConfirmar } from '../comun/dialogo-confirmar';
import { GaleriaFotos } from '../comun/galeria-fotos';
import { SelectorFotos } from '../comun/selector-fotos';

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
    SelectorFotos,
  ],
  templateUrl: './detalle-trabajo.html',
  styleUrl: './detalle-trabajo.scss',
})
export class DetalleTrabajo implements OnInit {
  private readonly api = inject(ApiTaller);
  private readonly router = inject(Router);
  private readonly dialogo = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  readonly sesion = inject(Sesion);

  private readonly selector = viewChild(SelectorFotos);

  readonly id = input.required<string>();

  readonly trabajo = signal<Trabajo | null>(null);
  readonly cargando = signal(true);
  readonly ocupado = signal(false);
  readonly fallo = signal<string | null>(null);

  readonly cliente = signal('');
  readonly trabajador = signal('');
  readonly descripcion = signal('');
  readonly materiales = signal('');
  readonly horas = signal('');
  readonly errorHoras = signal<string | null>(null);

  readonly fotosNuevas = signal<Blob[]>([]);

  readonly esBorrador = computed(() => this.trabajo()?.estado === 'BORRADOR');

  /** Un trabajo enviado solo lo toca el jefe. */
  readonly puedeEditar = computed(
    () => this.trabajo() !== null && (this.esBorrador() || this.sesion.esJefe())
  );

  readonly huecos = computed(() => MAX_FOTOS - (this.trabajo()?.fotoIds.length ?? 0));

  readonly urlFoto = computed(() => {
    const id = Number(this.id());
    return (fotoId: number) => this.api.urlFotoTrabajo(id, fotoId);
  });

  /** Qué falta para poder enviarlo, con los nombres que ve el usuario. */
  readonly faltan = computed(() => {
    const valores: Record<string, string> = {
      cliente: this.cliente().trim(),
      trabajador: this.trabajador().trim(),
      descripcion: this.descripcion().trim(),
      materiales: this.materiales().trim(),
      horas: this.horas().trim(),
    };
    return OBLIGATORIOS_PARA_ENVIAR.filter((c) => valores[c.campo].length === 0).map(
      (c) => c.etiqueta
    );
  });

  readonly hayCambios = computed(() => {
    const t = this.trabajo();
    if (!t) return false;
    return (
      this.cliente().trim() !== (t.cliente ?? '') ||
      this.trabajador().trim() !== (t.trabajador ?? '') ||
      this.descripcion().trim() !== (t.descripcion ?? '') ||
      this.materiales().trim() !== (t.materiales ?? '') ||
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
   * sin ningún aviso. Ocurrió, y por eso existe e2e/humo.spec.ts.
   */
  ngOnInit(): void {
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

  private aplicar(trabajo: Trabajo): void {
    this.trabajo.set(trabajo);
    this.cliente.set(trabajo.cliente ?? '');
    this.trabajador.set(trabajo.trabajador ?? '');
    this.descripcion.set(trabajo.descripcion ?? '');
    this.materiales.set(trabajo.materiales ?? '');
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
      cliente: vacioONulo(this.cliente()),
      trabajador: vacioONulo(this.trabajador()),
      descripcion: vacioONulo(this.descripcion()),
      materiales: vacioONulo(this.materiales()),
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
