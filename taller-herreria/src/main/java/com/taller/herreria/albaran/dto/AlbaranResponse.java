package com.taller.herreria.albaran.dto;

import java.time.LocalDate;
import java.util.List;

public record AlbaranResponse(
        Long id,
        Long numero,
        LocalDate fecha,
        String cliente,
        String dniCliente,
        String trabajador,
        String descripcion,
        boolean tieneFirma,
        Long trabajoId,
        List<Long> fotoIds
) { }
