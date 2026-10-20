package com.taller.herreria.catalogo;

import jakarta.persistence.*;

/**
 * Familia de materiales: "Tubo", "Tornillería", "Pintura"… Solo sirve para
 * agrupar el catálogo, que si no acaba siendo una lista larga y sin orden.
 * La mantiene el jefe desde Ajustes.
 */
@Entity
@Table(name = "familias_material")
public class FamiliaMaterial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    protected FamiliaMaterial() { } // requerido por JPA

    public FamiliaMaterial(String nombre) {
        this.nombre = nombre;
    }

    public Long getId() { return id; }
    public String getNombre() { return nombre; }

    public void setNombre(String nombre) { this.nombre = nombre; }
}
