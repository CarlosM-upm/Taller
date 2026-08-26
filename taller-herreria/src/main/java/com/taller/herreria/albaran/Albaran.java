package com.taller.herreria.albaran;

import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Albarán. Solo lo crea el jefe, siempre a partir de un trabajo ENVIADO
 * (relación uno a uno). Al crearse COPIA los datos del trabajo (instantánea):
 * a partir de ahí el jefe los edita sin tocar el trabajo original.
 * El número es único y sale del contador editable de configuración.
 */
@Entity
@Table(name = "albaranes",
       uniqueConstraints = {
           @UniqueConstraint(name = "uq_albaran_numero", columnNames = "numero"),
           @UniqueConstraint(name = "uq_albaran_trabajo", columnNames = "trabajo_id")
       })
public class Albaran {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Número de albarán: único, secuencial, editable por el jefe. */
    @Column(nullable = false)
    private Long numero;

    /** Fecha ELEGIDA por el jefe (no automática). */
    @Column(nullable = false)
    private LocalDate fecha;

    @Column(nullable = false)
    private String cliente;      // copiado del trabajo

    private String dniCliente;   // lo teclea el jefe

    @Column(nullable = false)
    private String trabajador;   // copiado del trabajo

    @Column(nullable = false, length = 4000)
    private String descripcion;  // copiada del trabajo

    /** Firma del cliente (imagen capturada). */
    @Lob
    @Basic(fetch = FetchType.LAZY)
    private byte[] firma;

    private String firmaTipoContenido;

    /** Trabajo del que nació (uno a uno). */
    @Column(name = "trabajo_id", nullable = false)
    private Long trabajoId;

    protected Albaran() { } // requerido por JPA

    public Albaran(Long numero, LocalDate fecha, String cliente, String dniCliente,
                   String trabajador, String descripcion, Long trabajoId) {
        this.numero = numero;
        this.fecha = fecha;
        this.cliente = cliente;
        this.dniCliente = dniCliente;
        this.trabajador = trabajador;
        this.descripcion = descripcion;
        this.trabajoId = trabajoId;
    }

    public Long getId() { return id; }
    public Long getNumero() { return numero; }
    public LocalDate getFecha() { return fecha; }
    public String getCliente() { return cliente; }
    public String getDniCliente() { return dniCliente; }
    public String getTrabajador() { return trabajador; }
    public String getDescripcion() { return descripcion; }
    public byte[] getFirma() { return firma; }
    public String getFirmaTipoContenido() { return firmaTipoContenido; }
    public Long getTrabajoId() { return trabajoId; }

    public void setNumero(Long numero) { this.numero = numero; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }
    public void setCliente(String cliente) { this.cliente = cliente; }
    public void setDniCliente(String dniCliente) { this.dniCliente = dniCliente; }
    public void setTrabajador(String trabajador) { this.trabajador = trabajador; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public void setFirma(byte[] firma, String tipoContenido) {
        this.firma = firma;
        this.firmaTipoContenido = tipoContenido;
    }
}
