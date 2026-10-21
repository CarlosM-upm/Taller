package com.taller.herreria.albaran;

import com.taller.herreria.cliente.Cliente;
import com.taller.herreria.trabajador.Trabajador;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Albarán. Solo lo crea el jefe, a partir de uno o varios trabajos ENVIADOS del
 * mismo cliente. Al crearse COPIA los datos del trabajo (instantánea):
 * a partir de ahí el jefe los edita sin tocar el trabajo original.
 * El número es único y sale del contador editable de configuración.
 */
@Entity
@Table(name = "albaranes",
       uniqueConstraints = @UniqueConstraint(name = "uq_albaran_numero", columnNames = "numero"))
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
     * Horas del trabajo (o la suma, si unifica varios). Copiadas al crearlo.
     * Son la base del cálculo del coste junto con el precio por hora.
     */
    @Column(precision = 7, scale = 2)
    private BigDecimal horas;

    /** Precio por hora de mano de obra. Lo pone el jefe al facturar. */
    @Column(precision = 10, scale = 2)
    private BigDecimal precioHora;

    /**
     * Cantidad suelta en euros que se suma al final: desplazamiento, un extra
     * pactado… Admite negativo para aplicar un descuento.
     */
    @Column(precision = 10, scale = 2)
    private BigDecimal importeExtra;

    /**
     * Si el total sale impreso en el PDF que se entrega al cliente.
     *
     * Por defecto NO. Es preferible que el jefe lo marque a propósito a que se
     * imprima un precio sin querer en un documento que se entrega en mano.
     */
    @Column(nullable = false)
    private boolean incluirTotal = false;

    /**
     * Firma del cliente (imagen capturada), como bytea.
     * Sin @Lob ni fetch = LAZY, por los mismos motivos que Foto.datos:
     * @Lob la convertiría en un large object que no se borra con la fila,
     * y el lazy no funciona sin instrumentación de bytecode (y si funcionara,
     * rompería GET /api/albaranes/{id}/firma con open-in-view = false).
     */
    private byte[] firma;

    private String firmaTipoContenido;

    /**
     * Trabajos de los que nació. Normalmente uno, pero puede unificar varios
     * del mismo cliente en un único documento.
     *
     * EAGER explícito, como el resto: el paso a DTO ocurre fuera de la
     * transacción con open-in-view a false.
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "albaran_trabajos",
            joinColumns = @JoinColumn(name = "albaran_id"))
    @Column(name = "trabajo_id", nullable = false)
    private Set<Long> trabajoIds = new LinkedHashSet<>();

    protected Albaran() { } // requerido por JPA

    public Albaran(Long numero, LocalDate fecha, Cliente cliente,
                   Set<Trabajador> trabajadores, String descripcion, Set<Long> trabajoIds) {
        this.numero = numero;
        this.fecha = fecha;
        this.cliente = cliente;
        this.trabajadores = new LinkedHashSet<>(trabajadores);
        this.descripcion = descripcion;
        this.trabajoIds = new LinkedHashSet<>(trabajoIds);
    }

    public Long getId() { return id; }
    public Long getNumero() { return numero; }
    public LocalDate getFecha() { return fecha; }
    public Cliente getCliente() { return cliente; }
    public Set<Trabajador> getTrabajadores() { return trabajadores; }
    public String getDescripcion() { return descripcion; }
    public BigDecimal getHoras() { return horas; }
    public BigDecimal getPrecioHora() { return precioHora; }
    public BigDecimal getImporteExtra() { return importeExtra; }
    public boolean isIncluirTotal() { return incluirTotal; }
    public byte[] getFirma() { return firma; }
    public String getFirmaTipoContenido() { return firmaTipoContenido; }
    public Set<Long> getTrabajoIds() { return trabajoIds; }

    public void setNumero(Long numero) { this.numero = numero; }
    public void setFecha(LocalDate fecha) { this.fecha = fecha; }
    public void setCliente(Cliente cliente) { this.cliente = cliente; }

    public void setTrabajadores(Set<Trabajador> trabajadores) {
        this.trabajadores = new LinkedHashSet<>(trabajadores);
    }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public void setHoras(BigDecimal horas) { this.horas = horas; }
    public void setPrecioHora(BigDecimal precioHora) { this.precioHora = precioHora; }
    public void setImporteExtra(BigDecimal importeExtra) { this.importeExtra = importeExtra; }
    public void setIncluirTotal(boolean incluirTotal) { this.incluirTotal = incluirTotal; }

    /** La mano de obra: horas x precio por hora, a dos decimales. */
    public BigDecimal importeManoDeObra() {
        if (horas == null || precioHora == null) return BigDecimal.ZERO;
        return horas.multiply(precioHora).setScale(2, RoundingMode.HALF_UP);
    }

    public void setFirma(byte[] firma, String tipoContenido) {
        this.firma = firma;
        this.firmaTipoContenido = tipoContenido;
    }
}
