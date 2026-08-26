package com.taller.herreria.albaran.dto;

import java.time.LocalDate;

/**
 * Datos que aporta el jefe al crear el albarán desde un trabajo.
 * El resto (cliente, trabajador, descripción, fotos) se copia del trabajo.
 * Si no se indica fecha, se usa la de hoy (luego es editable).
 */
public record AlbaranCrear(
        LocalDate fecha,
        String dniCliente
) { }
