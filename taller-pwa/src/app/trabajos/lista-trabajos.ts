import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-lista-trabajos',
  imports: [MatIconModule],
  template: `
    <div class="contenedor">
      <h2>Trabajos</h2>
      <p class="aviso-vacio">
        <mat-icon>construction</mat-icon><br />
        Pendiente: ciclo borrador &rarr; enviado, fotos y validación al enviar.
      </p>
    </div>
  `,
  styles: `
    h2 { margin: 8px 0 16px; font: var(--mat-sys-headline-small); }
  `,
})
export class ListaTrabajos {}
