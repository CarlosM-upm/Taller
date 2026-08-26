package com.taller.herreria.seguridad;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Lee la cabecera "Authorization: Bearer <token>" de cada petición,
 * busca el token en la base de datos y, si es válido, deja identificado
 * al usuario (y su rol) para el resto de la petición.
 */
@Component
public class TokenAuthFilter extends OncePerRequestFilter {

    private final TokenRepository tokens;

    public TokenAuthFilter(TokenRepository tokens) {
        this.tokens = tokens;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String cabecera = request.getHeader("Authorization");

        if (cabecera != null && cabecera.startsWith("Bearer ")) {
            String valor = cabecera.substring(7).trim();
            tokens.findById(valor).ifPresent(token -> {
                Usuario usuario = token.getUsuario();
                var auth = new UsernamePasswordAuthenticationToken(
                        usuario, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + usuario.getRol().name())));
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }
        chain.doFilter(request, response);
    }
}
