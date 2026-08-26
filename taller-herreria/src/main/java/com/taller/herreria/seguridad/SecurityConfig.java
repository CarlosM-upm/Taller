package com.taller.herreria.seguridad;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

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
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())               // API con token, sin cookies: CSRF no aplica
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Abierto
                .requestMatchers("/api/login").permitAll()

                // Solo JEFE: albaranes (incluida su creación desde el trabajo) y configuración
                .requestMatchers("/api/albaranes/**").hasRole("JEFE")
                .requestMatchers("/api/trabajos/*/albaran").hasRole("JEFE")
                .requestMatchers("/api/config/**").hasRole("JEFE")

                // Solo JEFE: editar y borrar pedidos ya creados (y sus fotos)
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
}
