package com.taller.herreria.albaran;

import com.taller.herreria.albaran.dto.AlbaranCrear;
import com.taller.herreria.albaran.dto.AlbaranResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * Creación del albarán A PARTIR de un trabajo, como diseñamos:
 * cuelga de la URL del trabajo porque siempre nace de uno.
 */
@RestController
@RequestMapping("/api/trabajos/{trabajoId}/albaran")
public class AlbaranDesdeTrabajoController {

    private final AltaAlbaran alta;

    public AlbaranDesdeTrabajoController(AltaAlbaran alta) {
        this.alta = alta;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AlbaranResponse crear(@PathVariable Long trabajoId,
                                 @RequestBody(required = false) AlbaranCrear datos) {
        return alta.desdeTrabajo(trabajoId, datos);
    }
}
