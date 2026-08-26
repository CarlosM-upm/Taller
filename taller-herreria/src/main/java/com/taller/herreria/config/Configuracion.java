package com.taller.herreria.config;

import jakarta.persistence.*;

/**
 * Configuración del sistema. Una única fila (id fijo = 1) que guarda
 * el "próximo número de albarán": el contador editable que decidimos.
 * Cada albarán nuevo toma este valor y el contador avanza solo.
 * El jefe puede cambiarlo para reencauzar la serie si un número salió mal.
 */
@Entity
@Table(name = "configuracion")
public class Configuracion {

    public static final long ID_UNICO = 1L;

    @Id
    private Long id = ID_UNICO;

    @Column(nullable = false)
    private Long proximoNumeroAlbaran = 1L;

    protected Configuracion() { }

    public static Configuracion inicial() {
        return new Configuracion();
    }

    /** Devuelve el número a usar y avanza el contador. */
    public long tomarNumero() {
        long numero = proximoNumeroAlbaran;
        proximoNumeroAlbaran = numero + 1;
        return numero;
    }

    public Long getProximoNumeroAlbaran() { return proximoNumeroAlbaran; }

    public void setProximoNumeroAlbaran(Long valor) { this.proximoNumeroAlbaran = valor; }
}
