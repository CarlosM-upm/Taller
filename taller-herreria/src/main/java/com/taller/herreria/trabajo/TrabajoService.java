package com.taller.herreria.trabajo;

import com.taller.herreria.albaran.Albaran;
import com.taller.herreria.albaran.AlbaranRepository;
import com.taller.herreria.cliente.ClienteService;
import com.taller.herreria.documento.Documento;
import com.taller.herreria.documento.GeneradorPdf;
import com.taller.herreria.foto.Foto;
import com.taller.herreria.foto.FotoRepository;
import com.taller.herreria.foto.ValidadorImagen;
import com.taller.herreria.material.Material;
import com.taller.herreria.material.LineasMaterial;
import com.taller.herreria.material.MaterialRepository;
import com.taller.herreria.material.dto.MaterialDto;
import com.taller.herreria.seguridad.SeguridadUtils;
import com.taller.herreria.trabajo.dto.TrabajoDatos;
import com.taller.herreria.trabajo.dto.TrabajoResponse;
import com.taller.herreria.trabajador.TrabajadorService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Map;

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
    private final AlbaranRepository albaranRepository;
    private final GeneradorPdf generadorPdf;

    private final MaterialRepository materialRepository;
    private final LineasMaterial lineasMaterial;
    private final ClienteService clienteService;
    private final TrabajadorService trabajadorService;

    public TrabajoService(TrabajoRepository trabajoRepository,
                          FotoRepository fotoRepository,
                          AlbaranRepository albaranRepository,
                          GeneradorPdf generadorPdf,
                          ClienteService clienteService,
                          TrabajadorService trabajadorService,
                          MaterialRepository materialRepository,
                          LineasMaterial lineasMaterial) {
        this.trabajoRepository = trabajoRepository;
        this.fotoRepository = fotoRepository;
        this.albaranRepository = albaranRepository;
        this.generadorPdf = generadorPdf;
        this.clienteService = clienteService;
        this.trabajadorService = trabajadorService;
        this.materialRepository = materialRepository;
        this.lineasMaterial = lineasMaterial;
    }

    /** Crea un trabajo en estado BORRADOR, con los datos que haya (pueden estar a medias). */
    public TrabajoResponse crear(TrabajoDatos datos) {
        Trabajo trabajo = Trabajo.nuevoBorrador();
        // Se guarda ANTES de aplicar los datos para que tenga id: las líneas de
        // material se cuelgan de él por origenId y sin id no hay de qué colgarlas.
        trabajoRepository.save(trabajo);
        aplicarDatos(trabajo, datos);
        return aRespuesta(trabajo);
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

        // De una sola consulta, para no preguntar por cada trabajo si ya está
        // facturado.
        Set<Long> facturados = new HashSet<>(albaranRepository.idsDeTrabajosFacturados());
        return trabajos.stream().map(t -> aRespuesta(t, facturados.contains(t.getId()))).toList();
    }

    @Transactional(readOnly = true)
    public TrabajoResponse obtener(Long id) {
        return aRespuesta(buscarOFallar(id));
    }

    /**
     * Documento PDF del trabajo. Solo jefe (la regla vive en SecurityConfig).
     *
     * Un borrador también se puede imprimir: sale con guiones donde falten
     * datos, que es justo lo que el jefe quiere ver si lo repasa en papel.
     */
    @Transactional(readOnly = true)
    public Documento pdf(Long id) {
        Trabajo trabajo = buscarOFallar(id);
        List<Foto> fotos = fotoRepository.findByOrigenTipoAndOrigenId(Foto.OrigenTipo.TRABAJO, id);

        // HashMap y no Map.of: la firma puede no existir y Map.of no admite nulos.
        Map<String, Object> datos = new HashMap<>();
        datos.put("id", trabajo.getId());
        datos.put("estado", trabajo.esBorrador() ? "Borrador" : "Enviado");
        datos.put("fecha", GeneradorPdf.fecha(trabajo.getFecha()));
        datos.put("cliente", GeneradorPdf.texto(trabajo.getCliente() == null ? null : trabajo.getCliente().getNombre()));
        datos.put("trabajador", GeneradorPdf.texto(trabajo.getTrabajador() == null ? null : trabajo.getTrabajador().getNombre()));
        datos.put("descripcion", GeneradorPdf.texto(trabajo.getDescripcion()));
        datos.put("materiales", GeneradorPdf.materiales(
                materialRepository.findByOrigenTipoAndOrigenIdOrderByIdAsc(
                        Material.OrigenTipo.TRABAJO, trabajo.getId())));
        datos.put("horas", horasDeDocumento(trabajo.getHoras()));
        datos.put("firma", GeneradorPdf.imagen(trabajo.getFirmaTipoContenido(), trabajo.getFirma()));
        datos.put("fotos", GeneradorPdf.imagenes(fotos));

        byte[] contenido = generadorPdf.generar("trabajo", datos);

        return new Documento("trabajo-" + trabajo.getId() + ".pdf", contenido);
    }

    /** En el documento las horas se escriben como se leen aquí: con coma. */
    private static String horasDeDocumento(BigDecimal horas) {
        return horas == null ? GeneradorPdf.VACIO : horas.toPlainString().replace('.', ',') + " h";
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
        exigirQueNoTengaAlbaran(trabajo);
        fotoRepository.deleteByOrigenTipoAndOrigenId(Foto.OrigenTipo.TRABAJO, trabajo.getId());
        materialRepository.deleteByOrigenTipoAndOrigenId(
                Material.OrigenTipo.TRABAJO, trabajo.getId());
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

    // ---------- Firma del cliente ----------

    /**
     * Recoger la firma del cliente en la obra, desde la tablet.
     *
     * Rompe a propósito la regla de "trabajo enviado = solo el jefe": el
     * trabajador puede firmar un trabajo YA enviado, porque es normal enviarlo
     * desde el taller y que el cliente firme después. Lo que no puede es
     * SUSTITUIR una firma ya recogida en un trabajo enviado: eso sí es del jefe.
     * Si no, cualquiera podría cambiar una firma que el cliente ya puso.
     */
    public TrabajoResponse guardarFirma(Long id, MultipartFile fichero) {
        Trabajo trabajo = buscarOFallar(id);
        if (!trabajo.esBorrador() && trabajo.tieneFirma() && !SeguridadUtils.esJefe()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Este trabajo enviado ya tiene la firma del cliente: solo el jefe puede cambiarla");
        }
        ValidadorImagen.Imagen firma = ValidadorImagen.validar(fichero, "firma");
        trabajo.setFirma(firma.datos(), firma.tipoContenido());
        return aRespuesta(trabajo);
    }

    @Transactional(readOnly = true)
    public Trabajo obtenerConFirma(Long id) {
        Trabajo trabajo = buscarOFallar(id);
        if (!trabajo.tieneFirma()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "El trabajo " + id + " no tiene firma");
        }
        return trabajo;
    }

    /** Quitar la firma: en un borrador cualquiera, en un enviado solo el jefe. */
    public TrabajoResponse borrarFirma(Long id) {
        Trabajo trabajo = buscarOFallar(id);
        exigirJefeSiEnviado(trabajo, "quitar la firma de");
        trabajo.setFirma(null, null);
        return aRespuesta(trabajo);
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
        if (datos.clienteId() != null)
            trabajo.setCliente(clienteService.paraElegir(datos.clienteId(), trabajo.getCliente()));
        if (datos.trabajadorId() != null)
            trabajo.setTrabajador(trabajadorService.buscarOFallar(datos.trabajadorId()));
        if (datos.descripcion() != null)
            trabajo.setDescripcion(normalizar(datos.descripcion(), borrador, "descripción"));
        if (datos.materiales() != null)
            lineasMaterial.reemplazar(Material.OrigenTipo.TRABAJO, trabajo.getId(), datos.materiales());
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
        if (t.getCliente() == null) faltan.add("cliente");
        if (t.getTrabajador() == null) faltan.add("trabajador");
        if (esBlanco(t.getDescripcion())) faltan.add("descripción");
        if (materialRepository.countByOrigenTipoAndOrigenId(
                Material.OrigenTipo.TRABAJO, t.getId()) == 0) faltan.add("materiales");
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

    private List<MaterialDto> materialesDe(Long trabajoId) {
        return materialRepository
                .findByOrigenTipoAndOrigenIdOrderByIdAsc(Material.OrigenTipo.TRABAJO, trabajoId)
                .stream().map(MaterialDto::de).toList();
    }

    private TrabajoResponse aRespuesta(Trabajo t) {
        return aRespuesta(t, albaranRepository.findPorTrabajo(t.getId()).isPresent());
    }

    private TrabajoResponse aRespuesta(Trabajo t, boolean enAlbaran) {
        return new TrabajoResponse(t.getId(), t.getEstado().name(), t.getFecha(),
                t.getCliente() == null ? null : t.getCliente().getId(),
                t.getCliente() == null ? null : t.getCliente().getNombre(),
                t.getTrabajador() == null ? null : t.getTrabajador().getId(),
                t.getTrabajador() == null ? null : t.getTrabajador().getNombre(),
                t.getDescripcion(), materialesDe(t.getId()), t.getHoras(), idsDeFotos(t.getId()),
                enAlbaran, t.tieneFirma());
    }
}
