package com.taller.herreria.trabajo;

import com.taller.herreria.seguridad.SeguridadUtils;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * La regla de edición que decidimos: en cuanto un trabajo se envía, pasa a ser
 * territorio del jefe. El trabajador solo toca borradores.
 *
 * No se puede expresar solo con la URL (depende del estado del trabajo), por eso
 * vive aquí y no en SecurityConfig. La usan el ciclo del trabajo, la firma y las
 * fotos; cualquier operación nueva sobre trabajos tiene que pasar por aquí.
 */
final class PermisosTrabajo {

    private PermisosTrabajo() { }

    static void exigirJefeSiEnviado(Trabajo trabajo, String accion) {
        if (!trabajo.esBorrador() && !SeguridadUtils.esJefe()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "El trabajo ya fue enviado: solo el jefe puede " + accion + " un trabajo enviado");
        }
    }
}
