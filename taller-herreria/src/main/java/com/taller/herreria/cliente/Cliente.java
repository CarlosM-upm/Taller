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

    protected Cliente() { } // requerido por JPA

    public Cliente(String nombre) {
        this.nombre = nombre;
    }

    public Long getId() { return id; }
    public String getNombre() { return nombre; }

    public void setNombre(String nombre) { this.nombre = nombre; }
}
