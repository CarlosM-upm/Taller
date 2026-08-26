package com.taller.herreria.seguridad;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TokenRepository extends JpaRepository<TokenAcceso, String> {
}
