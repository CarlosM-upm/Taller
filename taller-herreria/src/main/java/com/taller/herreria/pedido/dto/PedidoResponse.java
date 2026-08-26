package com.taller.herreria.pedido.dto;

import java.time.LocalDate;
import java.util.List;

/** Lo que devuelve la API al cliente. Las fotos van como ids, para pedirlas aparte. */
public record PedidoResponse(
        Long id,
        LocalDate fecha,
        String trabajador,
        String cliente,
        String descripcion,
        List<Long> fotoIds
) { }
