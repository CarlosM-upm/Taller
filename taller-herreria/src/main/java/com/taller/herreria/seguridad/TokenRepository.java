package com.taller.herreria.seguridad;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TokenRepository extends JpaRepository<TokenAcceso, String> {

    /**
     * Cierra todas las sesiones abiertas de un usuario.
     *
     * Se usa al cambiar la contraseña. Sin esto, cambiarla no echaba fuera a
     * nadie: las sesiones viven en base de datos y no caducan nunca, así que
     * quien ya estuviera dentro seguiría dentro para siempre. El caso que
     * importa es la cuenta "tablet", compartida por los tres trabajadores: si
     * uno se va del taller y se cambia la contraseña, tiene que dejar de tener
     * acceso de verdad.
     */
    void deleteByUsuario(Usuario usuario);
}
