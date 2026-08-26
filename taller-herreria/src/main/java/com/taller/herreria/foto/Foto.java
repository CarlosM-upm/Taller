package com.taller.herreria.foto;

import jakarta.persistence.*;

/**
 * Foto asociada a un pedido, trabajo o albarán.
 * En lugar de una clave foránea distinta por entidad, guardamos
 * a qué tipo de entidad pertenece (origenTipo) y a cuál (origenId).
 */
@Entity
@Table(name = "fotos")
public class Foto {

    public enum OrigenTipo { PEDIDO, TRABAJO, ALBARAN }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrigenTipo origenTipo;

    @Column(nullable = false)
    private Long origenId;

    /** Tipo MIME (image/jpeg, image/png…) para servirla correctamente. */
    @Column(nullable = false)
    private String tipoContenido;

    /** La imagen en sí, guardada dentro de la base de datos. */
    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(nullable = false)
    private byte[] datos;

    protected Foto() { } // requerido por JPA

    public Foto(OrigenTipo origenTipo, Long origenId, String tipoContenido, byte[] datos) {
        this.origenTipo = origenTipo;
        this.origenId = origenId;
        this.tipoContenido = tipoContenido;
        this.datos = datos;
    }

    public Long getId() { return id; }
    public OrigenTipo getOrigenTipo() { return origenTipo; }
    public Long getOrigenId() { return origenId; }
    public String getTipoContenido() { return tipoContenido; }
    public byte[] getDatos() { return datos; }
}
