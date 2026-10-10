package com.taller.herreria.pedido.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Lo que devuelve la API. Las fotos van como ids, para pedirlas aparte.
 *
 * De cliente y trabajador van el id y el nombre: el id para que el desplegable
 * marque el elegido, y el nombre para pintarlo sin tener que cruzar listas.
 */
public record PedidoResponse(
        Long id,
        LocalDate fecha,
        Long trabajadorId,
        String trabajador,
        Long clienteId,
        String cliente,
        String descripcion,
        List<Long> fotoIds
) { }
