package com.taller.herreria.pedido;

import com.taller.herreria.documento.RespuestaPdf;
import com.taller.herreria.foto.Foto;
import com.taller.herreria.pedido.dto.PedidoPatch;
import com.taller.herreria.pedido.dto.PedidoRequest;
import com.taller.herreria.pedido.dto.PedidoResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * Endpoints REST de pedidos, tal como se diseñaron.
 * (La restricción de roles trabajador/jefe se añadirá en la capa de seguridad.)
 */
@RestController
@RequestMapping("/api/pedidos")
public class PedidoController {

    private final PedidoService servicio;

    public PedidoController(PedidoService servicio) {
        this.servicio = servicio;
    }

    /** Crear un pedido (tablet). La fecha la pone el servidor. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PedidoResponse crear(@Valid @RequestBody PedidoRequest datos) {
        return servicio.crear(datos);
    }

    @GetMapping
    public List<PedidoResponse> listar() {
        return servicio.listar();
    }

    @GetMapping("/{id}")
    public PedidoResponse obtener(@PathVariable Long id) {
        return servicio.obtener(id);
    }

    /** Documento PDF del pedido (solo jefe). */
    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable Long id) {
        return RespuestaPdf.de(servicio.pdf(id));
    }

    /** Edición parcial (solo jefe). */
    @PatchMapping("/{id}")
    public PedidoResponse editar(@PathVariable Long id, @RequestBody PedidoPatch cambios) {
        return servicio.editar(id, cambios);
    }

    /** Borrado (solo jefe). */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrar(@PathVariable Long id) {
        servicio.borrar(id);
    }

    // ---------- Fotos ----------

    /** Subir una o varias fotos (máximo 5 en total por pedido). */
    @PostMapping(path = "/{id}/fotos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public List<Long> subirFotos(@PathVariable Long id,
                                 @RequestParam("fotos") List<MultipartFile> fotos) {
        return servicio.subirFotos(id, fotos);
    }

    /** Descargar una foto concreta (para mostrarla en el cliente). */
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
