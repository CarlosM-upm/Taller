package com.taller.herreria.trabajo.dto;

import java.math.BigDecimal;

/**
 * Datos editables de un trabajo, usados tanto al crear como en el PATCH.
 * Todos opcionales: un borrador puede guardarse a medias, con lo que haya.
 * (La validación de que está completo ocurre al ENVIAR, no antes.)
 */
public record TrabajoDatos(
        String cliente,
        String trabajador,
        String descripcion,
        String materiales,
        BigDecimal horas
) { }
