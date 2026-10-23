package com.taller.herreria.albaran;

import com.taller.herreria.albaran.dto.AlbaranCrear;
import com.taller.herreria.albaran.dto.AlbaranResponse;
import com.taller.herreria.cliente.Cliente;
import com.taller.herreria.config.ConfiguracionService;
import com.taller.herreria.material.LineasMaterial;
import com.taller.herreria.trabajador.Trabajador;
import com.taller.herreria.trabajo.Trabajo;
import com.taller.herreria.trabajo.TrabajoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Alta de albaranes. Siempre nacen de uno o varios trabajos ENVIADOS del mismo
 * cliente, como copia (instantánea) de sus datos, materiales y fotos, y con el
 * número que da el contador editable.
 */
@Service
@Transactional
public class AltaAlbaran {

    private static final Logger log = LoggerFactory.getLogger(AltaAlbaran.class);

    private final AlbaranRepository albaranRepository;
    private final TrabajoRepository trabajoRepository;
    private final ConfiguracionService configuracion;
    private final LineasMaterial lineasMaterial;
    private final FotosAlbaran fotos;
    private final RespuestaAlbaran respuesta;

    public AltaAlbaran(AlbaranRepository albaranRepository, TrabajoRepository trabajoRepository,
                       ConfiguracionService configuracion, LineasMaterial lineasMaterial,
                       FotosAlbaran fotos, RespuestaAlbaran respuesta) {
        this.albaranRepository = albaranRepository;
        this.trabajoRepository = trabajoRepository;
        this.configuracion = configuracion;
        this.lineasMaterial = lineasMaterial;
        this.fotos = fotos;
        this.respuesta = respuesta;
    }

    /** Un solo trabajo: el caso de siempre, que no es más que unificar una lista de uno. */
    public AlbaranResponse desdeTrabajo(Long trabajoId, AlbaranCrear datos) {
        return desdeTrabajos(List.of(trabajoId), datos);
    }

    /**
     * Albarán a partir de uno o varios trabajos ENVIADOS del mismo cliente.
     *
     * Unificar es juntar: las descripciones se concatenan en el orden en que se
     * hicieron, los trabajadores se acumulan sin repetir, las horas se suman y
     * los materiales del mismo nombre se agrupan sumando cantidades. Todo queda
     * editable por el jefe: esto es el punto de partida, no el resultado final.
     */
    public AlbaranResponse desdeTrabajos(List<Long> trabajoIds, AlbaranCrear datos) {
        List<Trabajo> trabajos = enviadosSinAlbaran(trabajoIds);
        Cliente cliente = clienteComunConDni(trabajos);

        // En el orden en que se hicieron, para que la descripción se lea como el
        // histórico del mes. Un trabajo enviado siempre tiene fecha.
        trabajos.sort(Comparator.comparing(Trabajo::getFecha).thenComparing(Trabajo::getId));
        LocalDate fecha = (datos != null && datos.fecha() != null) ? datos.fecha() : LocalDate.now();

        Albaran albaran = juntar(numeroLibre(), fecha, cliente, trabajos);
        albaranRepository.save(albaran);

        List<Long> ids = trabajos.stream().map(Trabajo::getId).toList();
        lineasMaterial.copiarAAlbaran(ids, albaran.getId());
        int copiadas = fotos.copiarDesdeTrabajos(ids, albaran.getId());
        heredarFirma(albaran, trabajos);

        log.info("Albarán {} creado desde {} trabajo(s) {} ({} fotos copiadas)",
                albaran.getNumero(), trabajos.size(), ids, copiadas);
        return respuesta.de(albaran);
    }

    /** Los trabajos pedidos, sin repetir, que estén enviados y aún no facturados. */
    private List<Trabajo> enviadosSinAlbaran(List<Long> trabajoIds) {
        if (trabajoIds == null || trabajoIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Indique al menos un trabajo");
        }
        // Un mismo trabajo repetido en la lista duplicaría horas y materiales.
        List<Trabajo> trabajos = new ArrayList<>();
        for (Long id : new LinkedHashSet<>(trabajoIds)) {
            trabajos.add(enviadoSinAlbaran(id));
        }
        return trabajos;
    }

    private Trabajo enviadoSinAlbaran(Long id) {
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
        return trabajo;
    }

    /**
     * Mezclar clientes daría un albarán que no es de nadie: es el único campo
     * que no se puede unificar. Y el DNI sale del cliente: sin él el albarán no
     * se entrega. Se mira antes de tomar número, para no gastar uno en balde.
     */
    private static Cliente clienteComunConDni(List<Trabajo> trabajos) {
        Trabajo primero = trabajos.get(0);
        Cliente cliente = primero.getCliente();
        for (Trabajo trabajo : trabajos) {
            if (!trabajo.getCliente().getId().equals(cliente.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Todos los trabajos tienen que ser del mismo cliente: el "
                                + primero.getId() + " es de " + cliente.getNombre()
                                + " y el " + trabajo.getId() + " de "
                                + trabajo.getCliente().getNombre());
            }
        }
        if (!cliente.tieneDni()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El cliente \"" + cliente.getNombre() + "\" no tiene DNI: "
                            + "póngaselo en Ajustes antes de generar el albarán");
        }
        return cliente;
    }

    /** El siguiente del contador. Si el jefe lo reencauzó hacia uno ya usado, se avisa. */
    private long numeroLibre() {
        long numero = configuracion.tomarNumeroDeAlbaran();
        if (albaranRepository.existsByNumero(numero)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El número " + numero + " ya está usado por otro albarán. " +
                    "Ajuste el próximo número en la configuración.");
        }
        return numero;
    }

    /** Trabajadores sin repetir, descripciones una tras otra y horas sumadas. */
    private static Albaran juntar(long numero, LocalDate fecha, Cliente cliente, List<Trabajo> trabajos) {
        Set<Trabajador> trabajadores = new LinkedHashSet<>();
        Set<Long> ids = new LinkedHashSet<>();
        StringBuilder descripcion = new StringBuilder();
        BigDecimal horas = BigDecimal.ZERO;

        for (Trabajo trabajo : trabajos) {
            trabajadores.add(trabajo.getTrabajador());
            ids.add(trabajo.getId());
            anadirDescripcion(descripcion, trabajo.getDescripcion());
            if (trabajo.getHoras() != null) horas = horas.add(trabajo.getHoras());
        }

        Albaran albaran = new Albaran(numero, fecha, cliente, trabajadores, descripcion.toString(), ids);
        albaran.setHoras(horas);
        return albaran;
    }

    private static void anadirDescripcion(StringBuilder descripcion, String texto) {
        if (texto == null || texto.isBlank()) return;
        if (!descripcion.isEmpty()) descripcion.append("\n\n");
        descripcion.append(texto.trim());
    }

    /**
     * La firma solo se hereda si el albarán sale de UN trabajo: es el mismo
     * documento que el cliente firmó en la obra. Uno unificado no la hereda
     * aunque sus trabajos estén firmados, porque el cliente firmó cada visita,
     * no el documento del mes con su total. Ese se firma de nuevo.
     */
    private static void heredarFirma(Albaran albaran, List<Trabajo> trabajos) {
        if (trabajos.size() != 1 || !trabajos.get(0).tieneFirma()) return;
        Trabajo unico = trabajos.get(0);
        albaran.setFirma(unico.getFirma(), unico.getFirmaTipoContenido());
    }
}
