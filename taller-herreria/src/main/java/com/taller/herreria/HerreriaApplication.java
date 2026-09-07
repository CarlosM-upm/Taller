package com.taller.herreria;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

/**
 * Se excluye UserDetailsServiceAutoConfiguration a propósito.
 *
 * Sin esa exclusión, Spring Security ve que no hay ningún UserDetailsService
 * declarado y crea uno en memoria con un usuario "user" y una contraseña
 * aleatoria, que además imprime en el arranque:
 *
 *     Using generated security password: 1ab99249-...
 *
 * No es un agujero: la autenticación de esta aplicación la hace únicamente
 * TokenAuthFilter, y la cadena no habilita httpBasic ni formLogin, así que ese
 * usuario no puede entrar por ningún sitio. Pero sí es ruido, y de la peor
 * clase: una contraseña distinta en cada arranque, escrita en logs/herreria.log,
 * que se conserva 30 días en un servidor sin nadie delante. Quien lea ese
 * fichero buscando un problema perdería el tiempo con ella.
 *
 * Las cuentas de verdad son las dos de la tabla "usuarios" (ver seguridad/).
 */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class HerreriaApplication {

    public static void main(String[] args) {
        SpringApplication.run(HerreriaApplication.class, args);
    }
}
