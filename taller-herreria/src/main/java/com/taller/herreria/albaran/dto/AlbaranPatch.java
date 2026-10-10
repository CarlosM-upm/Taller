package com.taller.herreria.albaran.dto;

import com.taller.herreria.material.dto.MaterialDto;
import jakarta.validation.Valid;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Edición parcial por el jefe. Todos los campos opcionales, incluido el número.
 * Lo que venga nulo no se toca.
 *
 * Aquí es donde el jefe pone los precios: el de cada material dentro de su
 * línea, y el de la hora para todo el albarán.
 */
public record AlbaranPatch(
        Long numero,
        LocalDate fecha,
        Long clienteId,
        String dniCliente,
        List<Long> trabajadorIds,
        String descripcion,
        BigDecimal horas,
        List<@Valid MaterialDto> materiales,
        BigDecimal precioHora,
        BigDecimal importeExtra,
        Boolean incluirTotal
) { }
