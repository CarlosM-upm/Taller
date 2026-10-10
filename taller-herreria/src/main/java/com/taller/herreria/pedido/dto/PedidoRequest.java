package com.taller.herreria.pedido.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Datos que llegan de la tablet al crear un pedido. La fecha NO viene: la pone
 * el servidor. Cliente y trabajador llegan por id: se eligen de una lista, ya
 * no se teclean.
 */
public record PedidoRequest(
        @NotNull(message = "El trabajador es obligatorio") Long trabajadorId,
        @NotNull(message = "El cliente es obligatorio") Long clienteId,
        @NotBlank(message = "La descripción es obligatoria") String descripcion
) { }
