package com.taller.herreria.trabajador.dto;

import com.taller.herreria.trabajador.Trabajador;
import jakarta.validation.constraints.NotBlank;

/** Lo que entra y lo que sale por la API. La entidad nunca se expone. */
public class TrabajadorDto {

    public record Datos(@NotBlank(message = "indique el nombre del trabajador") String nombre) { }

    public record Resumen(Long id, String nombre) {
        public static Resumen de(Trabajador trabajador) {
            return new Resumen(trabajador.getId(), trabajador.getNombre());
        }
    }
}
