package com.taller.herreria.cliente.dto;

import com.taller.herreria.cliente.Cliente;
import jakarta.validation.constraints.NotBlank;

/** Lo que entra y lo que sale por la API. La entidad nunca se expone. */
public class ClienteDto {

    /** El DNI se comprueba en el servicio (formato y letra), no aquí. */
    public record Datos(
            @NotBlank(message = "indique el nombre del cliente") String nombre,
            @NotBlank(message = "indique el DNI del cliente") String dni) { }

    /**
     * Lo que ven los dos roles. Sin el DNI, que es un dato personal: a la
     * tablet le basta saber si lo tiene, para no dejar elegir al que no.
     */
    public record Resumen(Long id, String nombre, boolean tieneDni) {
        public static Resumen de(Cliente cliente) {
            return new Resumen(cliente.getId(), cliente.getNombre(), cliente.tieneDni());
        }
    }

    /** Lo que ve el jefe en Ajustes: con el DNI, para poder corregirlo. */
    public record ConDni(Long id, String nombre, String dni) {
        public static ConDni de(Cliente cliente) {
            return new ConDni(cliente.getId(), cliente.getNombre(), cliente.getDni());
        }
    }
}
