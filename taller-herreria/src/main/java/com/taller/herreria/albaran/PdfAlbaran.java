package com.taller.herreria.albaran;

import com.taller.herreria.documento.Documento;
import com.taller.herreria.documento.GeneradorPdf;
import com.taller.herreria.trabajador.Trabajador;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Documento PDF del albarán: el que se imprime, se firma en papel si hace
 * falta y se archiva. Lleva la firma recogida en pantalla y las fotos.
 */
@Service
@Transactional(readOnly = true)
public class PdfAlbaran {

    private final AlbaranRepository albaranRepository;
    private final FotosAlbaran fotos;
    private final RespuestaAlbaran respuesta;
    private final GeneradorPdf generadorPdf;

    public PdfAlbaran(AlbaranRepository albaranRepository, FotosAlbaran fotos,
                      RespuestaAlbaran respuesta, GeneradorPdf generadorPdf) {
        this.albaranRepository = albaranRepository;
        this.fotos = fotos;
        this.respuesta = respuesta;
        this.generadorPdf = generadorPdf;
    }

    public Documento generar(Long id) {
        Albaran albaran = albaranRepository.buscarOFallar(id);

        // HashMap y no Map.of: la firma puede no existir todavía y Map.of no admite nulos.
        Map<String, Object> datos = new HashMap<>();
        datos.put("numero", albaran.getNumero());
        datos.put("fecha", GeneradorPdf.fecha(albaran.getFecha()));
        datos.put("cliente", GeneradorPdf.texto(albaran.getCliente().getNombre()));
        datos.put("dniCliente", GeneradorPdf.texto(albaran.getCliente().getDni()));
        datos.put("trabajador", GeneradorPdf.texto(nombresDe(albaran)));
        datos.put("descripcion", GeneradorPdf.texto(albaran.getDescripcion()));
        datos.put("firma", GeneradorPdf.imagen(albaran.getFirmaTipoContenido(), albaran.getFirma()));

        // El desglose (precio por material, precio por hora) NO se imprime nunca:
        // es información interna del taller. Solo puede salir el total, y solo
        // si el jefe lo ha marcado en la ficha.
        if (albaran.isIncluirTotal()) {
            datos.put("costeTotal", GeneradorPdf.euros(respuesta.costeTotal(albaran)));
        }
        datos.put("fotos", GeneradorPdf.imagenes(fotos.de(albaran.getId())));

        // El albarán se identifica por su número, no por su id interno.
        return new Documento("albaran-" + albaran.getNumero() + ".pdf",
                generadorPdf.generar("albaran", datos));
    }

    /** Los nombres de los trabajadores, para la línea del PDF. */
    private static String nombresDe(Albaran albaran) {
        return albaran.getTrabajadores().stream()
                .map(Trabajador::getNombre)
                .collect(Collectors.joining(", "));
    }
}
