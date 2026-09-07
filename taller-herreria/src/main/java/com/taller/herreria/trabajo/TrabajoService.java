package com.taller.herreria.trabajo;

import com.taller.herreria.foto.Foto;
import com.taller.herreria.foto.FotoRepository;
import com.taller.herreria.foto.ValidadorImagen;
import com.taller.herreria.seguridad.SeguridadUtils;
import com.taller.herreria.trabajo.dto.TrabajoDatos;
import com.taller.herreria.trabajo.dto.TrabajoResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Lógica de negocio de los trabajos realizados.
 * Reglas clave: ciclo borrador -> enviado, fecha estampada solo al enviar,
 * validación de completitud en el envío, máximo 5 fotos.
 */
@Service
@Transactional
public class TrabajoService {

    private static final Logger log = LoggerFactory.getLogger(TrabajoService.class);

    public static final int MAX_FOTOS = 5;

    private final TrabajoRepository trabajoRepository;
    private final FotoRepository fotoRepository;

    public TrabajoService(TrabajoRepository trabajoRepository, FotoRepository fotoRepository) {
        this.trabajoRepository = trabajoRepository;
        this.fotoRepository = fotoRepository;
    }

    /** Crea un trabajo en estado BORRADOR, con los datos que haya (pueden estar a medias). */
    public TrabajoResponse crear(TrabajoDatos datos) {
        Trabajo trabajo = Trabajo.nuevoBorrador();
        aplicarDatos(trabajo, datos);
        trabajoRepository.save(trabajo);
        return aRespuesta(trabajo);
    }

    @Transactional(readOnly = true)
    public List<TrabajoResponse> listar(String estado) {
        List<Trabajo> trabajos;
        if (estado == null) {
            trabajos = trabajoRepository.findAll();
        } else {
            trabajos = trabajoRepository.findByEstado(parsearEstado(estado));
        }
        return trabajos.stream().map(this::aRespuesta).toList();
    }

    @Transactional(readOnly = true)
    public TrabajoResponse obtener(Long id) {
        return aRespuesta(buscarOFallar(id));
    }

    /**
     * Guardar avances / editar. Nota: cuando exista la capa de seguridad,
     * los trabajos ENVIADOS solo podrá editarlos el JEFE.
     */
    public TrabajoResponse editar(Long id, TrabajoDatos cambios) {
        Trabajo trabajo = buscarOFallar(id);
        exigirJefeSiEnviado(trabajo, "editar");
        aplicarDatos(trabajo, cambios);
        return aRespuesta(trabajo);
    }

    /**
     * Envío definitivo: valida que el trabajo esté completo,
     * cambia el estado a ENVIADO y estampa la fecha.
     */
    public TrabajoResponse enviar(Long id) {
        Trabajo trabajo = buscarOFallar(id);

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
        return aRespuesta(trabajo);
    }

    /**
     * Borrado. El caso del trabajador es "descartar un borrador";
     * borrar trabajos ENVIADOS quedará restringido al JEFE con la capa de seguridad.
     */
    public void borrar(Long id) {
        Trabajo trabajo = buscarOFallar(id);
        exigirJefeSiEnviado(trabajo, "borrar");
        fotoRepository.deleteByOrigenTipoAndOrigenId(Foto.OrigenTipo.TRABAJO, trabajo.getId());
        trabajoRepository.delete(trabajo);
    }

    // ---------- Fotos ----------

    public List<Long> subirFotos(Long id, List<MultipartFile> ficheros) {
        Trabajo trabajo = buscarOFallar(id);
        exigirJefeSiEnviado(trabajo, "añadir fotos a");
        ValidadorImagen.exigirAlgunFichero(ficheros);

        long existentes = fotoRepository.countByOrigenTipoAndOrigenId(
                Foto.OrigenTipo.TRABAJO, trabajo.getId());
        if (existentes + ficheros.size() > MAX_FOTOS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Máximo " + MAX_FOTOS + " fotos por trabajo (ya tiene " + existentes + ")");
        }

        for (MultipartFile fichero : ficheros) {
            ValidadorImagen.Imagen imagen = ValidadorImagen.validar(fichero, "foto");
            fotoRepository.save(new Foto(Foto.OrigenTipo.TRABAJO, trabajo.getId(),
                    imagen.tipoContenido(), imagen.datos()));
        }
        return idsDeFotos(trabajo.getId());
    }

