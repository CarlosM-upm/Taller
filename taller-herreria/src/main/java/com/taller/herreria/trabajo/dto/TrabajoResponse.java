package com.taller.herreria.trabajo.dto;

import com.taller.herreria.material.dto.MaterialDto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * De cliente y trabajador van el id y el nombre: el id para que el desplegable
 * marque el elegido, y el nombre para pintarlo sin cruzar listas. Van nulos
 * mientras el borrador no los tenga.
 */
public record TrabajoResponse(
        Long id,
        String estado,
        LocalDate fecha,
        Long clienteId,
        String cliente,
        Long trabajadorId,
        String trabajador,
        String descripcion,
        List<MaterialDto> materiales,
        BigDecimal horas,
        List<Long> fotoIds
) { }
