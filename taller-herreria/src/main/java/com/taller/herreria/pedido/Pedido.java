package com.taller.herreria.pedido;

import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Pedido que llega al taller. Lo crea el trabajador desde la tablet.
 * La fecha la pone el sistema automáticamente al crearlo;
 * el resto de campos se rellenan a mano.
 */
@Entity
@Table(name = "pedidos")
public class Pedido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Fecha de llegada del pedido. Automática, no se teclea. */
    @Column(nullable = false, updatable = false)
    private LocalDate fecha;

    @Column(nullable = false)
    private String trabajador;

    @Column(nullable = false)
    private String cliente;

    @Column(nullable = false, length = 4000)
    private String descripcion;

    protected Pedido() { } // requerido por JPA

    public Pedido(String trabajador, String cliente, String descripcion) {
        this.fecha = LocalDate.now();
        this.trabajador = trabajador;
        this.cliente = cliente;
        this.descripcion = descripcion;
    }

    public Long getId() { return id; }
    public LocalDate getFecha() { return fecha; }
    public String getTrabajador() { return trabajador; }
    public String getCliente() { return cliente; }
    public String getDescripcion() { return descripcion; }

    // Solo el jefe llega a estas ediciones (se controla en la capa de seguridad)
    public void setTrabajador(String trabajador) { this.trabajador = trabajador; }
    public void setCliente(String cliente) { this.cliente = cliente; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
}
