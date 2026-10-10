package com.taller.herreria.material;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MaterialRepository extends JpaRepository<Material, Long> {

    /** Las líneas en el orden en que se escribieron. */
    List<Material> findByOrigenTipoAndOrigenIdOrderByIdAsc(Material.OrigenTipo tipo, Long origenId);

    long countByOrigenTipoAndOrigenId(Material.OrigenTipo tipo, Long origenId);

    void deleteByOrigenTipoAndOrigenId(Material.OrigenTipo tipo, Long origenId);
}
