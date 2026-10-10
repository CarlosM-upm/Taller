package com.taller.herreria.material.dto;

import com.taller.herreria.material.Material;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Una línea de material tal como entra y sale por la API.
 *
 * El precio solo tiene sentido en los albaranes; en los trabajos viaja nulo y
 * el servicio lo ignora. Se usa un único tipo para los dos en vez de duplicar
 * el record: la diferencia es un campo que a veces no se rellena.
 */
public record MaterialDto(
        Long id,
        @NotBlank(message = "indique el nombre del material") String nombre,
        @NotNull(message = "indique la cantidad")
        @Positive(message = "la cantidad tiene que ser mayor que cero")
        BigDecimal cantidad,
        BigDecimal precio
) {
    public static MaterialDto de(Material material) {
        return new MaterialDto(material.getId(), material.getNombre(),
                material.getCantidad(), material.getPrecio());
    }
}
