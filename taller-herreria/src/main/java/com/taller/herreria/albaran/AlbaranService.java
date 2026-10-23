package com.taller.herreria.albaran;

import com.taller.herreria.albaran.dto.AlbaranPatch;
import com.taller.herreria.albaran.dto.AlbaranResponse;
import com.taller.herreria.cliente.ClienteService;
import com.taller.herreria.foto.ValidadorImagen;
import com.taller.herreria.material.LineasMaterial;
import com.taller.herreria.material.Material;
import com.taller.herreria.trabajador.Trabajador;
import com.taller.herreria.trabajador.TrabajadorService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Consultar, editar y borrar albaranes, y su firma (territorio del jefe).
 *
 * El resto del albarán está en sus propias clases: el alta desde trabajos
 * (AltaAlbaran), las fotos (FotosAlbaran), el PDF (PdfAlbaran) y la respuesta
 * con el coste calculado (RespuestaAlbaran).
 */
@Service
@Transactional
public class AlbaranService {

    private final AlbaranRepository albaranRepository;
    private final ClienteService clienteService;
    private final TrabajadorService trabajadorService;
    private final LineasMaterial lineasMaterial;
    private final FotosAlbaran fotos;
    private final RespuestaAlbaran respuesta;

    public AlbaranService(AlbaranRepository albaranRepository, ClienteService clienteService,
                          TrabajadorService trabajadorService, LineasMaterial lineasMaterial,
                          FotosAlbaran fotos, RespuestaAlbaran respuesta) {
        this.albaranRepository = albaranRepository;
        this.clienteService = clienteService;
        this.trabajadorService = trabajadorService;
        this.lineasMaterial = lineasMaterial;
        this.fotos = fotos;
        this.respuesta = respuesta;
    }

    @Transactional(readOnly = true)
    public List<AlbaranResponse> listar() {
        return albaranRepository.findAll().stream().map(respuesta::de).toList();
    }

    @Transactional(readOnly = true)
    public AlbaranResponse obtener(Long id) {
        return respuesta.de(albaranRepository.buscarOFallar(id));
    }

    /** Edición parcial por el jefe: solo se toca lo que viene informado. */
    public AlbaranResponse editar(Long id, AlbaranPatch cambios) {
        Albaran albaran = albaranRepository.buscarOFallar(id);

        cambiarNumero(albaran, cambios.numero());
        if (cambios.fecha() != null) albaran.setFecha(cambios.fecha());
        if (cambios.clienteId() != null)
            albaran.setCliente(clienteService.paraElegir(cambios.clienteId(), albaran.getCliente()));
        if (cambios.trabajadorIds() != null)
            albaran.setTrabajadores(trabajadores(cambios.trabajadorIds()));
        if (cambios.descripcion() != null)
            albaran.setDescripcion(exigirNoVacio(cambios.descripcion(), "descripción"));
        cambiarImportes(albaran, cambios);
        if (cambios.materiales() != null)
            lineasMaterial.reemplazar(Material.OrigenTipo.ALBARAN, albaran.getId(), cambios.materiales());

        return respuesta.de(albaran);
    }

    public void borrar(Long id) {
        Albaran albaran = albaranRepository.buscarOFallar(id);
        fotos.borrarTodas(albaran.getId());
        lineasMaterial.borrarDe(Material.OrigenTipo.ALBARAN, albaran.getId());
        albaranRepository.delete(albaran);
    }

    // ---------- Firma ----------

    public AlbaranResponse guardarFirma(Long id, MultipartFile fichero) {
        Albaran albaran = albaranRepository.buscarOFallar(id);
        ValidadorImagen.Imagen firma = ValidadorImagen.validar(fichero, "firma");
        albaran.setFirma(firma.datos(), firma.tipoContenido());
        return respuesta.de(albaran);
    }

    @Transactional(readOnly = true)
    public Albaran obtenerConFirma(Long id) {
        Albaran albaran = albaranRepository.buscarOFallar(id);
        if (albaran.getFirma() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "El albarán " + id + " no tiene firma");
        }
        return albaran;
    }

    // ---------- auxiliares de la edición ----------

    /** El jefe puede cambiar el número para reencauzar la serie, siempre que no choque. */
    private void cambiarNumero(Albaran albaran, Long numero) {
        if (numero == null || numero.equals(albaran.getNumero())) return;
        if (numero < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El número de albarán debe ser 1 o mayor");
        }
        if (albaranRepository.existsByNumero(numero)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El número " + numero + " ya está usado por otro albarán");
        }
        albaran.setNumero(numero);
    }

    private Set<Trabajador> trabajadores(List<Long> ids) {
        if (ids.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El albarán tiene que llevar al menos un trabajador");
        }
        Set<Trabajador> trabajadores = new LinkedHashSet<>();
        for (Long id : ids) {
            trabajadores.add(trabajadorService.buscarOFallar(id));
        }
        return trabajadores;
    }

    /** Horas, precio por hora, importe extra y si el total sale en el PDF. */
    private static void cambiarImportes(Albaran albaran, AlbaranPatch cambios) {
        if (cambios.horas() != null)
            albaran.setHoras(noNegativo(cambios.horas(), "Las horas no pueden ser negativas"));
        if (cambios.precioHora() != null)
            albaran.setPrecioHora(noNegativo(cambios.precioHora(), "El precio por hora no puede ser negativo"));
        // El importe extra SÍ admite negativo: es como se aplica un descuento.
        if (cambios.importeExtra() != null) albaran.setImporteExtra(cambios.importeExtra());
        if (cambios.incluirTotal() != null) albaran.setIncluirTotal(cambios.incluirTotal());
    }

    private static BigDecimal noNegativo(BigDecimal valor, String mensaje) {
        if (valor.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
        }
        return valor;
    }

    /**
     * El albarán es un documento cerrado: un PATCH con "" o "   " no puede
     * dejar sin cliente, trabajador o descripción a algo que ya se imprimió.
     */
    private static String exigirNoVacio(String valor, String campo) {
        if (valor.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El campo '" + campo + "' no puede quedar vacío");
        }
        return valor.trim();
    }
}
