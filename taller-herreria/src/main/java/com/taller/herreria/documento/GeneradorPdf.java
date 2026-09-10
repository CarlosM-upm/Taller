package com.taller.herreria.documento;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.taller.herreria.foto.Foto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Convierte una plantilla HTML en un PDF.
 *
 * Lo comparten los tres documentos (pedido, trabajo y albarán), igual que
 * {@code foto/ValidadorImagen} comparte la validación de imágenes. Cada
 * servicio arma sus datos y elige su plantilla; aquí solo se pinta.
 *
 * Se eligió plantilla HTML en lugar de dibujar el PDF por código para que
 * ajustar un documento (márgenes, el logotipo, mover un bloque) sea editar
 * HTML y CSS en src/main/resources/templates/documentos/, sin tocar Java.
 */
@Component
public class GeneradorPdf {

    private static final Logger log = LoggerFactory.getLogger(GeneradorPdf.class);

    private static final DateTimeFormatter DIA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DIA_Y_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    /** Lo que se pinta donde no hay dato: un guion, nunca un hueco en blanco. */
    public static final String VACIO = "—";

    private final TemplateEngine motor;
    private final DatosTaller taller;

    public GeneradorPdf(TemplateEngine motor,
                        @Value("${taller.documento.nombre:Taller de herrería}") String nombre,
                        @Value("${taller.documento.direccion:}") String direccion,
                        @Value("${taller.documento.telefono:}") String telefono,
                        @Value("${taller.documento.cif:}") String cif) {
        this.motor = motor;
        this.taller = new DatosTaller(nombre, lineaDeDatos(direccion, telefono, cif));
    }

    /**
     * Dirección, teléfono y CIF en una sola línea, saltándose los que estén
     * sin rellenar. Se arma aquí y no en la plantilla porque un th:if con
     * cadena vacía en Thymeleaf da verdadero, y la cabecera salía con un
     * "· Tel. · CIF" suelto mientras no se configuraban los datos del taller.
     */
    private static String lineaDeDatos(String direccion, String telefono, String cif) {
        List<String> partes = new ArrayList<>();
        if (!direccion.isBlank()) partes.add(direccion.trim());
        if (!telefono.isBlank()) partes.add("Tel. " + telefono.trim());
        if (!cif.isBlank()) partes.add("CIF " + cif.trim());
        return String.join("  ·  ", partes);
    }

    /**
     * Pinta la plantilla con esas variables y devuelve el PDF.
     * Añade por su cuenta los datos del taller y la marca de generación,
     * que van en los tres documentos.
     */
    public byte[] generar(String plantilla, Map<String, Object> variables) {
        Context contexto = new Context();
        contexto.setVariables(variables);
        contexto.setVariable("taller", taller);
        contexto.setVariable("generadoEl", LocalDateTime.now().format(DIA_Y_HORA));

        String html = motor.process("documentos/" + plantilla, contexto);

        try (ByteArrayOutputStream salida = new ByteArrayOutputStream()) {
            PdfRendererBuilder constructor = new PdfRendererBuilder();
            constructor.useFastMode();
            constructor.withHtmlContent(html, null);
            constructor.toStream(salida);
            constructor.run();
            return salida.toByteArray();
        } catch (Exception fallo) {
            // Casi siempre es la plantilla: el lector es de XML y no perdona
            // un tag sin cerrar. Se registra el detalle porque al cliente solo
            // le llega el mensaje corto.
            log.error("Fallo al generar el PDF con la plantilla {}", plantilla, fallo);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "No se ha podido generar el PDF");
        }
    }

    // ---------- ayudas para que los tres documentos pinten igual ----------

    /** Texto o un guion si no hay nada. Los borradores llegan con campos a medias. */
    public static String texto(String valor) {
        return (valor == null || valor.isBlank()) ? VACIO : valor.trim();
    }

    public static String fecha(LocalDate fecha) {
        return fecha == null ? VACIO : fecha.format(DIA);
    }

    /**
     * Las imágenes viajan dentro del propio HTML como data URI.
     * Es la vía directa: openhtmltopdf las decodifica sin tener que darle
     * acceso a la base de datos ni escribir ficheros temporales.
     */
    public static String imagen(String tipoContenido, byte[] datos) {
        if (datos == null || datos.length == 0) return null;
        return "data:" + tipoContenido + ";base64," + Base64.getEncoder().encodeToString(datos);
    }

    public static List<String> imagenes(List<Foto> fotos) {
        return fotos.stream().map(f -> imagen(f.getTipoContenido(), f.getDatos())).toList();
    }

    /** Datos del taller que encabezan los documentos. Se rellenan en application.yml. */
    public record DatosTaller(String nombre, String datos) { }
}
