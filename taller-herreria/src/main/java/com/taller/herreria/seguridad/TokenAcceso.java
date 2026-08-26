package com.taller.herreria.seguridad;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * "Pase" de sesión. Se crea al hacer login y se destruye al hacer logout.
 * Vive en la base de datos, así que las sesiones SOBREVIVEN a los reinicios
 * del servidor (importante: el servidor del taller se apaga cada día con los plomos).
 */
@Entity
@Table(name = "tokens_acceso")
public class TokenAcceso {

    @Id
    @Column(length = 64)
    private String token;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    private Usuario usuario;

    @Column(nullable = false)
    private Instant creado;

    protected TokenAcceso() { }

    public TokenAcceso(String token, Usuario usuario) {
        this.token = token;
        this.usuario = usuario;
        this.creado = Instant.now();
    }

    public String getToken() { return token; }
    public Usuario getUsuario() { return usuario; }
    public Instant getCreado() { return creado; }
}
