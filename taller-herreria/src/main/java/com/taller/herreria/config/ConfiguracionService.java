package com.taller.herreria.config;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class ConfiguracionService {

    private final ConfiguracionRepository repositorio;

    public ConfiguracionService(ConfiguracionRepository repositorio) {
        this.repositorio = repositorio;
    }

    /** Obtiene la fila de configuración, creándola con valores iniciales si no existe. */
    public Configuracion obtener() {
        return repositorio.findById(Configuracion.ID_UNICO)
                .orElseGet(() -> repositorio.save(Configuracion.inicial()));
    }

    public long tomarNumeroDeAlbaran() {
        return obtener().tomarNumero();
    }

    public long consultarProximoNumero() {
        return obtener().getProximoNumeroAlbaran();
    }

    /** El jefe reencauza la serie de numeración. */
    public long cambiarProximoNumero(Long nuevoValor) {
        if (nuevoValor == null || nuevoValor < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El próximo número de albarán debe ser 1 o mayor");
        }
        Configuracion config = obtener();
        config.setProximoNumeroAlbaran(nuevoValor);
        return nuevoValor;
    }
}
