package com.taller.herreria.trabajo;

import com.taller.herreria.documento.Documento;
import com.taller.herreria.documento.GeneradorPdf;
import com.taller.herreria.material.Material;
import com.taller.herreria.material.MaterialRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * Documento PDF del trabajo. Solo jefe (la regla vive en SecurityConfig).
 *
 * Un borrador también se puede imprimir: sale con guiones donde falten datos,
 * que es justo lo que el jefe quiere ver si lo repasa en papel.
 */
@Service
@Transactional(readOnly = true)
public class PdfTrabajo {

    private final TrabajoRepository trabajoRepository;
    private final MaterialRepository materialRepository;
    private final FotosTrabajo fotos;
    private final GeneradorPdf generadorPdf;

    public PdfTrabajo(TrabajoRepository trabajoRepository, MaterialRepository materialRepository,
                      FotosTrabajo fotos, GeneradorPdf generadorPdf) {
        this.trabajoRepository = trabajoRepository;
        this.materialRepository = materialRepository;
        this.fotos = fotos;
        this.generadorPdf = generadorPdf;
    }

    public Documento generar(Long id) {
        Trabajo trabajo = trabajoRepository.buscarOFallar(id);

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
        datos.put("fotos", GeneradorPdf.imagenes(fotos.de(trabajo.getId())));

        return new Documento("trabajo-" + trabajo.getId() + ".pdf",
                generadorPdf.generar("trabajo", datos));
    }

    /** En el documento las horas se escriben como se leen aquí: con coma. */
    private static String horasDeDocumento(BigDecimal horas) {
        return horas == null ? GeneradorPdf.VACIO : horas.toPlainString().replace('.', ',') + " h";
    }
}
