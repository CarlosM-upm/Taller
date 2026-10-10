package com.taller.herreria.trabajador;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class TrabajadorService {

    private final TrabajadorRepository repositorio;

    public TrabajadorService(TrabajadorRepository repositorio) {
        this.repositorio = repositorio;
    }

    @Transactional(readOnly = true)
    public List<Trabajador> listar() {
        return repositorio.findAllByOrderByNombreAsc();
    }

    @Transactional(readOnly = true)
    public Trabajador buscarOFallar(Long id) {
        return repositorio.findById(id).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "No existe el trabajador " + id));
    }

    public Trabajador crear(String nombre) {
        String limpio = exigirNombre(nombre);
        exigirQueNoSeRepita(limpio, null);
        return repositorio.save(new Trabajador(limpio));
    }

    public Trabajador renombrar(Long id, String nombre) {
        String limpio = exigirNombre(nombre);
        exigirQueNoSeRepita(limpio, id);
        Trabajador trabajador = buscarOFallar(id);
        trabajador.setNombre(limpio);
        return trabajador;
    }

    /** Igual que con los clientes: si tiene documentos, no se borra. */
    public void borrar(Long id) {
        Trabajador trabajador = buscarOFallar(id);

        long pedidos = repositorio.contarPedidos(id);
        long trabajos = repositorio.contarTrabajos(id);
        long albaranes = repositorio.contarAlbaranes(id);

        if (pedidos + trabajos + albaranes > 0) {
            List<String> partes = new ArrayList<>();
            if (pedidos > 0) partes.add(pedidos + (pedidos == 1 ? " pedido" : " pedidos"));
            if (trabajos > 0) partes.add(trabajos + (trabajos == 1 ? " trabajo" : " trabajos"));
            if (albaranes > 0) partes.add(albaranes + (albaranes == 1 ? " albarán" : " albaranes"));
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No se puede borrar al trabajador \"" + trabajador.getNombre() + "\": tiene "
                            + String.join(", ", partes));
        }

        repositorio.delete(trabajador);
    }

    private String exigirNombre(String nombre) {
        String limpio = nombre == null ? "" : nombre.trim();
        if (limpio.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Indique el nombre del trabajador");
        }
        return limpio;
    }

    private void exigirQueNoSeRepita(String nombre, Long idAExcluir) {
        repositorio.findByNombreIgnoreCase(nombre)
                .filter(existente -> !existente.getId().equals(idAExcluir))
                .ifPresent(existente -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Ya existe un trabajador llamado \"" + existente.getNombre() + "\"");
                });
    }
}
