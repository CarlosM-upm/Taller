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

    /**
     * El cliente que se quiere poner en un pedido, trabajo o albarán.
     *
     * Solo se puede elegir uno con DNI: el albarán lo lee de aquí y no se
     * teclea en ningún otro sitio. Si el documento YA tenía ese cliente no se
     * vuelve a exigir, para no bloquear la edición de un pedido antiguo cuyo
     * cliente aún no tiene DNI (los formularios mandan el cliente aunque no
     * cambie).
     */
    @Transactional(readOnly = true)
    public Cliente paraElegir(Long id, Cliente actual) {
        if (actual != null && actual.getId().equals(id)) return actual;
        Cliente cliente = buscarOFallar(id);
        if (!cliente.tieneDni()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El cliente \"" + cliente.getNombre() + "\" no tiene DNI: "
                            + "el jefe tiene que ponérselo en Ajustes antes de poder elegirlo");
        }
        return cliente;
    }

    public Cliente crear(String nombre, String dni) {
        String limpio = exigirNombre(nombre);
        exigirQueNoSeRepita(limpio, null);
        String dniLimpio = Dni.normalizar(dni);
        exigirDniLibre(dniLimpio, null);
        return repositorio.save(new Cliente(limpio, dniLimpio));
    }

    /**
     * Cambiar el nombre o el DNI afecta a todos los documentos del cliente,
     * incluidos albaranes ya firmados. Es intencionado: sirve para corregir
     * erratas.
     */
    public Cliente editar(Long id, String nombre, String dni) {
        String limpio = exigirNombre(nombre);
        exigirQueNoSeRepita(limpio, id);
        String dniLimpio = Dni.normalizar(dni);
        exigirDniLibre(dniLimpio, id);
        Cliente cliente = buscarOFallar(id);
        cliente.setNombre(limpio);
        cliente.setDni(dniLimpio);
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

    /** Dos clientes con el mismo DNI son el mismo cliente dado de alta dos veces. */
    private void exigirDniLibre(String dni, Long idAExcluir) {
        repositorio.findByDni(dni)
                .filter(existente -> !existente.getId().equals(idAExcluir))
                .ifPresent(existente -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "El DNI " + dni + " ya es del cliente \"" + existente.getNombre() + "\"");
                });
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
