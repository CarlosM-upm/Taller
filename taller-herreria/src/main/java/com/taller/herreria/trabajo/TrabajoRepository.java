package com.taller.herreria.trabajo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TrabajoRepository extends JpaRepository<Trabajo, Long> {

    /** Para que la tablet liste "mis borradores" o "los enviados". */
    List<Trabajo> findByEstado(Trabajo.Estado estado);
}
