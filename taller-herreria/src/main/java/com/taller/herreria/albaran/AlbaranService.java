package com.taller.herreria.albaran;

import com.taller.herreria.albaran.dto.AlbaranCrear;
import com.taller.herreria.albaran.dto.AlbaranPatch;
import com.taller.herreria.albaran.dto.AlbaranResponse;
import com.taller.herreria.config.ConfiguracionService;
import com.taller.herreria.cliente.Cliente;
import com.taller.herreria.cliente.ClienteService;
import com.taller.herreria.documento.Documento;
import com.taller.herreria.documento.GeneradorPdf;
import com.taller.herreria.foto.Foto;
import com.taller.herreria.foto.FotoRepository;
import com.taller.herreria.foto.ValidadorImagen;
import com.taller.herreria.material.LineasMaterial;
import com.taller.herreria.material.Material;
import com.taller.herreria.material.MaterialRepository;
import com.taller.herreria.material.dto.MaterialDto;
import com.taller.herreria.trabajador.Trabajador;
import com.taller.herreria.trabajador.TrabajadorService;
import com.taller.herreria.trabajador.dto.TrabajadorDto;
import com.taller.herreria.trabajo.Trabajo;
import com.taller.herreria.trabajo.TrabajoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.HashMap;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Lógica de negocio de los albaranes (territorio del jefe).
 * Reglas clave: nace de uno o varios trabajos ENVIADOS del mismo cliente,
 * copia (instantánea) de datos, materiales y fotos, y número tomado del
 * contador editable.
 */
@Service
@Transactional
public class AlbaranService {

    private static final Logger log = LoggerFactory.getLogger(AlbaranService.class);

    /**
     * Más alto que en pedidos y trabajos (5): un albarán unificado junta las
     * fotos de varios trabajos, y tres visitas con cinco fotos cada una no
     * caben en cinco. Entran las que quepan y el jefe borra las que sobren.
     */
    public static final int MAX_FOTOS = 15;

    private final AlbaranRepository albaranRepository;
    private final TrabajoRepository trabajoRepository;
    private final FotoRepository fotoRepository;
    private final ConfiguracionService configuracion;
    private final GeneradorPdf generadorPdf;

    private final MaterialRepository materialRepository;
    private final LineasMaterial lineasMaterial;
    private final ClienteService clienteService;
    private final TrabajadorService trabajadorService;

    public AlbaranService(AlbaranRepository albaranRepository,
                          TrabajoRepository trabajoRepository,
                          FotoRepository fotoRepository,
                          ConfiguracionService configuracion,
                          GeneradorPdf generadorPdf,
                          ClienteService clienteService,
                          TrabajadorService trabajadorService,
                          MaterialRepository materialRepository,
                          LineasMaterial lineasMaterial) {
        this.albaranRepository = albaranRepository;
        this.trabajoRepository = trabajoRepository;
        this.fotoRepository = fotoRepository;
        this.configuracion = configuracion;
        this.generadorPdf = generadorPdf;
        this.clienteService = clienteService;
        this.trabajadorService = trabajadorService;
        this.materialRepository = materialRepository;
        this.lineasMaterial = lineasMaterial;
    }

    /** Un solo trabajo: el caso de siempre, que no es más que unificar una lista de uno. */
    public AlbaranResponse crearDesdeTrabajo(Long trabajoId, AlbaranCrear datos) {
        return crearDesdeTrabajos(List.of(trabajoId), datos);
    }

