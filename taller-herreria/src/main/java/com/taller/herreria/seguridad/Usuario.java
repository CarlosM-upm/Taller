package com.taller.herreria.seguridad;

import jakarta.persistence.*;

/**
 * Cuenta de acceso. Solo hay dos, como decidimos:
 * - "tablet" (rol TRABAJADOR): compartida por los tres del taller.
 * - "jefe"   (rol JEFE): acceso total.
 * La contraseña se guarda cifrada (BCrypt), nunca en claro.
 */
@Entity
@Table(name = "usuarios")
public class Usuario {

    public enum Rol { TRABAJADOR, JEFE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String nombre;

    @Column(nullable = false)
    private String contrasenaHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Rol rol;

    protected Usuario() { }

    public Usuario(String nombre, String contrasenaHash, Rol rol) {
        this.nombre = nombre;
        this.contrasenaHash = contrasenaHash;
        this.rol = rol;
    }

    public Long getId() { return id; }
    public String getNombre() { return nombre; }
    public String getContrasenaHash() { return contrasenaHash; }
    public Rol getRol() { return rol; }

    public void setContrasenaHash(String contrasenaHash) { this.contrasenaHash = contrasenaHash; }
}
