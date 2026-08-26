package com.taller.herreria.pedido;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PedidoRepository extends JpaRepository<Pedido, Long> {
    // JpaRepository ya nos da: save, findById, findAll, deleteById...
}
