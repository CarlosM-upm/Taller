package com.taller.herreria.comun;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Traduce cualquier excepción a una {@link RespuestaError} en castellano.
 *
 * Hereda de ResponseEntityExceptionHandler para que los fallos propios de
 * Spring MVC (JSON mal formado, ruta inexistente, método no permitido,
 * falta la parte "fotos" de un multipart...) también salgan con el mismo
 * formato, en vez de convertirse en un 500 sin explicación.
 *
 * Ojo: los rechazos por falta de token o de permiso NO pasan por aquí.
 * Ocurren en la cadena de filtros de Spring Security, antes de llegar al
 * controlador; se resuelven en SecurityConfig.
 */
@RestControllerAdvice
public class ManejadorErrores extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ManejadorErrores.class);

    /**
     * El caso habitual: las reglas de negocio de los Service lanzan
     * ResponseStatusException con un mensaje pensado para que lo lea una persona.
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<RespuestaError> deNegocio(ResponseStatusException ex, WebRequest peticion) {
        String mensaje = (ex.getReason() != null) ? ex.getReason() : "Error en la petición";
        return ResponseEntity.status(ex.getStatusCode())
                .body(RespuestaError.de(ex.getStatusCode(), mensaje, rutaDe(peticion)));
    }

    /**
     * Choque contra una restricción de la base de datos. El caso real es el
     * número de albarán duplicado cuando dos peticiones pasan a la vez la
     * comprobación previa: es un conflicto, no un fallo del servidor.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<RespuestaError> deIntegridad(DataIntegrityViolationException ex,
                                                       WebRequest peticion) {
        log.warn("Restricción de base de datos violada en {}", rutaDe(peticion), ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(RespuestaError.de(HttpStatus.CONFLICT,
                        "La operación choca con un dato que ya existe. " +
                        "Si es un albarán, revise que el número no esté repetido.",
                        rutaDe(peticion)));
    }

    /** Por si algún día se usa seguridad a nivel de método: 403, no 500. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<RespuestaError> deAccesoDenegado(AccessDeniedException ex,
                                                           WebRequest peticion) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(RespuestaError.de(HttpStatus.FORBIDDEN,
                        "No tiene permiso para esta operación", rutaDe(peticion)));
    }

    /**
     * Red de seguridad. Lo que llega aquí es un fallo no previsto: se registra
     * completo en el log (el servidor del taller no tiene a nadie delante) y
     * al cliente se le da un mensaje genérico.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<RespuestaError> inesperado(Exception ex, WebRequest peticion) {
        log.error("Fallo no controlado en {}", rutaDe(peticion), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(RespuestaError.de(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Error interno del servidor. Revise el registro para más detalle.",
                        rutaDe(peticion)));
    }

    /** Validación de @Valid: se devuelve el detalle campo por campo. */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders cabeceras,
            HttpStatusCode estado, WebRequest peticion) {

        Map<String, String> campos = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            campos.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return ResponseEntity.status(estado).body(RespuestaError.deValidacion(
                estado, "Hay datos que no son válidos", rutaDe(peticion), campos));
    }

    /**
     * Resto de fallos de Spring MVC, con el mismo formato que los demás.
     * Aquí caen también las subidas demasiado grandes (413), que la clase
     * padre ya detecta: no hay que declararlas aparte o el mapeo sería ambiguo.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, @Nullable Object cuerpo, HttpHeaders cabeceras,
            HttpStatusCode estado, WebRequest peticion) {

        if (estado.is5xxServerError()) {
            log.error("Fallo de Spring MVC en {}", rutaDe(peticion), ex);
        }
        return ResponseEntity.status(estado)
                .body(RespuestaError.de(estado, mensajeLegible(ex, estado), rutaDe(peticion)));
    }

    private String mensajeLegible(Exception ex, HttpStatusCode estado) {
        return switch (estado.value()) {
            case 400 -> "La petición no es válida o los datos están mal formados";
            case 404 -> "La dirección solicitada no existe";
            case 405 -> "Ese método HTTP no está permitido en esta dirección";
            case 413 -> "Las imágenes pesan demasiado. Máximo 10 MB por foto y 60 MB por envío.";
            case 415 -> "El formato enviado no está admitido";
            default -> ex.getMessage() != null ? ex.getMessage() : "Error en la petición";
        };
    }

    private String rutaDe(WebRequest peticion) {
        if (peticion instanceof ServletWebRequest servlet) {
            return servlet.getRequest().getRequestURI();
        }
        return peticion.getDescription(false);
    }
}