    /**
     * Albarán a partir de uno o varios trabajos ENVIADOS del mismo cliente.
     *
     * Unificar es juntar: las descripciones se concatenan en el orden en que se
     * hicieron, los trabajadores se acumulan sin repetir, las horas se suman y
     * los materiales del mismo nombre se agrupan sumando cantidades. Todo queda
     * editable por el jefe: esto es el punto de partida, no el resultado final.
     */
    public AlbaranResponse crearDesdeTrabajos(List<Long> trabajoIds, AlbaranCrear datos) {
        if (trabajoIds == null || trabajoIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Indique al menos un trabajo");
        }
        // Un mismo trabajo repetido en la lista duplicaría horas y materiales.
        List<Long> ids = new ArrayList<>(new LinkedHashSet<>(trabajoIds));

        List<Trabajo> trabajos = new ArrayList<>();
        for (Long id : ids) {
            Trabajo trabajo = trabajoRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "No existe el trabajo " + id));
            if (trabajo.esBorrador()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "El trabajo " + id + " aún es un borrador: debe enviarse antes "
                                + "de generar su albarán");
            }
            albaranRepository.findPorTrabajo(id).ifPresent(existente -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "El trabajo " + id + " ya está en el albarán nº " + existente.getNumero());
            });
            trabajos.add(trabajo);
        }

        // Mezclar clientes daría un albarán que no es de nadie. Es el único
        // campo que no se puede unificar.
        Cliente cliente = trabajos.get(0).getCliente();
        for (Trabajo trabajo : trabajos) {
            if (!trabajo.getCliente().getId().equals(cliente.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Todos los trabajos tienen que ser del mismo cliente: el "
                                + trabajos.get(0).getId() + " es de " + cliente.getNombre()
                                + " y el " + trabajo.getId() + " de "
                                + trabajo.getCliente().getNombre());
            }
        }

        // En el orden en que se hicieron, para que la descripción se lea como el
        // histórico del mes. Un trabajo enviado siempre tiene fecha.
        trabajos.sort(Comparator.comparing(Trabajo::getFecha).thenComparing(Trabajo::getId));

        LocalDate fecha = (datos != null && datos.fecha() != null) ? datos.fecha() : LocalDate.now();
        String dni = (datos != null) ? datos.dniCliente() : null;

        long numero = configuracion.tomarNumeroDeAlbaran();
        // Si el jefe reencauzó el contador hacia un número ya usado, avisamos claramente.
        if (albaranRepository.existsByNumero(numero)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El número " + numero + " ya está usado por otro albarán. " +
                    "Ajuste el próximo número en la configuración.");
        }

        Set<Trabajador> trabajadores = new LinkedHashSet<>();
        Set<Long> idsUnificados = new LinkedHashSet<>();
        StringBuilder descripcion = new StringBuilder();
        BigDecimal horas = BigDecimal.ZERO;

        for (Trabajo trabajo : trabajos) {
            trabajadores.add(trabajo.getTrabajador());
            idsUnificados.add(trabajo.getId());
            if (trabajo.getDescripcion() != null && !trabajo.getDescripcion().isBlank()) {
                if (descripcion.length() > 0) descripcion.append("\n\n");
                descripcion.append(trabajo.getDescripcion().trim());
            }
            if (trabajo.getHoras() != null) horas = horas.add(trabajo.getHoras());
        }

        Albaran albaran = new Albaran(numero, fecha, cliente, dni, trabajadores,
                descripcion.toString(), idsUnificados);
        albaran.setHoras(horas);
        albaranRepository.save(albaran);

        lineasMaterial.copiarAAlbaran(
                trabajos.stream().map(Trabajo::getId).toList(), albaran.getId());
        int fotos = copiarFotos(trabajos, albaran.getId());

        // La firma solo se hereda si el albarán sale de UN trabajo: es el mismo
        // documento que el cliente firmó en la obra. Uno unificado no la hereda
        // aunque sus trabajos estén firmados, porque el cliente firmó cada
        // visita, no el documento del mes con su total. Ese se firma de nuevo.
        if (trabajos.size() == 1 && trabajos.get(0).tieneFirma()) {
            Trabajo unico = trabajos.get(0);
            albaran.setFirma(unico.getFirma(), unico.getFirmaTipoContenido());
        }

        log.info("Albarán {} creado desde {} trabajo(s) {} ({} fotos copiadas)",
                numero, trabajos.size(), idsUnificados, fotos);

        return aRespuesta(albaran);
    }

    /** Las fotos de todos los trabajos, hasta el máximo que admite un albarán. */
    private int copiarFotos(List<Trabajo> trabajos, Long albaranId) {
        int copiadas = 0;
        for (Trabajo trabajo : trabajos) {
            for (Foto original : fotoRepository.findByOrigenTipoAndOrigenId(
                    Foto.OrigenTipo.TRABAJO, trabajo.getId())) {
                if (copiadas >= MAX_FOTOS) return copiadas;
                fotoRepository.save(new Foto(Foto.OrigenTipo.ALBARAN, albaranId,
                        original.getTipoContenido(), original.getDatos()));
                copiadas++;
            }
        }
        return copiadas;
    }

    @Transactional(readOnly = true)
    public List<AlbaranResponse> listar() {
        return albaranRepository.findAll().stream().map(this::aRespuesta).toList();
    }

    @Transactional(readOnly = true)
    public AlbaranResponse obtener(Long id) {
        return aRespuesta(buscarOFallar(id));
    }

    /**
     * Documento PDF del albarán: el que se imprime, se firma en papel si hace
     * falta y se archiva. Lleva la firma recogida en pantalla y las fotos.
     */
    @Transactional(readOnly = true)
    public Documento pdf(Long id) {
        Albaran albaran = buscarOFallar(id);
        List<Foto> fotos = fotoRepository.findByOrigenTipoAndOrigenId(Foto.OrigenTipo.ALBARAN, id);

        // HashMap y no Map.of: la firma puede no existir todavía y Map.of no admite nulos.
        Map<String, Object> datos = new HashMap<>();
        datos.put("numero", albaran.getNumero());
        datos.put("fecha", GeneradorPdf.fecha(albaran.getFecha()));
        datos.put("cliente", GeneradorPdf.texto(albaran.getCliente().getNombre()));
        datos.put("dniCliente", GeneradorPdf.texto(albaran.getDniCliente()));
        datos.put("trabajador", GeneradorPdf.texto(nombresDe(albaran)));
        datos.put("descripcion", GeneradorPdf.texto(albaran.getDescripcion()));
        datos.put("firma", GeneradorPdf.imagen(albaran.getFirmaTipoContenido(), albaran.getFirma()));

        // El desglose (precio por material, precio por hora) NO se imprime nunca:
        // es información interna del taller. Solo puede salir el total, y solo
        // si el jefe lo ha marcado en la ficha.
        if (albaran.isIncluirTotal()) {
            List<Material> lineas = materialRepository.findByOrigenTipoAndOrigenIdOrderByIdAsc(
                    Material.OrigenTipo.ALBARAN, albaran.getId());
            BigDecimal extra = albaran.getImporteExtra() == null
                    ? BigDecimal.ZERO : albaran.getImporteExtra();
            datos.put("costeTotal", GeneradorPdf.euros(costeSumado(albaran, lineas).add(extra)));
        }
        datos.put("fotos", GeneradorPdf.imagenes(fotos));

        // El albarán se identifica por su número, no por su id interno.
        return new Documento("albaran-" + albaran.getNumero() + ".pdf",
                generadorPdf.generar("albaran", datos));
    }

    /** Edición parcial por el jefe, incluido el número (validando que no choque). */
    public AlbaranResponse editar(Long id, AlbaranPatch cambios) {
        Albaran albaran = buscarOFallar(id);

        if (cambios.numero() != null && !cambios.numero().equals(albaran.getNumero())) {
            if (cambios.numero() < 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "El número de albarán debe ser 1 o mayor");
            }
            if (albaranRepository.existsByNumero(cambios.numero())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "El número " + cambios.numero() + " ya está usado por otro albarán");
            }
            albaran.setNumero(cambios.numero());
        }
        if (cambios.fecha() != null) albaran.setFecha(cambios.fecha());
        if (cambios.clienteId() != null)
            albaran.setCliente(clienteService.buscarOFallar(cambios.clienteId()));
        if (cambios.dniCliente() != null) albaran.setDniCliente(cambios.dniCliente().trim());
        if (cambios.trabajadorIds() != null) {
            if (cambios.trabajadorIds().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "El albarán tiene que llevar al menos un trabajador");
            }
            Set<Trabajador> nuevos = new LinkedHashSet<>();
            for (Long idTrabajador : cambios.trabajadorIds()) {
                nuevos.add(trabajadorService.buscarOFallar(idTrabajador));
            }
            albaran.setTrabajadores(nuevos);
        }
        if (cambios.descripcion() != null)
            albaran.setDescripcion(exigirNoVacio(cambios.descripcion(), "descripción"));

        if (cambios.horas() != null) {
            if (cambios.horas().compareTo(BigDecimal.ZERO) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Las horas no pueden ser negativas");
            }
            albaran.setHoras(cambios.horas());
        }
        if (cambios.precioHora() != null) {
            if (cambios.precioHora().compareTo(BigDecimal.ZERO) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "El precio por hora no puede ser negativo");
            }
            albaran.setPrecioHora(cambios.precioHora());
        }
        // El importe extra SÍ admite negativo: es como se aplica un descuento.
        if (cambios.importeExtra() != null) albaran.setImporteExtra(cambios.importeExtra());
        if (cambios.incluirTotal() != null) albaran.setIncluirTotal(cambios.incluirTotal());

        if (cambios.materiales() != null)
            lineasMaterial.reemplazar(Material.OrigenTipo.ALBARAN, albaran.getId(), cambios.materiales());

        return aRespuesta(albaran);
    }


    public void borrar(Long id) {
        Albaran albaran = buscarOFallar(id);
        fotoRepository.deleteByOrigenTipoAndOrigenId(Foto.OrigenTipo.ALBARAN, albaran.getId());
        materialRepository.deleteByOrigenTipoAndOrigenId(
                Material.OrigenTipo.ALBARAN, albaran.getId());
        albaranRepository.delete(albaran);
    }

    // ---------- Firma ----------

    public AlbaranResponse guardarFirma(Long id, MultipartFile fichero) {
        Albaran albaran = buscarOFallar(id);
        ValidadorImagen.Imagen firma = ValidadorImagen.validar(fichero, "firma");
        albaran.setFirma(firma.datos(), firma.tipoContenido());
        return aRespuesta(albaran);
    }

    @Transactional(readOnly = true)
    public Albaran obtenerConFirma(Long id) {
        Albaran albaran = buscarOFallar(id);
        if (albaran.getFirma() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "El albarán " + id + " no tiene firma");
        }
        return albaran;
    }

    // ---------- Fotos ----------

    public List<Long> subirFotos(Long id, List<MultipartFile> ficheros) {
        Albaran albaran = buscarOFallar(id);
        ValidadorImagen.exigirAlgunFichero(ficheros);

        long existentes = fotoRepository.countByOrigenTipoAndOrigenId(
                Foto.OrigenTipo.ALBARAN, albaran.getId());
        if (existentes + ficheros.size() > MAX_FOTOS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Máximo " + MAX_FOTOS + " fotos por albarán (ya tiene " + existentes + ")");
        }

        for (MultipartFile fichero : ficheros) {
            ValidadorImagen.Imagen imagen = ValidadorImagen.validar(fichero, "foto");
            fotoRepository.save(new Foto(Foto.OrigenTipo.ALBARAN, albaran.getId(),
                    imagen.tipoContenido(), imagen.datos()));
        }
        return idsDeFotos(albaran.getId());
    }

    @Transactional(readOnly = true)
    public Foto obtenerFoto(Long albaranId, Long fotoId) {
        buscarOFallar(albaranId);
        return fotoRepository.findByIdAndOrigenTipoAndOrigenId(
                        fotoId, Foto.OrigenTipo.ALBARAN, albaranId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Ese albarán no tiene esa foto"));
    }

    public void borrarFoto(Long albaranId, Long fotoId) {
        fotoRepository.delete(obtenerFoto(albaranId, fotoId));
    }

    // ---------- auxiliares ----------

    private Albaran buscarOFallar(Long id) {
        return albaranRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No existe el albarán " + id));
    }

    /**
     * El albarán es un documento cerrado: un PATCH con "" o "   " no puede
     * dejar sin cliente, trabajador o descripción a algo que ya se imprimió.
     * (El DNI sí puede quedar vacío: es opcional.)
     */
    private String exigirNoVacio(String valor, String campo) {
        if (valor.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El campo '" + campo + "' no puede quedar vacío");
        }
        return valor.trim();
    }

    private List<Long> idsDeFotos(Long albaranId) {
        return fotoRepository.idsPorOrigen(Foto.OrigenTipo.ALBARAN, albaranId);
    }

    private AlbaranResponse aRespuesta(Albaran a) {
        List<Material> materiales = materialRepository
                .findByOrigenTipoAndOrigenIdOrderByIdAsc(Material.OrigenTipo.ALBARAN, a.getId());
        BigDecimal sumado = costeSumado(a, materiales);
        BigDecimal extra = a.getImporteExtra() == null ? BigDecimal.ZERO : a.getImporteExtra();

        return new AlbaranResponse(a.getId(), a.getNumero(), a.getFecha(),
                a.getCliente().getId(), a.getCliente().getNombre(), a.getDniCliente(),
                a.getTrabajadores().stream().map(TrabajadorDto.Resumen::de).toList(),
                a.getDescripcion(), a.getHoras(),
                materiales.stream().map(MaterialDto::de).toList(),
                a.getPrecioHora(), sumado, a.getImporteExtra(), sumado.add(extra),
                a.isIncluirTotal(), a.getFirma() != null,
                List.copyOf(a.getTrabajoIds()), idsDeFotos(a.getId()));
    }

    /**
     * Materiales más mano de obra. No se guarda en ninguna columna: se calcula
     * cada vez a partir de las líneas y de las horas.
     *
     * Guardarlo obligaría a recalcularlo y reescribirlo cada vez que se toca un
     * precio, y bastaría con que fallara una vez para que el albarán dijera un
     * total que no cuadra con sus propias líneas.
     */
    private BigDecimal costeSumado(Albaran albaran, List<Material> materiales) {
        BigDecimal suma = albaran.importeManoDeObra();
        for (Material material : materiales) {
            suma = suma.add(material.importe());
        }
        return suma;
    }

    private List<MaterialDto> materialesDe(Long albaranId) {
        return materialRepository
                .findByOrigenTipoAndOrigenIdOrderByIdAsc(Material.OrigenTipo.ALBARAN, albaranId)
                .stream().map(MaterialDto::de).toList();
    }

    /** Los nombres de los trabajadores, para la línea del PDF. */
    private static String nombresDe(Albaran albaran) {
        return albaran.getTrabajadores().stream()
                .map(Trabajador::getNombre)
                .collect(java.util.stream.Collectors.joining(", "));
    }
}
