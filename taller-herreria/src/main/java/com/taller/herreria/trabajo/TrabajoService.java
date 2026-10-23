package com.taller.herreria.trabajo;

import com.taller.herreria.albaran.AlbaranRepository;
import com.taller.herreria.material.LineasMaterial;
import com.taller.herreria.material.Material;
import com.taller.herreria.trabajo.dto.TrabajoDatos;
import com.taller.herreria.trabajo.dto.TrabajoResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

import static com.taller.herreria.trabajo.PermisosTrabajo.exigirJefeSiEnviado;

/**
 * El ciclo de vida de un trabajo: borrador -> enviado, con la fecha estampada
 * solo al enviar y la comprobación de que está completo en el envío.
 *
 * El resto del trabajo está en sus propias clases: aplicar lo que llega del
 * formulario (DatosTrabajo), la firma (FirmaTrabajo), las fotos (FotosTrabajo),
 * el PDF (PdfTrabajo), la respuesta de la API (RespuestaTrabajo) y la regla de
 * "enviado = solo el jefe" (PermisosTrabajo).
 */
@Service
@Transactional
public class TrabajoService {

    private static final Logger log = LoggerFactory.getLogger(TrabajoService.class);

    private final TrabajoRepository trabajoRepository;
    private final AlbaranRepository albaranRepository;
    private final DatosTrabajo datos;
    private final LineasMaterial lineasMaterial;
    private final FotosTrabajo fotos;
    private final RespuestaTrabajo respuesta;

    public TrabajoService(TrabajoRepository trabajoRepository, AlbaranRepository albaranRepository,
                          DatosTrabajo datos, LineasMaterial lineasMaterial,
                          FotosTrabajo fotos, RespuestaTrabajo respuesta) {
        this.trabajoRepository = trabajoRepository;
        this.albaranRepository = albaranRepository;
        this.datos = datos;
        this.lineasMaterial = lineasMaterial;
        this.fotos = fotos;
        this.respuesta = respuesta;
    }

    /** Crea un trabajo en estado BORRADOR, con los datos que haya (pueden estar a medias). */
    public TrabajoResponse crear(TrabajoDatos nuevos) {
        Trabajo trabajo = Trabajo.nuevoBorrador();
        // Se guarda ANTES de aplicar los datos para que tenga id: las líneas de
        // material se cuelgan de él por origenId y sin id no hay de qué colgarlas.
        trabajoRepository.save(trabajo);
        datos.aplicar(trabajo, nuevos);
        return respuesta.de(trabajo);
    }

    @Transactional(readOnly = true)
    public List<TrabajoResponse> listar(String estado, Long clienteId) {
        List<Trabajo> trabajos;
        if (estado == null && clienteId == null) {
            trabajos = trabajoRepository.findAll();
        } else if (estado == null) {
            trabajos = trabajoRepository.findByClienteId(clienteId);
        } else if (clienteId == null) {
            trabajos = trabajoRepository.findByEstado(parsearEstado(estado));
        } else {
            trabajos = trabajoRepository.findByEstadoAndClienteId(parsearEstado(estado), clienteId);
        }
        return respuesta.de(trabajos);
    }

    @Transactional(readOnly = true)
    public TrabajoResponse obtener(Long id) {
        return respuesta.de(trabajoRepository.buscarOFallar(id));
    }

    /** Guardar avances de un borrador, o edición del jefe si ya está enviado. */
    public TrabajoResponse editar(Long id, TrabajoDatos cambios) {
        Trabajo trabajo = trabajoRepository.buscarOFallar(id);
        exigirJefeSiEnviado(trabajo, "editar");
        datos.aplicar(trabajo, cambios);
        return respuesta.de(trabajo);
    }

    /**
     * Envío definitivo: valida que el trabajo esté completo,
     * cambia el estado a ENVIADO y estampa la fecha.
     */
    public TrabajoResponse enviar(Long id) {
        Trabajo trabajo = trabajoRepository.buscarOFallar(id);

        if (!trabajo.esBorrador()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El trabajo " + id + " ya fue enviado");
        }

        List<String> faltan = camposQueFaltan(trabajo);
        if (!faltan.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No se puede enviar: faltan campos por rellenar: " + String.join(", ", faltan));
        }

        trabajo.enviar();
        log.info("Trabajo {} enviado (cliente: {}, trabajador: {})",
                id, trabajo.getCliente(), trabajo.getTrabajador());
        return respuesta.de(trabajo);
    }

    /** Descartar un borrador (trabajador) o borrar uno enviado (solo el jefe). */
    public void borrar(Long id) {
        Trabajo trabajo = trabajoRepository.buscarOFallar(id);
        exigirJefeSiEnviado(trabajo, "borrar");
        exigirQueNoTengaAlbaran(trabajo);
        fotos.borrarTodas(trabajo.getId());
        lineasMaterial.borrarDe(Material.OrigenTipo.TRABAJO, trabajo.getId());
        trabajoRepository.delete(trabajo);
    }

    /**
     * Un albarán es un documento que se imprimió y que el cliente firmó, y el
     * trabajo del que salió es su respaldo. Borrar ese trabajo dejaría el
     * albarán apuntando a un id que ya no existe.
     *
     * El albarán no perdería datos —es una copia instantánea y guarda lo suyo—,
     * pero sí se perdería el rastro hacia su origen, así que se bloquea y se
     * dice cuál es el albarán, para que el jefe pueda decidir.
     *
     * La base de datos no lo impide por su cuenta: `trabajo_id` es un Long
     * normal, sin clave foránea.
     */
    private void exigirQueNoTengaAlbaran(Trabajo trabajo) {
        albaranRepository.findPorTrabajo(trabajo.getId()).ifPresent(albaran -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El trabajo " + trabajo.getId() + " está en el albarán nº "
                            + albaran.getNumero() + ": borre antes el albarán");
        });
    }

    /** Campos obligatorios para poder ENVIAR (mientras es borrador pueden faltar). */
    private List<String> camposQueFaltan(Trabajo t) {
        List<String> faltan = new ArrayList<>();
        if (t.getCliente() == null) faltan.add("cliente");
        if (t.getTrabajador() == null) faltan.add("trabajador");
        if (t.getDescripcion() == null || t.getDescripcion().isBlank()) faltan.add("descripción");
        if (!lineasMaterial.hayAlguna(Material.OrigenTipo.TRABAJO, t.getId())) faltan.add("materiales");
        if (t.getHoras() == null) faltan.add("horas");
        return faltan;
    }

    private static Trabajo.Estado parsearEstado(String estado) {
        try {
            return Trabajo.Estado.valueOf(estado.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Estado desconocido: " + estado + " (use borrador o enviado)");
        }
    }
}
