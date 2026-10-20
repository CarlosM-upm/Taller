package com.taller.herreria.catalogo;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Un material del catálogo del taller, dentro de su familia.
 *
 * Los trabajos ya no teclean el material: lo eligen de aquí. Lo que se guarda
 * en cada trabajo o albarán es una COPIA (nombre, unidad y, en el albarán, el
 * precio): ver material/Material. Así cambiar el catálogo no altera documentos
 * que ya se entregaron.
 *
 * No confundir con material/Material, que es una línea de un trabajo o de un
 * albarán ("12,5 m de este material").
 */
@Entity
@Table(name = "catalogo_materiales")
public class MaterialCatalogo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** EAGER, como el resto de relaciones: el paso a DTO va fuera de la transacción. */
    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "familia_id", nullable = false)
    private FamiliaMaterial familia;

    @Column(nullable = false)
    private String nombre;

    /** m, ud, kg, barra… Sin ella, un precio no dice si es por metro o por barra. */
    @Column(nullable = false, length = 20)
    private String unidad = "ud";

    /** Precio de compra por unidad. Nulo mientras no se sepa. */
    @Column(precision = 10, scale = 2)
    private BigDecimal precio;

    /** Porcentaje que se añade sobre el precio (margen, merma…). */
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal porcentajeExtra = BigDecimal.ZERO;

    /** Transporte por unidad, en euros. */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal transporte = BigDecimal.ZERO;

    protected MaterialCatalogo() { } // requerido por JPA

    public MaterialCatalogo(FamiliaMaterial familia, String nombre, String unidad) {
        this.familia = familia;
        this.nombre = nombre;
        this.unidad = unidad;
    }

    /**
     * Precio total por unidad = precio + precio · extra/100 + transporte,
     * a dos decimales. Nulo si todavía no hay precio de compra.
     *
     * Es por UNIDAD: en el albarán se multiplica por la cantidad, así que el
     * transporte cuenta tantas veces como unidades. Decidido así.
     */
    public BigDecimal precioTotal() {
        if (precio == null) return null;
        BigDecimal extra = precio.multiply(porcentajeExtra)
                .divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        return precio.add(extra).add(transporte).setScale(2, RoundingMode.HALF_UP);
    }

    public Long getId() { return id; }
    public FamiliaMaterial getFamilia() { return familia; }
    public String getNombre() { return nombre; }
    public String getUnidad() { return unidad; }
    public BigDecimal getPrecio() { return precio; }
    public BigDecimal getPorcentajeExtra() { return porcentajeExtra; }
    public BigDecimal getTransporte() { return transporte; }

    public void setFamilia(FamiliaMaterial familia) { this.familia = familia; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public void setUnidad(String unidad) { this.unidad = unidad; }
    public void setPrecio(BigDecimal precio) { this.precio = precio; }
    public void setPorcentajeExtra(BigDecimal porcentajeExtra) { this.porcentajeExtra = porcentajeExtra; }
    public void setTransporte(BigDecimal transporte) { this.transporte = transporte; }
}
