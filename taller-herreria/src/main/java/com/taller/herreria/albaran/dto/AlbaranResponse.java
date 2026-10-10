package com.taller.herreria.albaran.dto;

import com.taller.herreria.material.dto.MaterialDto;
import com.taller.herreria.trabajador.dto.TrabajadorDto;

import java.math.BigDecimal;

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
        BigDecimal horas,
        List<MaterialDto> materiales,
        boolean tieneFirma,
        List<Long> trabajoIds,
        List<Long> fotoIds
) { }
