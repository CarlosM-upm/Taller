package com.taller.herreria.material;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Línea de material: un nombre y una cantidad.
 *
 * Antes los materiales eran un único texto libre ("2 m de perfil, 4 tornillos…").
 * Se separan en líneas para poder ponerles precio en el albarán y para que al
 * unificar varios trabajos se puedan sumar las cantidades del mismo material.
 *
 * Usa el mismo esquema que Foto: en vez de una clave foránea por entidad, se
 * guarda a qué tipo pertenece (origenTipo) y a cuál (origenId).
 */
@Entity
@Table(name = "materiales",
       // Toda consulta filtra por (origenTipo, origenId); sin índice cada
       // ficha de trabajo recorrería la tabla entera.
       indexes = @Index(name = "idx_material_origen", columnList = "origenTipo, origenId"))
public class Material {

    /** No existe PEDIDO: un pedido es lo que pide el cliente, no lo que se gasta. */
    public enum OrigenTipo { TRABAJO, ALBARAN }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrigenTipo origenTipo;

    @Column(nullable = false)
    private Long origenId;

    /**
     * De qué material del catálogo salió. Es solo un enlace de referencia: lo
     * que se usa es la COPIA de nombre, unidad y precio de esta misma fila, para
     * que cambiar el catálogo no altere un documento ya entregado. Queda a nulo
     * si el material se borra del catálogo, y la línea sigue intacta.
     */
    private Long catalogoId;

    @Column(nullable = false)
    private String nombre;

    /** Copiada del catálogo: "m", "ud", "kg"… Nula en líneas anteriores al catálogo. */
    @Column(length = 20)
    private String unidad;

    /**
     * Decimal exacto con 2 decimales, por el mismo motivo que las horas: sirve
     * igual para "5 tornillos" que para "12,5 m de tubo", y no arrastra errores
     * de redondeo al multiplicarlo por el precio.
     */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal cantidad;

    /**
     * Precio unitario. Nulo salvo en los materiales de un ALBARÁN: es el jefe
     * quien los pone al facturar, y el trabajador que apunta el material desde
     * la tablet no tiene por qué saber lo que cuesta.
     */
    @Column(precision = 10, scale = 2)
    private BigDecimal precio;

    protected Material() { } // requerido por JPA

    public Material(OrigenTipo origenTipo, Long origenId, String nombre, BigDecimal cantidad) {
        this.origenTipo = origenTipo;
        this.origenId = origenId;
        this.nombre = nombre;
        this.cantidad = cantidad;
    }

    public Long getId() { return id; }
    public OrigenTipo getOrigenTipo() { return origenTipo; }
    public Long getOrigenId() { return origenId; }
    public Long getCatalogoId() { return catalogoId; }
    public String getNombre() { return nombre; }
    public String getUnidad() { return unidad; }
    public BigDecimal getCantidad() { return cantidad; }
    public BigDecimal getPrecio() { return precio; }

    public void setCatalogoId(Long catalogoId) { this.catalogoId = catalogoId; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public void setUnidad(String unidad) { this.unidad = unidad; }
    public void setCantidad(BigDecimal cantidad) { this.cantidad = cantidad; }
    public void setPrecio(BigDecimal precio) { this.precio = precio; }

    /**
     * Lo que suma esta línea: cantidad x precio, a dos decimales. Cero mientras
     * no tenga precio.
     *
     * Se redondea AQUÍ, línea a línea, y no solo al final: es lo que hace que
     * el total cuadre si alguien suma a mano lo que ve impreso. Con cantidades
     * decimales (12,5 m x 3,33 €) el producto tiene más de dos decimales.
     */
    public BigDecimal importe() {
        if (precio == null) return BigDecimal.ZERO;
        return cantidad.multiply(precio).setScale(2, RoundingMode.HALF_UP);
    }
}
