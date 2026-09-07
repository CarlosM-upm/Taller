package com.taller.herreria.foto;

import jakarta.persistence.*;

/**
 * Foto asociada a un pedido, trabajo o albarán.
 * En lugar de una clave foránea distinta por entidad, guardamos
 * a qué tipo de entidad pertenece (origenTipo) y a cuál (origenId).
 */
@Entity
@Table(name = "fotos",
       // Toda consulta a esta tabla filtra por (origenTipo, origenId).
       // Sin índice, cada listado obliga a recorrerla entera.
       indexes = @Index(name = "idx_foto_origen", columnList = "origenTipo, origenId"))
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

    /**
     * La imagen en sí, guardada dentro de la base de datos como bytea.
     *
     * SIN @Lob a propósito. Con @Lob, Hibernate mapea byte[] a "oid" (large
     * object) en PostgreSQL, y entonces borrar la fila NO libera la imagen:
     * queda huérfana en pg_largeobject y la base de datos crece para siempre.
     * Un byte[] pelado se mapea a bytea, que vive en la propia fila y se borra
     * con ella.
     *
     * Tampoco lleva fetch = LAZY. No serviría: el lazy en atributos básicos
     * exige instrumentación de bytecode, que este proyecto no tiene. Y si se
     * añadiera el plugin para activarlo, rompería las descargas de imagen:
     * con open-in-view = false, el controlador lee los bytes fuera de la
     * transacción y saltaría LazyInitializationException.
     *
     * Para no traer las imágenes en los listados existe
     * FotoRepository.idsPorOrigen(...), que proyecta solo los identificadores.
     */
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
