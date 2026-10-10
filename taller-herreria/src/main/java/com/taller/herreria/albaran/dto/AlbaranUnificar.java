package com.taller.herreria.albaran.dto;

import jakarta.validation.constraints.NotEmpty;

import java.time.LocalDate;
import java.util.List;

/**
 * Petición para unificar varios trabajos en un solo albarán.
 *
 * Todos tienen que ser del mismo cliente y estar enviados; el servicio lo
 * comprueba y dice cuál falla si no es así.
 */
public record AlbaranUnificar(
        @NotEmpty(message = "seleccione al menos un trabajo") List<Long> trabajoIds,
        LocalDate fecha,
        String dniCliente
) {
    /** Lo que el servicio necesita aparte de la lista de trabajos. */
    public AlbaranCrear datos() {
        return new AlbaranCrear(fecha, dniCliente);
    }
}
