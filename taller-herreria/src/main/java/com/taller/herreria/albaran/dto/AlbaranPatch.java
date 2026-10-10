package com.taller.herreria.albaran.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Edición parcial por el jefe. Todos los campos opcionales, incluido el número.
 * Los trabajadores llegan como lista de ids porque un albarán puede unificar
 * trabajos de varias personas.
 */
public record AlbaranPatch(
        Long numero,
        LocalDate fecha,
        Long clienteId,
        String dniCliente,
        List<Long> trabajadorIds,
        String descripcion
) { }
