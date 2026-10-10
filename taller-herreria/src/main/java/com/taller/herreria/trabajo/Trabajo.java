package com.taller.herreria.trabajo;

import com.taller.herreria.cliente.Cliente;
import com.taller.herreria.trabajador.Trabajador;
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

    /**
     * Referencias, no texto copiado: renombrarlos en Ajustes se refleja aquí.
     * Admiten nulo porque un borrador puede guardarse a medias; al enviar se
     * comprueba que estén (ver camposQueFaltan en el servicio).
     *
     * EAGER a propósito: con open-in-view a false el paso a DTO ocurre fuera de
     * la transacción, y una relación perezosa lanzaría LazyInitializationException.
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "cliente_id")
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "trabajador_id")
    private Trabajador trabajador;

    @Column(length = 4000)
    private String descripcion;

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
    public Cliente getCliente() { return cliente; }
    public Trabajador getTrabajador() { return trabajador; }
    public String getDescripcion() { return descripcion; }
    public BigDecimal getHoras() { return horas; }

    public void setCliente(Cliente cliente) { this.cliente = cliente; }
    public void setTrabajador(Trabajador trabajador) { this.trabajador = trabajador; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public void setHoras(BigDecimal horas) { this.horas = horas; }
}
