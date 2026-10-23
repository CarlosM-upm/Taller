package com.taller.herreria.trabajo;

import com.taller.herreria.albaran.AlbaranRepository;
import com.taller.herreria.material.Material;
import com.taller.herreria.material.MaterialRepository;
import com.taller.herreria.material.dto.MaterialDto;
import com.taller.herreria.trabajo.dto.TrabajoResponse;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Convierte un trabajo en lo que sale por la API, con la marca de "ya en un albarán". */
@Component
@Transactional(readOnly = true)
public class RespuestaTrabajo {

    private final AlbaranRepository albaranRepository;
    private final MaterialRepository materialRepository;
    private final FotosTrabajo fotos;

    public RespuestaTrabajo(AlbaranRepository albaranRepository,
                            MaterialRepository materialRepository, FotosTrabajo fotos) {
        this.albaranRepository = albaranRepository;
        this.materialRepository = materialRepository;
        this.fotos = fotos;
    }

    public TrabajoResponse de(Trabajo t) {
        return de(t, albaranRepository.findPorTrabajo(t.getId()).isPresent());
    }

    /**
     * Una lista entera. Los facturados se piden de una sola consulta, para no
     * preguntar por cada trabajo si ya está en un albarán.
     */
    public List<TrabajoResponse> de(List<Trabajo> trabajos) {
        Set<Long> facturados = new HashSet<>(albaranRepository.idsDeTrabajosFacturados());
        return trabajos.stream().map(t -> de(t, facturados.contains(t.getId()))).toList();
    }

    private TrabajoResponse de(Trabajo t, boolean enAlbaran) {
        return new TrabajoResponse(t.getId(), t.getEstado().name(), t.getFecha(),
                t.getCliente() == null ? null : t.getCliente().getId(),
                t.getCliente() == null ? null : t.getCliente().getNombre(),
                t.getTrabajador() == null ? null : t.getTrabajador().getId(),
                t.getTrabajador() == null ? null : t.getTrabajador().getNombre(),
                t.getDescripcion(), materialesDe(t.getId()), t.getHoras(), fotos.idsDe(t.getId()),
                enAlbaran, t.tieneFirma());
    }

    private List<MaterialDto> materialesDe(Long trabajoId) {
        return materialRepository
                .findByOrigenTipoAndOrigenIdOrderByIdAsc(Material.OrigenTipo.TRABAJO, trabajoId)
                .stream().map(MaterialDto::de).toList();
    }
}
