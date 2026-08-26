package com.taller.herreria.config;

import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Endpoints de configuración (solo jefe cuando llegue la capa de seguridad). */
@RestController
@RequestMapping("/api/config")
public class ConfiguracionController {

    private final ConfiguracionService servicio;

    public ConfiguracionController(ConfiguracionService servicio) {
        this.servicio = servicio;
    }

    @GetMapping("/proximo-numero-albaran")
    public Map<String, Long> consultar() {
        return Map.of("proximoNumeroAlbaran", servicio.consultarProximoNumero());
    }

    @PutMapping("/proximo-numero-albaran")
    public Map<String, Long> cambiar(@RequestBody Map<String, Long> cuerpo) {
        long valor = servicio.cambiarProximoNumero(cuerpo.get("proximoNumeroAlbaran"));
        return Map.of("proximoNumeroAlbaran", valor);
    }
}
