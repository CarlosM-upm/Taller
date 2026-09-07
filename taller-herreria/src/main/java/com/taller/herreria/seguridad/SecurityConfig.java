package com.taller.herreria.seguridad;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taller.herreria.comun.RespuestaError;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Reparto de permisos, tal como se diseñó:
 * - Albaranes, configuración (contador) y ediciones/borrados de pedidos: SOLO JEFE.
 * - Pedidos (crear, ver, fotos) y trabajos: ambos roles.
 *   (La regla "un trabajo ENVIADO solo lo toca el jefe" se aplica en TrabajoService,
 *    porque depende del estado, no solo de la URL.)
 * - Login: abierto. Todo lo demás requiere estar autenticado.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final TokenAuthFilter tokenFilter;

    public SecurityConfig(TokenAuthFilter tokenFilter) {
        this.tokenFilter = tokenFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, ObjectMapper json) throws Exception {
        http
            .csrf(csrf -> csrf.disable())               // API con token, sin cookies: CSRF no aplica
            .cors(Customizer.withDefaults())            // usa el bean de ConfiguracionCors
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Sin esto, una petición sin token devuelve 403 (Spring Security usa
            // Http403ForbiddenEntryPoint por defecto) y el cliente no puede
            // distinguir "no he entrado" de "no tengo permiso".
            .exceptionHandling(e -> e
                .authenticationEntryPoint((peticion, respuesta, fallo) ->
                    escribirError(json, respuesta, HttpStatus.UNAUTHORIZED,
                        "No ha iniciado sesión o el token no es válido", peticion.getRequestURI()))
                .accessDeniedHandler((peticion, respuesta, fallo) ->
                    escribirError(json, respuesta, HttpStatus.FORBIDDEN,
                        "No tiene permiso para esta operación", peticion.getRequestURI())))
            .authorizeHttpRequests(auth -> auth
                // Abierto
                .requestMatchers("/api/login").permitAll()

                // Solo JEFE: albaranes (incluida su creación desde el trabajo) y configuración
                .requestMatchers("/api/albaranes/**").hasRole("JEFE")
                .requestMatchers("/api/trabajos/*/albaran").hasRole("JEFE")
                .requestMatchers("/api/config/**").hasRole("JEFE")

                // Solo JEFE: editar y borrar pedidos, incluidas sus fotos.
                // Decidido así: el pedido nace ya finalizado, no tiene borrador,
                // así que una vez creado es territorio del jefe.
                .requestMatchers(HttpMethod.PATCH,  "/api/pedidos/**").hasRole("JEFE")
                .requestMatchers(HttpMethod.DELETE, "/api/pedidos/**").hasRole("JEFE")

                // Resto de la API: cualquier usuario autenticado (trabajador o jefe)
                .requestMatchers("/api/**").authenticated()

                // Fuera de /api (la futura PWA servida como estáticos): abierto
                .anyRequest().permitAll()
            )
            .addFilterBefore(tokenFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Los rechazos por token o permiso ocurren en la cadena de filtros, antes
     * de llegar a ManejadorErrores. Se escribe aquí el mismo cuerpo JSON para
     * que el cliente no tenga que interpretar dos formatos de error distintos.
     */
    private static void escribirError(ObjectMapper json, HttpServletResponse respuesta,
                                      HttpStatus estado, String mensaje, String ruta)
            throws IOException {
        respuesta.setStatus(estado.value());
        respuesta.setContentType(MediaType.APPLICATION_JSON_VALUE);
        respuesta.setCharacterEncoding(StandardCharsets.UTF_8.name());
        json.writeValue(respuesta.getWriter(), RespuestaError.de(estado, mensaje, ruta));
    }
}
