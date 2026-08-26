package com.taller.herreria.seguridad;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService servicio;

    public AuthController(AuthService servicio) {
        this.servicio = servicio;
    }

    public record LoginRequest(String usuario, String contrasena) { }

    @PostMapping("/login")
    public Map<String, String> login(@RequestBody LoginRequest datos) {
        return servicio.login(datos.usuario(), datos.contrasena());
    }

    @PostMapping("/logout")
    public void logout(@RequestHeader("Authorization") String cabecera) {
        servicio.logout(cabecera.replace("Bearer ", "").trim());
    }

    public record CambioContrasena(String actual, String nueva) { }

    @PutMapping("/password")
    public void cambiarContrasena(@AuthenticationPrincipal Usuario usuario,
                                  @RequestBody CambioContrasena datos) {
        servicio.cambiarContrasena(usuario, datos.actual(), datos.nueva());
    }
}
