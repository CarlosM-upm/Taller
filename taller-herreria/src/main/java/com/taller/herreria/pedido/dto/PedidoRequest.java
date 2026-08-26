package com.taller.herreria.pedido.dto;

import jakarta.validation.constraints.NotBlank;

/** Datos que llegan de la tablet al crear un pedido. La fecha NO viene: la pone el servidor. */
public record PedidoRequest(
        @NotBlank(message = "El trabajador es obligatorio") String trabajador,
        @NotBlank(message = "El cliente es obligatorio") String cliente,
        @NotBlank(message = "La descripción es obligatoria") String descripcion
) { }
