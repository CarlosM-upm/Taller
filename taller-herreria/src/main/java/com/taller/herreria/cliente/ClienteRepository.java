package com.taller.herreria.cliente;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {

    List<Cliente> findAllByOrderByNombreAsc();

    /** Para detectar duplicados sin distinguir mayúsculas al crear o renombrar. */
    Optional<Cliente> findByNombreIgnoreCase(String nombre);

    /** El DNI se guarda ya limpio, así que basta comparar tal cual. */
    Optional<Cliente> findByDni(String dni);

    /**
     * Cuenta los documentos que apuntan a este cliente.
     *
     * Las consultas van aquí y no inyectando los tres repositorios en el
     * servicio para no acoplar el paquete cliente/ con los otros tres: JPQL
     * puede preguntar por cualquier entidad, aunque el repositorio sea de
     * Cliente.
     */
    @Query("select count(p) from Pedido p where p.cliente.id = :id")
    long contarPedidos(@Param("id") Long id);

    @Query("select count(t) from Trabajo t where t.cliente.id = :id")
    long contarTrabajos(@Param("id") Long id);

    @Query("select count(a) from Albaran a where a.cliente.id = :id")
    long contarAlbaranes(@Param("id") Long id);
}
