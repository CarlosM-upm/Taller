package com.taller.herreria.cliente.dto;

import com.taller.herreria.cliente.Cliente;
import jakarta.validation.constraints.NotBlank;

/** Lo que entra y lo que sale por la API. La entidad nunca se expone. */
public class ClienteDto {

    public record Datos(@NotBlank(message = "indique el nombre del cliente") String nombre) { }

    public record Resumen(Long id, String nombre) {
        public static Resumen de(Cliente cliente) {
            return new Resumen(cliente.getId(), cliente.getNombre());
        }
    }
}