    @Transactional(readOnly = true)
    public Foto obtenerFoto(Long trabajoId, Long fotoId) {
        buscarOFallar(trabajoId);
        return fotoRepository.findByIdAndOrigenTipoAndOrigenId(
                        fotoId, Foto.OrigenTipo.TRABAJO, trabajoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Ese trabajo no tiene esa foto"));
    }

    public void borrarFoto(Long trabajoId, Long fotoId) {
        exigirJefeSiEnviado(buscarOFallar(trabajoId), "quitar fotos de");
        fotoRepository.delete(obtenerFoto(trabajoId, fotoId));
    }

    // ---------- auxiliares ----------

    private void aplicarDatos(Trabajo trabajo, TrabajoDatos datos) {
        boolean borrador = trabajo.esBorrador();
        if (datos.cliente() != null)
            trabajo.setCliente(normalizar(datos.cliente(), borrador, "cliente"));
        if (datos.trabajador() != null)
            trabajo.setTrabajador(normalizar(datos.trabajador(), borrador, "trabajador"));
        if (datos.descripcion() != null)
            trabajo.setDescripcion(normalizar(datos.descripcion(), borrador, "descripción"));
        if (datos.materiales() != null)
            trabajo.setMateriales(normalizar(datos.materiales(), borrador, "materiales"));
        if (datos.horas() != null) {
            if (datos.horas().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Las horas deben ser mayores que cero");
            }
            trabajo.setHoras(datos.horas());
        }
    }

    /**
     * En un borrador, vaciar un campo es legítimo: se está rellenando a medias
     * y puede que lo escrito estuviera mal. La cadena en blanco se guarda como
     * null, para que camposQueFaltan() lo detecte al enviar.
     *
     * En un trabajo ya enviado no se permite: dejaría incompleto un documento
     * que ya se dio por bueno y del que puede colgar un albarán.
     */
    private String normalizar(String valor, boolean borrador, String campo) {
        if (!valor.isBlank()) return valor.trim();
        if (borrador) return null;
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "El campo '" + campo + "' no puede quedar vacío en un trabajo ya enviado");
    }

    /** Campos obligatorios para poder ENVIAR (mientras es borrador pueden faltar). */
    private List<String> camposQueFaltan(Trabajo t) {
        List<String> faltan = new ArrayList<>();
        if (esBlanco(t.getCliente())) faltan.add("cliente");
        if (esBlanco(t.getTrabajador())) faltan.add("trabajador");
        if (esBlanco(t.getDescripcion())) faltan.add("descripción");
        if (esBlanco(t.getMateriales())) faltan.add("materiales");
        if (t.getHoras() == null) faltan.add("horas");
        return faltan;
    }

    private boolean esBlanco(String s) {
        return s == null || s.isBlank();
    }

    /**
     * La regla de edición que decidimos: en cuanto un trabajo se envía,
     * pasa a ser territorio del jefe. El trabajador solo toca borradores.
     */
    private void exigirJefeSiEnviado(Trabajo trabajo, String accion) {
        if (!trabajo.esBorrador() && !SeguridadUtils.esJefe()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "El trabajo ya fue enviado: solo el jefe puede " + accion + " un trabajo enviado");
        }
    }

    private Trabajo buscarOFallar(Long id) {
        return trabajoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No existe el trabajo " + id));
    }

    private Trabajo.Estado parsearEstado(String estado) {
        try {
            return Trabajo.Estado.valueOf(estado.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Estado desconocido: " + estado + " (use borrador o enviado)");
        }
    }

    private List<Long> idsDeFotos(Long trabajoId) {
        return fotoRepository.idsPorOrigen(Foto.OrigenTipo.TRABAJO, trabajoId);
    }

    private TrabajoResponse aRespuesta(Trabajo t) {
        return new TrabajoResponse(t.getId(), t.getEstado().name(), t.getFecha(),
                t.getCliente(), t.getTrabajador(), t.getDescripcion(),
                t.getMateriales(), t.getHoras(), idsDeFotos(t.getId()));
    }
}
