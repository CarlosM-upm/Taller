package com.taller.herreria.albaran.dto;

import java.time.LocalDate;

/** Edición parcial por el jefe. Todos los campos opcionales, incluido el número. */
public record AlbaranPatch(
        Long numero,
        LocalDate fecha,
        String cliente,
        String dniCliente,
        String trabajador,
        String descripcion
) { }
