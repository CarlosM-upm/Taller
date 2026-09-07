import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-lista-albaranes',
  imports: [MatIconModule],
  template: `
    <div class="contenedor">
      <h2>Albaranes</h2>
      <p class="aviso-vacio">
        <mat-icon>construction</mat-icon><br />
        Pendiente: generar desde un trabajo enviado, firma del cliente y fotos.
      </p>
    </div>
  `,
  styles: `
    h2 { margin: 8px 0 16px; font: var(--mat-sys-headline-small); }
  `,
})
export class ListaAlbaranes {}
