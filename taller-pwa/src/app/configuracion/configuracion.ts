import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-configuracion',
  imports: [MatIconModule],
  template: `
    <div class="contenedor">
      <h2>Ajustes</h2>
      <p class="aviso-vacio">
        <mat-icon>construction</mat-icon><br />
        Pendiente: contador de numeración de albaranes y cambio de contraseña.
      </p>
    </div>
  `,
  styles: `
    h2 { margin: 8px 0 16px; font: var(--mat-sys-headline-small); }
  `,
})
export class Configuracion {}
