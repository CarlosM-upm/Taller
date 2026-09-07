package com.taller.herreria.albaran;

import com.taller.herreria.albaran.dto.AlbaranCrear;
import com.taller.herreria.albaran.dto.AlbaranPatch;
import com.taller.herreria.albaran.dto.AlbaranResponse;
import com.taller.herreria.config.ConfiguracionService;
import com.taller.herreria.foto.Foto;
import com.taller.herreria.foto.FotoRepository;
import com.taller.herreria.foto.ValidadorImagen;
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
import java.util.List;

/**
 * Lógica de negocio de los albaranes (territorio del jefe).
 * Reglas clave: nace de un trabajo ENVIADO, uno a uno, copia (instantánea)
 * de datos y fotos, número tomado del contador editable.
 */
@Service
@Transactional
public class AlbaranService {

    private static final Logger log = LoggerFactory.getLogger(AlbaranService.class);

    public static final int MAX_FOTOS = 5;

    private final AlbaranRepository albaranRepository;
    private final TrabajoRepository trabajoRepository;
    private final FotoRepository fotoRepository;
    private final ConfiguracionService configuracion;

    public AlbaranService(AlbaranRepository albaranRepository,
                          TrabajoRepository trabajoRepository,
                          FotoRepository fotoRepository,
                          ConfiguracionService configuracion) {
        this.albaranRepository = albaranRepository;
        this.trabajoRepository = trabajoRepository;
        this.fotoRepository = fotoRepository;
        this.configuracion = configuracion;
    }

    /**
     * Crear el albarán a partir de un trabajo. La operación estrella:
     * valida (trabajo existe, está ENVIADO, no tiene ya albarán),
     * copia los datos, COPIA las fotos (instantánea independiente)
     * y toma el número del contador, que avanza solo.
     */
    public AlbaranResponse crearDesdeTrabajo(Long trabajoId, AlbaranCrear datos) {
        Trabajo trabajo = trabajoRepository.findById(trabajoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No existe el trabajo " + trabajoId));

        if (trabajo.esBorrador()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El trabajo " + trabajoId + " aún es un borrador: debe enviarse antes de generar su albarán");
        }
        if (albaranRepository.existsByTrabajoId(trabajoId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El trabajo " + trabajoId + " ya tiene albarán (relación uno a uno)");
        }

        LocalDate fecha = (datos != null && datos.fecha() != null) ? datos.fecha() : LocalDate.now();
        String dni = (datos != null) ? datos.dniCliente() : null;

        long numero = configuracion.tomarNumeroDeAlbaran();
        // Si el jefe reencauzó el contador hacia un número ya usado, avisamos claramente.
        if (albaranRepository.existsByNumero(numero)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El número " + numero + " ya está usado por otro albarán. " +
                    "Ajuste el próximo número en la configuración.");
        }

        Albaran albaran = new Albaran(numero, fecha, trabajo.getCliente(), dni,
                trabajo.getTrabajador(), trabajo.getDescripcion(), trabajoId);
        albaranRepository.save(albaran);

        // Instantánea: copiamos las fotos del trabajo como fotos PROPIAS del albarán
        List<Foto> fotosDelTrabajo = fotoRepository
                .findByOrigenTipoAndOrigenId(Foto.OrigenTipo.TRABAJO, trabajoId);
        for (Foto original : fotosDelTrabajo) {
            fotoRepository.save(new Foto(Foto.OrigenTipo.ALBARAN, albaran.getId(),
                    original.getTipoContenido(), original.getDatos()));
        }

        log.info("Albarán {} creado desde el trabajo {} ({} fotos copiadas)",
                numero, trabajoId, fotosDelTrabajo.size());

        return aRespuesta(albaran);
    }

    @Transactional(readOnly = true)
    public List<AlbaranResponse> listar() {
        return albaranRepository.findAll().stream().map(this::aRespuesta).toList();
    }

    @Transactional(readOnly = true)
    public AlbaranResponse obtener(Long id) {
        return aRespuesta(buscarOFallar(id));
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
        if (cambios.cliente() != null)
            albaran.setCliente(exigirNoVacio(cambios.cliente(), "cliente"));
        if (cambios.dniCliente() != null) albaran.setDniCliente(cambios.dniCliente().trim());
        if (cambios.trabajador() != null)
            albaran.setTrabajador(exigirNoVacio(cambios.trabajador(), "trabajador"));
        if (cambios.descripcion() != null)
            albaran.setDescripcion(exigirNoVacio(cambios.descripcion(), "descripción"));

        return aRespuesta(albaran);
    }

    public void borrar(Long id) {
        Albaran albaran = buscarOFallar(id);
        fotoRepository.deleteByOrigenTipoAndOrigenId(Foto.OrigenTipo.ALBARAN, albaran.getId());
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
        return new AlbaranResponse(a.getId(), a.getNumero(), a.getFecha(), a.getCliente(),
                a.getDniCliente(), a.getTrabajador(), a.getDescripcion(),
                a.getFirma() != null, a.getTrabajoId(), idsDeFotos(a.getId()));
    }
}
