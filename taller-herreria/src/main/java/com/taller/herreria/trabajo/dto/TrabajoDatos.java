package com.taller.herreria.trabajo.dto;

import com.taller.herreria.material.dto.MaterialDto;
import jakarta.validation.Valid;

import java.math.BigDecimal;
import java.util.List;

/**
 * Datos editables de un trabajo, usados tanto al crear como en el PATCH.
 * Todos opcionales: un borrador puede guardarse a medias, con lo que haya.
 * (La validación de que está completo ocurre al ENVIAR, no antes.)
 *
 * Cliente y trabajador llegan por id porque se eligen de una lista. Al venir
 * nulo se entiende "no lo toques", no "déjalo vacío": con un desplegable, para
 * cambiar de cliente se elige otro, y vaciarlo no es un caso real.
 */
public record TrabajoDatos(
        Long clienteId,
        Long trabajadorId,
        String descripcion,
        // El @Valid va DENTRO del genérico. Puesto fuera (@Valid List<...>)
        // valida la lista, que no tiene restricciones, y las líneas pasaban
        // sin mirar: colaba un material con nombre vacío y cantidad negativa.
        List<@Valid MaterialDto> materiales,
        BigDecimal horas
) { }
