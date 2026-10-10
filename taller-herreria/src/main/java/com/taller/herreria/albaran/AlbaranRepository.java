package com.taller.herreria.albaran;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AlbaranRepository extends JpaRepository<Albaran, Long> {

    boolean existsByNumero(Long numero);

    /**
     * El albarán que contiene ese trabajo, si existe. Hay que recorrer la
     * colección porque la relación dejó de ser una columna: un albarán puede
     * unificar varios trabajos.
     */
    @Query("select a from Albaran a join a.trabajoIds t where t = :trabajoId")
    Optional<Albaran> findPorTrabajo(@Param("trabajoId") Long trabajoId);

    /**
     * Todos los trabajos que ya están en algún albarán, de una sola consulta.
     *
     * El listado necesita marcar cuáles están facturados; preguntarlo trabajo a
     * trabajo serían tantas consultas como filas, que es justo lo que hay que
     * evitar en un mini-PC.
     */
    @Query("select t from Albaran a join a.trabajoIds t")
    List<Long> idsDeTrabajosFacturados();
}
