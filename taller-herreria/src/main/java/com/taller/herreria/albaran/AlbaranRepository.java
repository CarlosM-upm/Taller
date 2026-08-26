package com.taller.herreria.albaran;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AlbaranRepository extends JpaRepository<Albaran, Long> {

    boolean existsByTrabajoId(Long trabajoId);

    boolean existsByNumero(Long numero);

    Optional<Albaran> findByTrabajoId(Long trabajoId);
}
