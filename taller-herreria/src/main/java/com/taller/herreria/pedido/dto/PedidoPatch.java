package com.taller.herreria.pedido.dto;

/**
 * Edición parcial (PATCH) de un pedido por parte del jefe.
 * Todos los campos son opcionales: solo se cambia lo que venga informado.
 */
public record PedidoPatch(
        String trabajador,
        String cliente,
        String descripcion
) { }
