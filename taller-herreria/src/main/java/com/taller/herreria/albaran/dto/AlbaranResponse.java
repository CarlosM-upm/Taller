package com.taller.herreria.albaran.dto;

import com.taller.herreria.material.dto.MaterialDto;
import com.taller.herreria.trabajador.dto.TrabajadorDto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * El coste va calculado, no guardado: sale de las líneas, las horas y el
 * importe extra. Se envía ya resuelto para que la pantalla no tenga que
 * repetir la aritmética y para que lo que se imprime y lo que se ve en la
 * aplicación no puedan discrepar nunca.
 */
public record AlbaranResponse(
        Long id,
        Long numero,
        LocalDate fecha,
        Long clienteId,
        String cliente,
        String dniCliente,
        List<TrabajadorDto.Resumen> trabajadores,
        String descripcion,
        BigDecimal horas,
        List<MaterialDto> materiales,
        BigDecimal precioHora,
        /** Materiales + mano de obra. No editable: es la suma. */
        BigDecimal costeSumado,
        /** Lo que añade el jefe a mano. */
        BigDecimal importeExtra,
        /** costeSumado + importeExtra. Lo único que puede salir impreso. */
        BigDecimal costeTotal,
        boolean incluirTotal,
        boolean tieneFirma,
        List<Long> trabajoIds,
        List<Long> fotoIds
) { }
