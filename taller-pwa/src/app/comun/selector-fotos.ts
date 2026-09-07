import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Avisos } from '../nucleo/avisos';
import { Fotos } from '../nucleo/fotos';

/** Una foto elegida pero todavía no subida, con su miniatura para verla. */
export interface FotoElegida {
  archivo: Blob;
  miniatura: string;
}

/**
 * Botón para añadir fotos, con miniaturas de lo elegido.
 *
 * Sirve tanto al crear (donde las fotos esperan a que exista la entidad) como
 * al añadirlas después. Las reduce nada más elegirlas, no al enviarlas: así el
 * usuario ve enseguida si algo va mal con una imagen, y no al final de un
 * formulario largo.
 *
 * El input lleva capture="environment": en una tablet eso abre directamente la
 * cámara trasera en vez del explorador de archivos, que es lo que quiere quien
 * está delante de la reja que acaba de montar.
 */
@Component({
  selector: 'app-selector-fotos',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './selector-fotos.html',
  styleUrl: './selector-fotos.scss',
})
export class SelectorFotos {
  private readonly fotos = inject(Fotos);
  private readonly avisos = inject(Avisos);

  /** Cuántas caben todavía (el backend admite 5 por entidad). */
  readonly huecos = input.required<number>();
  readonly desactivado = input(false);

  readonly elegidas = signal<FotoElegida[]>([]);
  readonly cambio = output<Blob[]>();

  readonly procesando = signal(false);
  readonly puedeAnadir = computed(
    () => !this.desactivado() && !this.procesando() && this.elegidas().length < this.huecos()
  );

  async alElegir(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivos = Array.from(input.files ?? []);
    // Se limpia enseguida: si no, elegir dos veces la misma foto no dispara
    // el evento change y parece que la aplicación se ha quedado colgada.
    input.value = '';
    if (archivos.length === 0) return;

    const libres = this.huecos() - this.elegidas().length;
    if (archivos.length > libres) {
      this.avisos.error(null, `Solo caben ${libres} foto(s) más`);
      return;
    }

    this.procesando.set(true);
    try {
      const nuevas: FotoElegida[] = [];
      for (const archivo of archivos) {
        const reducida = await this.fotos.preparar(archivo);
        nuevas.push({ archivo: reducida, miniatura: URL.createObjectURL(reducida) });
      }
      this.elegidas.update((previas) => [...previas, ...nuevas]);
      this.cambio.emit(this.elegidas().map((f) => f.archivo));
    } catch (fallo) {
      this.avisos.error(
        null,
        fallo instanceof Error ? fallo.message : 'No se ha podido preparar la foto'
      );
    } finally {
      this.procesando.set(false);
    }
  }

  quitar(indice: number): void {
    const fuera = this.elegidas()[indice];
    // Sin esto, cada miniatura descartada se queda ocupando memoria hasta que
    // se recargue la página.
    if (fuera) URL.revokeObjectURL(fuera.miniatura);

    this.elegidas.update((previas) => previas.filter((_, i) => i !== indice));
    this.cambio.emit(this.elegidas().map((f) => f.archivo));
  }

  /** Tras subirlas, el padre llama aquí para dejar el selector a cero. */
  vaciar(): void {
    this.elegidas().forEach((f) => URL.revokeObjectURL(f.miniatura));
    this.elegidas.set([]);
    this.cambio.emit([]);
  }
}
