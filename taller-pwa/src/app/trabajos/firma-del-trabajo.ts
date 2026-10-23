import { Component, computed, inject, input, model, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ApiTaller } from '../nucleo/api';
import { Avisos } from '../nucleo/avisos';
import { Sesion } from '../nucleo/sesion';
import { Trabajo } from '../nucleo/modelos';
import { DialogoConfirmar } from '../comun/dialogo-confirmar';
import { LienzoFirma } from '../comun/lienzo-firma';
import { SrcSeguro } from '../comun/src-seguro';

/**
 * La firma del cliente en la ficha del trabajo, recogida en la obra.
 * Si el albarán sale solo de este trabajo, la hereda; uno unificado no.
 */
@Component({
  selector: 'app-firma-del-trabajo',
  imports: [MatButtonModule, MatCardModule, MatIconModule, SrcSeguro],
  templateUrl: './firma-del-trabajo.html',
  styleUrl: './firma-del-trabajo.scss',
})
export class FirmaDelTrabajo {
  private readonly api = inject(ApiTaller);
  private readonly dialogo = inject(MatDialog);
  private readonly avisos = inject(Avisos);
  private readonly sesion = inject(Sesion);

  readonly trabajo = input.required<Trabajo>();
  /** De dos direcciones con la ficha, como en la tarjeta de fotos. */
  readonly ocupado = model(false);
  /** El trabajo tal como lo devuelve el servidor tras firmar o quitar la firma. */
  readonly cambio = output<Trabajo>();

  private readonly esBorrador = computed(() => this.trabajo().estado === 'BORRADOR');

  /**
   * Firmar lo puede hacer el trabajador en borrador y también en un enviado
   * SIN firma: lo normal es enviarlo desde el taller y que el cliente firme
   * después. Lo que no puede es sustituir la firma de un enviado; eso es del
   * jefe (y el servidor responde 403 aunque se fuerce desde aquí).
   */
  readonly puedeFirmar = computed(
    () => this.esBorrador() || !this.trabajo().tieneFirma || this.sesion.esJefe(),
  );

  /** Quitar la firma: en un borrador cualquiera, en un enviado solo el jefe. */
  readonly puedeQuitarFirma = computed(
    () => this.trabajo().tieneFirma && (this.esBorrador() || this.sesion.esJefe()),
  );

  /**
   * Con marca de tiempo para saltarse la caché del navegador: sin ella, al
   * firmar de nuevo se seguiría viendo la firma anterior (misma URL). Se
   * recalcula cada vez que llega el trabajo actualizado.
   */
  readonly urlFirma = computed(() => {
    const t = this.trabajo();
    return t.tieneFirma ? `${this.api.urlFirmaTrabajo(t.id)}?v=${Date.now()}` : '';
  });

  firmar(): void {
    if (this.ocupado()) return;
    const id = this.trabajo().id;

    this.dialogo
      .open(LienzoFirma, { width: '640px', maxWidth: '96vw', disableClose: true })
      .afterClosed()
      .subscribe((firma: Blob | null | undefined) => {
        if (!firma) return;
        this.ocupado.set(true);
        this.api.guardarFirmaTrabajo(id, firma).subscribe({
          next: (actualizado) => this.terminar(actualizado, 'Firma del cliente guardada'),
          error: (fallo) => this.fallar(fallo, 'No se ha podido guardar la firma'),
        });
      });
  }

  quitarFirma(): void {
    if (this.ocupado()) return;
    const id = this.trabajo().id;

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
        this.api.borrarFirmaTrabajo(id).subscribe({
          next: (actualizado) => this.terminar(actualizado, 'Firma quitada'),
          error: (fallo) => this.fallar(fallo, 'No se ha podido quitar la firma'),
        });
      });
  }

  private terminar(actualizado: Trabajo, mensaje: string): void {
    this.cambio.emit(actualizado);
    this.ocupado.set(false);
    this.avisos.correcto(mensaje);
  }

  private fallar(fallo: unknown, mensaje: string): void {
    this.ocupado.set(false);
    this.avisos.error(fallo, mensaje);
  }
}
