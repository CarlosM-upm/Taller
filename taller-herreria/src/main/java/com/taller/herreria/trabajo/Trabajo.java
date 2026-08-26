package com.taller.herreria.trabajo;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Trabajo realizado. Lo crea el trabajador desde la tablet y nace como BORRADOR:
 * puede guardarse a medias y completarse otro día. Al enviarlo pasa a ENVIADO
 * y es entonces cuando se estampa la fecha. Una vez enviado, solo el jefe
 * puede modificarlo (la restricción por rol llegará con la capa de seguridad).
 */
@Entity
@Table(name = "trabajos")
public class Trabajo {

    public enum Estado { BORRADOR, ENVIADO }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Estado estado = Estado.BORRADOR;

    /** Fecha del envío definitivo. Vacía mientras el trabajo es borrador. */
    private LocalDate fecha;

    private String cliente;

    private String trabajador;

    @Column(length = 4000)
    private String descripcion;

    /** Texto libre: "2 m de perfil, 4 tornillos…" */
    @Column(length = 4000)
    private String materiales;

    /**
     * Horas empleadas. BigDecimal con 2 decimales: decimal EXACTO,
     * sin errores de redondeo al sumar. Acepta enteros ("3" se guarda como 3.00).
     */
    @Column(precision = 7, scale = 2)
    private BigDecimal horas;

    protected Trabajo() { } // requerido por JPA

    public static Trabajo nuevoBorrador() {
        return new Trabajo();
    }

    /** Envío definitivo: cambia el estado y estampa la fecha. */
    public void enviar() {
        this.estado = Estado.ENVIADO;
        this.fecha = LocalDate.now();
    }

    public boolean esBorrador() { return estado == Estado.BORRADOR; }

    public Long getId() { return id; }
    public Estado getEstado() { return estado; }
    public LocalDate getFecha() { return fecha; }
    public String getCliente() { return cliente; }
    public String getTrabajador() { return trabajador; }
    public String getDescripcion() { return descripcion; }
    public String getMateriales() { return materiales; }
    public BigDecimal getHoras() { return horas; }

    public void setCliente(String cliente) { this.cliente = cliente; }
    public void setTrabajador(String trabajador) { this.trabajador = trabajador; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public void setMateriales(String materiales) { this.materiales = materiales; }
    public void setHoras(BigDecimal horas) { this.horas = horas; }
}
