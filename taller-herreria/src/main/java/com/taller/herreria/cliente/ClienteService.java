package com.taller.herreria.cliente;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class ClienteService {

    private final ClienteRepository repositorio;

    public ClienteService(ClienteRepository repositorio) {
        this.repositorio = repositorio;
    }

    @Transactional(readOnly = true)
    public List<Cliente> listar() {
        return repositorio.findAllByOrderByNombreAsc();
    }

    @Transactional(readOnly = true)
    public Cliente buscarOFallar(Long id) {
        return repositorio.findById(id).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "No existe el cliente " + id));
    }

    public Cliente crear(String nombre) {
        String limpio = exigirNombre(nombre);
        exigirQueNoSeRepita(limpio, null);
        return repositorio.save(new Cliente(limpio));
    }

    /**
     * Renombrar afecta a todos los documentos del cliente, incluidos albaranes
     * ya firmados. Es intencionado: sirve para corregir erratas.
     */
    public Cliente renombrar(Long id, String nombre) {
        String limpio = exigirNombre(nombre);
        exigirQueNoSeRepita(limpio, id);
        Cliente cliente = buscarOFallar(id);
        cliente.setNombre(limpio);
        return cliente;
    }

    /**
     * Un cliente con documentos no se borra: dejaría pedidos, trabajos o
     * albaranes apuntando al vacío. El mensaje dice cuántos hay de cada cosa
     * para que el jefe sepa qué tiene que mirar.
     */
    public void borrar(Long id) {
        Cliente cliente = buscarOFallar(id);

        long pedidos = repositorio.contarPedidos(id);
        long trabajos = repositorio.contarTrabajos(id);
        long albaranes = repositorio.contarAlbaranes(id);

        if (pedidos + trabajos + albaranes > 0) {
            List<String> partes = new ArrayList<>();
            if (pedidos > 0) partes.add(pedidos + (pedidos == 1 ? " pedido" : " pedidos"));
            if (trabajos > 0) partes.add(trabajos + (trabajos == 1 ? " trabajo" : " trabajos"));
            if (albaranes > 0) partes.add(albaranes + (albaranes == 1 ? " albarán" : " albaranes"));
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No se puede borrar el cliente \"" + cliente.getNombre() + "\": tiene "
                            + String.join(", ", partes));
        }

        repositorio.delete(cliente);
    }

    private String exigirNombre(String nombre) {
        String limpio = nombre == null ? "" : nombre.trim();
        if (limpio.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Indique el nombre del cliente");
        }
        return limpio;
    }

    /** El idAExcluir es el del propio cliente al renombrarlo: no choca consigo mismo. */
    private void exigirQueNoSeRepita(String nombre, Long idAExcluir) {
        repositorio.findByNombreIgnoreCase(nombre)
                .filter(existente -> !existente.getId().equals(idAExcluir))
                .ifPresent(existente -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Ya existe un cliente llamado \"" + existente.getNombre() + "\"");
                });
    }
}
