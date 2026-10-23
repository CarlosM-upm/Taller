package com.taller.herreria.albaran;

import com.taller.herreria.albaran.dto.AlbaranResponse;
import com.taller.herreria.material.Material;
import com.taller.herreria.material.MaterialRepository;
import com.taller.herreria.material.dto.MaterialDto;
import com.taller.herreria.trabajador.dto.TrabajadorDto;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Convierte un albarán en lo que sale por la API, y calcula su coste.
 *
 * El cálculo vive aquí, en un solo sitio, porque lo usan la respuesta y el PDF:
 * si estuviera repetido, un día la pantalla y el papel dirían totales distintos.
 */
@Component
@Transactional(readOnly = true)
public class RespuestaAlbaran {

    private final MaterialRepository materialRepository;
    private final FotosAlbaran fotos;

    public RespuestaAlbaran(MaterialRepository materialRepository, FotosAlbaran fotos) {
        this.materialRepository = materialRepository;
        this.fotos = fotos;
    }

    public AlbaranResponse de(Albaran a) {
        List<Material> materiales = materialesDe(a);
        BigDecimal sumado = costeSumado(a, materiales);

        return new AlbaranResponse(a.getId(), a.getNumero(), a.getFecha(),
                a.getCliente().getId(), a.getCliente().getNombre(), a.getCliente().getDni(),
                a.getTrabajadores().stream().map(TrabajadorDto.Resumen::de).toList(),
                a.getDescripcion(), a.getHoras(),
                materiales.stream().map(MaterialDto::de).toList(),
                a.getPrecioHora(), sumado, a.getImporteExtra(), sumado.add(extra(a)),
                a.isIncluirTotal(), a.getFirma() != null,
                List.copyOf(a.getTrabajoIds()), fotos.idsDe(a.getId()));
    }

    /** Materiales + mano de obra + importe extra: lo único que puede salir impreso. */
    public BigDecimal costeTotal(Albaran albaran) {
        return costeSumado(albaran, materialesDe(albaran)).add(extra(albaran));
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

    private List<Material> materialesDe(Albaran albaran) {
        return materialRepository.findByOrigenTipoAndOrigenIdOrderByIdAsc(
                Material.OrigenTipo.ALBARAN, albaran.getId());
    }

    private static BigDecimal extra(Albaran albaran) {
        return albaran.getImporteExtra() == null ? BigDecimal.ZERO : albaran.getImporteExtra();
    }
}
