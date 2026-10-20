package com.taller.herreria.catalogo.dto;

import com.taller.herreria.catalogo.FamiliaMaterial;
import com.taller.herreria.catalogo.MaterialCatalogo;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

/** Lo que entra y sale por la API del catálogo. Las entidades nunca se exponen. */
public class CatalogoDto {

    public record Familia(Long id, String nombre) {
        public static Familia de(FamiliaMaterial f) {
            return new Familia(f.getId(), f.getNombre());
        }
    }

    public record DatosFamilia(@NotBlank(message = "indique el nombre de la familia") String nombre) { }

    /**
     * Lo que ve la TABLET: sin precios. Al trabajador que apunta el material en
     * la obra no le hace falta saber lo que cuesta, igual que no ve el precio de
     * la línea del albarán.
     */
    public record Material(Long id, Long familiaId, String familia, String nombre, String unidad) {
        public static Material de(MaterialCatalogo m) {
            return new Material(m.getId(), m.getFamilia().getId(), m.getFamilia().getNombre(),
                    m.getNombre(), m.getUnidad());
        }
    }

    /** Lo que ve el JEFE: con los tres campos del precio y el total ya calculado. */
    public record MaterialConPrecio(Long id, Long familiaId, String familia, String nombre,
                                    String unidad, BigDecimal precio, BigDecimal porcentajeExtra,
                                    BigDecimal transporte, BigDecimal precioTotal) {
        public static MaterialConPrecio de(MaterialCatalogo m) {
            return new MaterialConPrecio(m.getId(), m.getFamilia().getId(),
                    m.getFamilia().getNombre(), m.getNombre(), m.getUnidad(), m.getPrecio(),
                    m.getPorcentajeExtra(), m.getTransporte(), m.precioTotal());
        }
    }

    public record DatosMaterial(
            @NotNull(message = "elija la familia") Long familiaId,
            @NotBlank(message = "indique el nombre del material") String nombre,
            @NotBlank(message = "indique la unidad") String unidad,
            @PositiveOrZero(message = "el precio no puede ser negativo") BigDecimal precio,
            @PositiveOrZero(message = "el porcentaje no puede ser negativo") BigDecimal porcentajeExtra,
            @PositiveOrZero(message = "el transporte no puede ser negativo") BigDecimal transporte
    ) { }
}
