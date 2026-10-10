package com.taller.herreria.albaran;

import com.taller.herreria.albaran.dto.AlbaranPatch;
import com.taller.herreria.albaran.dto.AlbaranUnificar;
import com.taller.herreria.albaran.dto.AlbaranResponse;
import com.taller.herreria.documento.RespuestaPdf;
import com.taller.herreria.foto.Foto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/** Endpoints REST de albaranes (todo territorio del jefe con la capa de seguridad). */
@RestController
@RequestMapping("/api/albaranes")
public class AlbaranController {

    private final AlbaranService servicio;

    public AlbaranController(AlbaranService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public List<AlbaranResponse> listar() {
        return servicio.listar();
    }

    @GetMapping("/{id}")
    public AlbaranResponse obtener(@PathVariable Long id) {
        return servicio.obtener(id);
    }

    /**
     * Un albarán unificado a partir de varios trabajos del mismo cliente.
     *
     * Va aquí y no colgando de un trabajo (como POST /api/trabajos/{id}/albaran)
     * porque no nace de ninguno en concreto: nace de una selección.
     */
    @PostMapping("/unificado")
    @ResponseStatus(HttpStatus.CREATED)
    public AlbaranResponse unificar(@Valid @RequestBody AlbaranUnificar peticion) {
        return servicio.crearDesdeTrabajos(peticion.trabajoIds(), peticion.datos());
    }

    /** Documento PDF del albarán: el que se imprime y se archiva. */
    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable Long id) {
        return RespuestaPdf.de(servicio.pdf(id));
    }

    /** Edición parcial, incluido el número (con validación de choques). */
    @PatchMapping("/{id}")
    public AlbaranResponse editar(@PathVariable Long id,
                                  @Valid @RequestBody AlbaranPatch cambios) {
        return servicio.editar(id, cambios);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrar(@PathVariable Long id) {
        servicio.borrar(id);
    }

    // ---------- Firma ----------

    /** Guardar la firma del cliente (imagen). Sustituye la anterior si la había. */
    @PutMapping(path = "/{id}/firma", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AlbaranResponse guardarFirma(@PathVariable Long id,
                                        @RequestParam("firma") MultipartFile firma) {
        return servicio.guardarFirma(id, firma);
    }

    @GetMapping("/{id}/firma")
    public ResponseEntity<byte[]> verFirma(@PathVariable Long id) {
        Albaran albaran = servicio.obtenerConFirma(id);
        return ResponseEntity.ok()
                .header("Content-Type", albaran.getFirmaTipoContenido())
                .body(albaran.getFirma());
    }

    // ---------- Fotos ----------

    @PostMapping(path = "/{id}/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<Long> subirFotos(@PathVariable Long id,
                                 @RequestParam("fotos") List<MultipartFile> fotos) {
        return servicio.subirFotos(id, fotos);
    }

    @GetMapping("/{id}/fotos/{fotoId}")
    public ResponseEntity<byte[]> verFoto(@PathVariable Long id, @PathVariable Long fotoId) {
        Foto foto = servicio.obtenerFoto(id, fotoId);
        return ResponseEntity.ok()
                .header("Content-Type", foto.getTipoContenido())
                .body(foto.getDatos());
    }

    @DeleteMapping("/{id}/fotos/{fotoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrarFoto(@PathVariable Long id, @PathVariable Long fotoId) {
        servicio.borrarFoto(id, fotoId);
    }
}
