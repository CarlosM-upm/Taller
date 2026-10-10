package com.taller.herreria.cliente;

import com.taller.herreria.cliente.dto.ClienteDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Clientes. Consultarlos lo necesitan los dos roles (la tablet los elige en
 * los desplegables); crearlos, editarlos y borrarlos es solo del jefe, y eso
 * se controla en SecurityConfig.
 */
@RestController
@RequestMapping("/api/clientes")
public class ClienteController {

    private final ClienteService servicio;

    public ClienteController(ClienteService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public List<ClienteDto.Resumen> listar() {
        return servicio.listar().stream().map(ClienteDto.Resumen::de).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClienteDto.Resumen crear(@Valid @RequestBody ClienteDto.Datos datos) {
        return ClienteDto.Resumen.de(servicio.crear(datos.nombre()));
    }

    @PutMapping("/{id}")
    public ClienteDto.Resumen renombrar(@PathVariable Long id,
                                        @Valid @RequestBody ClienteDto.Datos datos) {
        return ClienteDto.Resumen.de(servicio.renombrar(id, datos.nombre()));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrar(@PathVariable Long id) {
        servicio.borrar(id);
    }
}
