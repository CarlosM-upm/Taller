package com.taller.herreria.trabajo;

import com.taller.herreria.documento.RespuestaPdf;
import com.taller.herreria.foto.Foto;
import com.taller.herreria.trabajo.dto.TrabajoDatos;
import jakarta.validation.Valid;
import com.taller.herreria.trabajo.dto.TrabajoResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Endpoints REST de trabajos realizados, según el diseño acordado.
 * (La restricción de roles trabajador/jefe llegará con la capa de seguridad.)
 */
@RestController
@RequestMapping("/api/trabajos")
public class TrabajoController {

    private final TrabajoService servicio;
    private final FirmaTrabajo firma;
    private final FotosTrabajo fotos;
    private final PdfTrabajo pdf;

    public TrabajoController(TrabajoService servicio, FirmaTrabajo firma,
                             FotosTrabajo fotos, PdfTrabajo pdf) {
        this.servicio = servicio;
        this.firma = firma;
        this.fotos = fotos;
        this.pdf = pdf;
    }

    /** Crear un trabajo (tablet). Nace como BORRADOR, puede venir a medias. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TrabajoResponse crear(@Valid @RequestBody TrabajoDatos datos) {
        return servicio.crear(datos);
    }

    /**
     * Listar. Con ?estado=borrador o ?estado=enviado filtra por estado, y con
     * ?clienteId= por cliente. Los dos se pueden combinar: es lo que usa la
     * pantalla de unificar para sacar los trabajos enviados de un cliente.
     */
    @GetMapping
    public List<TrabajoResponse> listar(@RequestParam(required = false) String estado,
                                        @RequestParam(required = false) Long clienteId) {
        return servicio.listar(estado, clienteId);
    }

    @GetMapping("/{id}")
    public TrabajoResponse obtener(@PathVariable Long id) {
        return servicio.obtener(id);
    }

    /** Documento PDF del trabajo (solo jefe). */
    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable Long id) {
        return RespuestaPdf.de(pdf.generar(id));
    }

    /** Guardar avances del borrador ("sigo otro día") o edición del jefe. */
    @PatchMapping("/{id}")
    public TrabajoResponse editar(@PathVariable Long id,
                                  @Valid @RequestBody TrabajoDatos cambios) {
        return servicio.editar(id, cambios);
    }

    /** Envío definitivo: valida completitud, pasa a ENVIADO y estampa la fecha. */
    @PostMapping("/{id}/enviar")
    public TrabajoResponse enviar(@PathVariable Long id) {
        return servicio.enviar(id);
    }

    /** Descartar un borrador (trabajador) o borrar (jefe). */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrar(@PathVariable Long id) {
        servicio.borrar(id);
    }

    // ---------- Firma del cliente ----------

    /** Recoger la firma (imagen). Las reglas de quién puede, en FirmaTrabajo. */
    @PutMapping(path = "/{id}/firma", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TrabajoResponse guardarFirma(@PathVariable Long id,
                                        @RequestParam("firma") MultipartFile firma) {
        return this.firma.guardar(id, firma);
    }

    @GetMapping("/{id}/firma")
    public ResponseEntity<byte[]> verFirma(@PathVariable Long id) {
        Trabajo trabajo = firma.obtener(id);
        return ResponseEntity.ok()
                .header("Content-Type", trabajo.getFirmaTipoContenido())
                .body(trabajo.getFirma());
    }

    @DeleteMapping("/{id}/firma")
    public TrabajoResponse borrarFirma(@PathVariable Long id) {
        return firma.borrar(id);
    }

    // ---------- Fotos ----------

    @PostMapping(path = "/{id}/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<Long> subirFotos(@PathVariable Long id,
                                 @RequestParam("fotos") List<MultipartFile> fotos) {
        return this.fotos.subir(id, fotos);
    }

    @GetMapping("/{id}/fotos/{fotoId}")
    public ResponseEntity<byte[]> verFoto(@PathVariable Long id, @PathVariable Long fotoId) {
        Foto foto = fotos.obtener(id, fotoId);
        return ResponseEntity.ok()
                .header("Content-Type", foto.getTipoContenido())
                .body(foto.getDatos());
    }

    @DeleteMapping("/{id}/fotos/{fotoId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrarFoto(@PathVariable Long id, @PathVariable Long fotoId) {
        fotos.borrar(id, fotoId);
    }
}
