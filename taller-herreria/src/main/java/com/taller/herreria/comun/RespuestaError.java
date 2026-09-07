package com.taller.herreria.comun;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.http.HttpStatusCode;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Cuerpo único de todas las respuestas de error de la API.
 *
 * Existe porque, por defecto, Spring Boot NO incluye el mensaje de las
 * excepciones en la respuesta (server.error.include-message = never): todos
 * los mensajes en castellano que escribimos en los Service llegaban vacíos
 * al cliente. Con esto se ven, y además la PWA tiene una forma estable de
 * leer el error sin adivinar el formato.
 *
 * "campos" solo viaja cuando el fallo es de validación de datos de entrada;
 * en el resto de casos se omite del JSON.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RespuestaError(
        LocalDateTime momento,
        int codigo,
        String error,
        String mensaje,
        String ruta,
        Map<String, String> campos) {

    public static RespuestaError de(HttpStatusCode estado, String mensaje, String ruta) {
        return new RespuestaError(LocalDateTime.now(), estado.value(),
                nombreDe(estado), mensaje, ruta, null);
    }

    public static RespuestaError deValidacion(HttpStatusCode estado, String mensaje,
                                              String ruta, Map<String, String> campos) {
        return new RespuestaError(LocalDateTime.now(), estado.value(),
                nombreDe(estado), mensaje, ruta, campos);
    }

    /** Texto corto del código HTTP ("Bad Request", "Not Found"...). */
    private static String nombreDe(HttpStatusCode estado) {
        return org.springframework.http.HttpStatus.valueOf(estado.value()).getReasonPhrase();
    }
}
