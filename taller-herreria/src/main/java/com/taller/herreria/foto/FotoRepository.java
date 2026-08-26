package com.taller.herreria.foto;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FotoRepository extends JpaRepository<Foto, Long> {

    List<Foto> findByOrigenTipoAndOrigenId(Foto.OrigenTipo tipo, Long origenId);

    long countByOrigenTipoAndOrigenId(Foto.OrigenTipo tipo, Long origenId);

    Optional<Foto> findByIdAndOrigenTipoAndOrigenId(Long id, Foto.OrigenTipo tipo, Long origenId);

    void deleteByOrigenTipoAndOrigenId(Foto.OrigenTipo tipo, Long origenId);
}
