package com.taller.herreria.seguridad;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(DatosIniciales.class);

    @Bean
    CommandLineRunner crearUsuariosIniciales(UsuarioRepository usuarios, PasswordEncoder encoder) {
        return args -> {
            boolean creadaAlguna = false;
            if (usuarios.findByNombre("tablet").isEmpty()) {
                usuarios.save(new Usuario("tablet", encoder.encode("tablet123"), Usuario.Rol.TRABAJADOR));
                creadaAlguna = true;
            }
            if (usuarios.findByNombre("jefe").isEmpty()) {
                usuarios.save(new Usuario("jefe", encoder.encode("jefe123"), Usuario.Rol.JEFE));
                creadaAlguna = true;
            }
            if (creadaAlguna) {
                log.warn("Cuentas iniciales creadas con contraseñas por defecto. " +
                         "Cámbielas con PUT /api/password antes de usar el sistema en el taller.");
            }
        };
    }
}
