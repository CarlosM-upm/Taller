package com.taller.herreria.seguridad;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Map;

@Service
@Transactional
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UsuarioRepository usuarios;
    private final TokenRepository tokens;
    private final PasswordEncoder encoder;
    private final SecureRandom random = new SecureRandom();

    public AuthService(UsuarioRepository usuarios, TokenRepository tokens, PasswordEncoder encoder) {
        this.usuarios = usuarios;
        this.tokens = tokens;
        this.encoder = encoder;
    }

    /** Login: valida credenciales y devuelve un token nuevo. */
    public Map<String, String> login(String nombre, String contrasena) {
        // Sin esta comprobación, un cuerpo incompleto llega a BCrypt con null
        // y revienta con un 500 en lugar de decir qué falta.
        if (esBlanco(nombre) || esBlanco(contrasena)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Indique usuario y contraseña");
        }

        Usuario usuario = usuarios.findByNombre(nombre)
                .filter(u -> encoder.matches(contrasena, u.getContrasenaHash()))
                .orElseThrow(() -> {
                    log.warn("Intento de acceso fallido con el usuario '{}'", nombre);
                    return new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                            "Usuario o contraseña incorrectos");
                });

        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);

        tokens.save(new TokenAcceso(token, usuario));
        log.info("Sesión iniciada por '{}' ({})", usuario.getNombre(), usuario.getRol());
        return Map.of("token", token, "rol", usuario.getRol().name());
    }

    /** Logout: destruye el token. Para volver a entrar, login de nuevo. */
    public void logout(String token) {
        tokens.deleteById(token);
    }

    /** Cambio de contraseña del propio usuario autenticado. */
    public void cambiarContrasena(Usuario usuario, String actual, String nueva) {
        if (esBlanco(actual)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Indique la contraseña actual");
        }
        if (!encoder.matches(actual, usuario.getContrasenaHash())) {
            log.warn("Cambio de contraseña rechazado para '{}': la actual no coincide",
                    usuario.getNombre());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La contraseña actual no es correcta");
        }
        if (nueva == null || nueva.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La contraseña nueva debe tener al menos 6 caracteres");
        }
        usuario.setContrasenaHash(encoder.encode(nueva));
        usuarios.save(usuario);
        log.info("Contraseña cambiada para el usuario '{}'", usuario.getNombre());
    }

    private boolean esBlanco(String s) {
        return s == null || s.isBlank();
    }
}
