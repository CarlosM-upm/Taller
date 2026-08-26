package com.taller.herreria.seguridad;

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
        Usuario usuario = usuarios.findByNombre(nombre)
                .filter(u -> encoder.matches(contrasena, u.getContrasenaHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Usuario o contraseña incorrectos"));

        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);

        tokens.save(new TokenAcceso(token, usuario));
        return Map.of("token", token, "rol", usuario.getRol().name());
    }

    /** Logout: destruye el token. Para volver a entrar, login de nuevo. */
    public void logout(String token) {
        tokens.deleteById(token);
    }

    /** Cambio de contraseña del propio usuario autenticado. */
    public void cambiarContrasena(Usuario usuario, String actual, String nueva) {
        if (!encoder.matches(actual, usuario.getContrasenaHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La contraseña actual no es correcta");
        }
        if (nueva == null || nueva.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La contraseña nueva debe tener al menos 6 caracteres");
        }
        usuario.setContrasenaHash(encoder.encode(nueva));
        usuarios.save(usuario);
    }
}
