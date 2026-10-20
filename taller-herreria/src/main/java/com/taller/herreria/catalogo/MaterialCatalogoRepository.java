package com.taller.herreria.catalogo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MaterialCatalogoRepository extends JpaRepository<MaterialCatalogo, Long> {

    /** Ordenado por familia y, dentro, por nombre: es como se pinta el desplegable. */
    List<MaterialCatalogo> findAllByOrderByFamiliaNombreAscNombreAsc();

    List<MaterialCatalogo> findByFamiliaIdOrderByNombreAsc(Long familiaId);

    Optional<MaterialCatalogo> findByFamiliaIdAndNombreIgnoreCase(Long familiaId, String nombre);

    long countByFamiliaId(Long familiaId);
}
