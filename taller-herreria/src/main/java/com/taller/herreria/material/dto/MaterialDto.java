package com.taller.herreria.material.dto;

import com.taller.herreria.material.Material;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * Una línea de material tal como entra y sale por la API.
 *
 * Al ENTRAR basta con catalogoId y cantidad: nombre y unidad los pone el
 * servidor copiándolos del catálogo. El nombre solo viaja de vuelta para las
 * líneas antiguas que ya no tienen material en el catálogo (ver LineasMaterial).
 *
 * El precio solo tiene sentido en los albaranes; en los trabajos viaja nulo.
 */
public record MaterialDto(
        Long id,
        Long catalogoId,
        String nombre,
        String unidad,
        @NotNull(message = "indique la cantidad")
        @Positive(message = "la cantidad tiene que ser mayor que cero")
        BigDecimal cantidad,
        BigDecimal precio
) {
    public static MaterialDto de(Material material) {
        return new MaterialDto(material.getId(), material.getCatalogoId(), material.getNombre(),
                material.getUnidad(), material.getCantidad(), material.getPrecio());
    }
}
