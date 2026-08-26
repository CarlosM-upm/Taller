package com.taller.herreria.trabajo.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record TrabajoResponse(
        Long id,
        String estado,
        LocalDate fecha,
        String cliente,
        String trabajador,
        String descripcion,
        String materiales,
        BigDecimal horas,
        List<Long> fotoIds
) { }
