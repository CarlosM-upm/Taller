package com.taller.herreria.cliente;

import jakarta.persistence.*;

/**
 * Cliente del taller. Los gestiona el jefe desde Ajustes.
 *
 * Pedidos, trabajos y albaranes lo referencian en vez de guardar su nombre
 * copiado: así el mismo cliente no acaba escrito de tres formas distintas, y
 * corregir una errata aquí la corrige en todos los documentos a la vez.
 */
@Entity
@Table(name = "clientes")
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    /**
     * Ya limpio (ver {@link Dni}). Lo leen sus albaranes, así que corregirlo
     * lo corrige en todos, igual que el nombre. Puede ser nulo solo en los
     * clientes anteriores a la V7: a esos no se les puede elegir hasta que el
     * jefe se lo ponga.
     */
    private String dni;

    protected Cliente() { } // requerido por JPA

    public Cliente(String nombre, String dni) {
        this.nombre = nombre;
        this.dni = dni;
    }

    public Long getId() { return id; }
    public String getNombre() { return nombre; }
    public String getDni() { return dni; }
    public boolean tieneDni() { return dni != null && !dni.isBlank(); }

    public void setNombre(String nombre) { this.nombre = nombre; }
    public void setDni(String dni) { this.dni = dni; }
}
