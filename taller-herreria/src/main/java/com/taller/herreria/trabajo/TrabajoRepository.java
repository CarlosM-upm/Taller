package com.taller.herreria.trabajo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TrabajoRepository extends JpaRepository<Trabajo, Long> {

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
