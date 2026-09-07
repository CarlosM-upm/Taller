package com.taller.herreria.comun;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Permite que la PWA llame a la API desde otro origen.
 *
 * Sin esto, el navegador bloquea todas las peticiones del cliente Angular:
 * la API vive en el 8080 y la PWA se sirve desde otro puerto (o desde la IP
 * del servidor del taller), y eso el navegador lo trata como origen distinto.
 *
 * No se activan credenciales porque la sesión viaja en la cabecera
 * Authorization con un token, no en una cookie.
 */
@Configuration
public class ConfiguracionCors {

    private static final Logger log = LoggerFactory.getLogger(ConfiguracionCors.class);

    private final List<String> origenes;

    public ConfiguracionCors(@Value("${taller.cors.origenes:}") List<String> origenes) {
        this.origenes = origenes;
    }

    /**
     * OJO CON EL NOMBRE: Spring Security busca este bean por el nombre exacto
     * "corsConfigurationSource". Si se renombra el método, deja de aplicarse
     * la configuración y el navegador rechaza en silencio todas las llamadas
     * de la PWA con un 403 "Invalid CORS request".
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration reglas = new CorsConfiguration();
        reglas.setAllowedOrigins(origenes);
        reglas.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        reglas.setAllowedHeaders(List.of("*"));
        reglas.setAllowCredentials(false);
        reglas.setMaxAge(3600L);   // el navegador cachea el preflight una hora

        UrlBasedCorsConfigurationSource fuente = new UrlBasedCorsConfigurationSource();
        fuente.registerCorsConfiguration("/api/**", reglas);

        log.info("CORS activado para estos orígenes: {}", origenes);
        return fuente;
    }
}
