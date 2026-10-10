package com.taller.herreria.trabajador;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TrabajadorRepository extends JpaRepository<Trabajador, Long> {

    List<Trabajador> findAllByOrderByNombreAsc();

    Optional<Trabajador> findByNombreIgnoreCase(String nombre);

    @Query("select count(p) from Pedido p where p.trabajador.id = :id")
    long contarPedidos(@Param("id") Long id);

    @Query("select count(t) from Trabajo t where t.trabajador.id = :id")
    long contarTrabajos(@Param("id") Long id);

    /** En el albarán los trabajadores son varios, así que hay que recorrer la relación. */
    @Query("select count(a) from Albaran a join a.trabajadores tr where tr.id = :id")
    long contarAlbaranes(@Param("id") Long id);
}
