package com.taller.herreria.seguridad;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Utilidades para consultar quién hace la petición desde la lógica de negocio. */
public final class SeguridadUtils {

    private SeguridadUtils() { }

    /** ¿La petición actual la hace el jefe? */
    public static boolean esJefe() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_JEFE"));
    }
}
