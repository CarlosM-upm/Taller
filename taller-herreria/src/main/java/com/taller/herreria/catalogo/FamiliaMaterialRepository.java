package com.taller.herreria.catalogo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FamiliaMaterialRepository extends JpaRepository<FamiliaMaterial, Long> {

    List<FamiliaMaterial> findAllByOrderByNombreAsc();

    Optional<FamiliaMaterial> findByNombreIgnoreCase(String nombre);
}
