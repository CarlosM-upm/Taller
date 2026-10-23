package com.taller.herreria.albaran;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

public interface AlbaranRepository extends JpaRepository<Albaran, Long> {

    /**
     * El albarán, o 404 con un mensaje para el jefe. Va aquí y no en un servicio
     * porque lo necesitan las cuatro clases del albarán (edición, fotos, PDF y
     * firma) y así ninguna depende de otra solo para buscarlo.
     */
    default Albaran buscarOFallar(Long id) {
        return findById(id).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "No existe el albarán " + id));
    }

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
