package com.taller.herreria.trabajador;

import com.taller.herreria.trabajador.dto.TrabajadorDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Trabajadores. Los dos roles los consultan (la tablet los elige en los
 * desplegables); crearlos, editarlos y borrarlos es solo del jefe, y eso se
 * controla en SecurityConfig.
 */
@RestController
@RequestMapping("/api/trabajadores")
public class TrabajadorController {

    private final TrabajadorService servicio;

    public TrabajadorController(TrabajadorService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public List<TrabajadorDto.Resumen> listar() {
        return servicio.listar().stream().map(TrabajadorDto.Resumen::de).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TrabajadorDto.Resumen crear(@Valid @RequestBody TrabajadorDto.Datos datos) {
        return TrabajadorDto.Resumen.de(servicio.crear(datos.nombre()));
    }

    @PutMapping("/{id}")
    public TrabajadorDto.Resumen renombrar(@PathVariable Long id,
                                           @Valid @RequestBody TrabajadorDto.Datos datos) {
        return TrabajadorDto.Resumen.de(servicio.renombrar(id, datos.nombre()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrar(@PathVariable Long id) {
        servicio.borrar(id);
    }
}
