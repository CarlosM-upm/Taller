package com.taller.herreria.foto;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FotoRepository extends JpaRepository<Foto, Long> {

    /**
     * Solo los identificadores, sin traer las imágenes.
     *
     * Es la consulta que usan los listados. Antes se llamaba a
     * findByOrigenTipoAndOrigenId y se descartaban los bytes, pero el
     * "fetch = LAZY" de Foto.datos no funciona sin instrumentación de
     * bytecode: Hibernate cargaba todas las imágenes en memoria para acabar
     * quedándose con un puñado de números. En un mini-PC eso es fatal.
     */
    @Query("select f.id from Foto f "
         + "where f.origenTipo = :tipo and f.origenId = :origenId "
         + "order by f.id")
    List<Long> idsPorOrigen(@Param("tipo") Foto.OrigenTipo tipo,
                            @Param("origenId") Long origenId);

    /** Trae las fotos enteras. Solo para copiarlas (trabajo -> albarán). */
    List<Foto> findByOrigenTipoAndOrigenId(Foto.OrigenTipo tipo, Long origenId);

    long countByOrigenTipoAndOrigenId(Foto.OrigenTipo tipo, Long origenId);

    Optional<Foto> findByIdAndOrigenTipoAndOrigenId(Long id, Foto.OrigenTipo tipo, Long origenId);

    void deleteByOrigenTipoAndOrigenId(Foto.OrigenTipo tipo, Long origenId);
}
