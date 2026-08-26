package com.taller.herreria.seguridad;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Crea las dos cuentas la primera vez que arranca el sistema
 * (solo si no existen ya). CAMBIAR ESTAS CONTRASEÑAS con PUT /api/password
 * en cuanto el sistema esté en marcha.
 */
@Configuration
public class DatosIniciales {

    @Bean
    CommandLineRunner crearUsuariosIniciales(UsuarioRepository usuarios, PasswordEncoder encoder) {
        return args -> {
            if (usuarios.findByNombre("tablet").isEmpty()) {
                usuarios.save(new Usuario("tablet", encoder.encode("tablet123"), Usuario.Rol.TRABAJADOR));
            }
            if (usuarios.findByNombre("jefe").isEmpty()) {
                usuarios.save(new Usuario("jefe", encoder.encode("jefe123"), Usuario.Rol.JEFE));
            }
        };
    }
}
