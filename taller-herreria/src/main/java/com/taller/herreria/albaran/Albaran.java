package com.taller.herreria.albaran;

import com.taller.herreria.cliente.Cliente;
import com.taller.herreria.trabajador.Trabajador;
import jakarta.persistence.*;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

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

    /**
     * Cliente y trabajadores son REFERENCIAS, no copias. Es la excepción a que
     * el albarán sea una instantánea: renombrarlos en Ajustes se refleja aquí,
     * incluso en albaranes ya firmados, para poder corregir erratas.
     */
    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    private String dniCliente;   // lo teclea el jefe

    /**
     * Varios, porque un albarán puede unificar trabajos de distintas personas.
     * EAGER explícito: ManyToMany es LAZY por defecto y el paso a DTO ocurre
     * fuera de la transacción (open-in-view a false).
     */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "albaran_trabajadores",
            joinColumns = @JoinColumn(name = "albaran_id"),
            inverseJoinColumns = @JoinColumn(name = "trabajador_id"))
    private Set<Trabajador> trabajadores = new LinkedHashSet<>();

    @Column(nullable = false, length = 4000)
    private String descripcion;  // copiada del trabajo

    /**
     * Firma del cliente (imagen capturada), como bytea.
     * Sin @Lob ni fetch = LAZY, por los mismos motivos que Foto.datos:
     * @Lob la convertiría en un large object que no se borra con la fila,
     * y el lazy no funciona sin instrumentación de bytecode (y si funcionara,
     * rompería GET /api/albaranes/{id}/firma con open-in-view = false).
     */
    private byte[] firma;

    private String firmaTipoContenido;

    /** Trabajo del que nació (uno a uno). */
    @Column(name = "trabajo_id", nullable = false)
    private Long trabajoId;

    protected Albaran() { } // requerido por JPA

    public Albaran(Long numero, LocalDate fecha, Cliente cliente, String dniCliente,
                   Set<Trabajador> trabajadores, String descripcion, Long trabajoId) {
        this.numero = numero;
        this.fecha = fecha;
        this.cliente = cliente;
        this.dniCliente = dniCliente;
        this.trabajadores = new LinkedHashSet<>(trabajadores);
        this.descripcion = descripcion;
        this.trabajoId = trabajoId;
    }

    public Long getId() { return id; }
    public Long getNumero() { return numero; }
    public LocalDate getFecha() { return fecha; }
    public Cliente getCliente() { return cliente; }
    public String getDniCliente() { return dniCliente; }
    public Set<Trabajador> getTrabajadores() { return trabajadores; }
    public String getDescripcion() { return descripcion; }
    public byte[] getFirma() { return firma; }
    public String getFirmaTipoContenido() { return firmaTipoContenido; }
    public Long getTrabajoId() { return trabajoId; }

    public void setNumero(Long numero) { this.numero = numero; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }
    public void setDniCliente(String dniCliente) { this.dniCliente = dniCliente; }

    public void setTrabajadores(Set<Trabajador> trabajadores) {
        this.trabajadores = new LinkedHashSet<>(trabajadores);
    }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public void setFirma(byte[] firma, String tipoContenido) {
        this.firma = firma;
        this.firmaTipoContenido = tipoContenido;
    }
}
