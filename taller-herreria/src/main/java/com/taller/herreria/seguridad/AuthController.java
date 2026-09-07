package com.taller.herreria.seguridad;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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

    public record LoginRequest(
            @NotBlank(message = "indique el usuario") String usuario,
            @NotBlank(message = "indique la contraseña") String contrasena) { }

    @PostMapping("/login")
    public Map<String, String> login(@Valid @RequestBody LoginRequest datos) {
        return servicio.login(datos.usuario(), datos.contrasena());
    }

    @PostMapping("/logout")
    public void logout(@RequestHeader("Authorization") String cabecera) {
        servicio.logout(cabecera.replace("Bearer ", "").trim());
    }

    public record CambioContrasena(
            @NotBlank(message = "indique la contraseña actual") String actual,
            @NotBlank(message = "indique la contraseña nueva")
            @Size(min = 6, message = "debe tener al menos 6 caracteres") String nueva) { }

    @PutMapping("/password")
    public void cambiarContrasena(@AuthenticationPrincipal Usuario usuario,
                                  @Valid @RequestBody CambioContrasena datos) {
        servicio.cambiarContrasena(usuario, datos.actual(), datos.nueva());
    }
}
