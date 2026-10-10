package com.taller.herreria.albaran.dto;

import com.taller.herreria.trabajador.dto.TrabajadorDto;

import java.time.LocalDate;
import java.util.List;

public record AlbaranResponse(
        Long id,
        Long numero,
        LocalDate fecha,
        Long clienteId,
        String cliente,
        String dniCliente,
        List<TrabajadorDto.Resumen> trabajadores,
        String descripcion,
        boolean tieneFirma,
        Long trabajoId,
        List<Long> fotoIds
) { }
