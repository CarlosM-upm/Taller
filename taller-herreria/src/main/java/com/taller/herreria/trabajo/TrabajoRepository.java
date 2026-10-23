package com.taller.herreria.trabajo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

public interface TrabajoRepository extends JpaRepository<Trabajo, Long> {

    /**
     * El trabajo, o 404. Va aquí y no en un servicio porque lo necesitan todas
     * las clases del trabajo (ciclo, firma, fotos, PDF) sin depender unas de otras.
     */
    default Trabajo buscarOFallar(Long id) {
        return findById(id).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "No existe el trabajo " + id));
    }

    /** Para que la tablet liste "mis borradores" o "los enviados". */
    List<Trabajo> findByEstado(Trabajo.Estado estado);

    /**
     * Los trabajos enviados de un cliente. Es la consulta que alimenta la
     * pantalla de unificar: se elige un cliente y salen sus trabajos para
     * marcar cuáles van al mismo albarán.
     */
    List<Trabajo> findByEstadoAndClienteId(Trabajo.Estado estado, Long clienteId);

    List<Trabajo> findByClienteId(Long clienteId);
}
