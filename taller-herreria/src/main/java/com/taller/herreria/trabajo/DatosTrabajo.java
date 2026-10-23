package com.taller.herreria.trabajo;

import com.taller.herreria.cliente.ClienteService;
import com.taller.herreria.material.LineasMaterial;
import com.taller.herreria.material.Material;
import com.taller.herreria.trabajador.TrabajadorService;
import com.taller.herreria.trabajo.dto.TrabajoDatos;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

/**
 * Aplica a un trabajo lo que llega del formulario, al crearlo o al editarlo.
 * Solo se toca lo que viene informado.
 */
@Component
@Transactional
public class DatosTrabajo {

    private final ClienteService clienteService;
    private final TrabajadorService trabajadorService;
    private final LineasMaterial lineasMaterial;

    public DatosTrabajo(ClienteService clienteService, TrabajadorService trabajadorService,
                        LineasMaterial lineasMaterial) {
        this.clienteService = clienteService;
        this.trabajadorService = trabajadorService;
        this.lineasMaterial = lineasMaterial;
    }

    void aplicar(Trabajo trabajo, TrabajoDatos datos) {
        if (datos.clienteId() != null)
            trabajo.setCliente(clienteService.paraElegir(datos.clienteId(), trabajo.getCliente()));
        if (datos.trabajadorId() != null)
            trabajo.setTrabajador(trabajadorService.buscarOFallar(datos.trabajadorId()));
        if (datos.descripcion() != null)
            trabajo.setDescripcion(normalizar(datos.descripcion(), trabajo.esBorrador(), "descripción"));
        if (datos.materiales() != null)
            lineasMaterial.reemplazar(Material.OrigenTipo.TRABAJO, trabajo.getId(), datos.materiales());
        if (datos.horas() != null)
            trabajo.setHoras(mayorQueCero(datos.horas()));
    }

    /**
     * En un borrador, vaciar un campo es legítimo: se está rellenando a medias
     * y puede que lo escrito estuviera mal. La cadena en blanco se guarda como
     * null, para que camposQueFaltan() lo detecte al enviar.
     *
     * En un trabajo ya enviado no se permite: dejaría incompleto un documento
     * que ya se dio por bueno y del que puede colgar un albarán.
     */
    private static String normalizar(String valor, boolean borrador, String campo) {
        if (!valor.isBlank()) return valor.trim();
        if (borrador) return null;
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "El campo '" + campo + "' no puede quedar vacío en un trabajo ya enviado");
    }

    private static BigDecimal mayorQueCero(BigDecimal horas) {
        if (horas.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Las horas deben ser mayores que cero");
        }
        return horas;
    }
}
