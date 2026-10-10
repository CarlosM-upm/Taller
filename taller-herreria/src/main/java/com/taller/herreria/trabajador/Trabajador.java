package com.taller.herreria.trabajador;

import jakarta.persistence.*;

/**
 * Persona del taller que hace el trabajo. Los gestiona el jefe desde Ajustes.
 *
 * No tiene nada que ver con las cuentas de acceso de seguridad/: son tres
 * trabajadores compartiendo la cuenta "tablet", y aquí se registra quién hizo
 * cada cosa. No es trazabilidad de sesión, es un dato del documento.
 */
@Entity
@Table(name = "trabajadores")
public class Trabajador {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    protected Trabajador() { } // requerido por JPA

    public Trabajador(String nombre) {
        this.nombre = nombre;
    }

    public Long getId() { return id; }
    public String getNombre() { return nombre; }

    public void setNombre(String nombre) { this.nombre = nombre; }
}
