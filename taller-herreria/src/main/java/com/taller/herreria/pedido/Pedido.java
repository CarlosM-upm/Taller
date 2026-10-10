package com.taller.herreria.pedido;

import com.taller.herreria.cliente.Cliente;
import com.taller.herreria.trabajador.Trabajador;
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

    /**
     * Cliente y trabajador son referencias, no texto copiado: renombrarlos en
     * Ajustes se refleja aquí.
     *
     * Van EAGER (el valor por defecto de ManyToOne, explícito para que se vea):
     * con open-in-view a false, el paso a DTO ocurre fuera de la transacción y
     * una relación perezosa lanzaría LazyInitializationException.
     */
    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "trabajador_id", nullable = false)
    private Trabajador trabajador;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @Column(nullable = false, length = 4000)
    private String descripcion;

    protected Pedido() { } // requerido por JPA

    public Pedido(Trabajador trabajador, Cliente cliente, String descripcion) {
        this.fecha = LocalDate.now();
        this.trabajador = trabajador;
        this.cliente = cliente;
        this.descripcion = descripcion;
    }

    public Long getId() { return id; }
    public LocalDate getFecha() { return fecha; }
    public Trabajador getTrabajador() { return trabajador; }
    public Cliente getCliente() { return cliente; }
    public String getDescripcion() { return descripcion; }

    // Solo el jefe llega a estas ediciones (se controla en la capa de seguridad)
    public void setTrabajador(Trabajador trabajador) { this.trabajador = trabajador; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
}
