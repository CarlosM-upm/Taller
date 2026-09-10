package com.taller.herreria.documento;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * Traduce un {@link Documento} a respuesta HTTP. Lo usan los tres
 * controladores, que solo se encargan de eso: de traducir a HTTP.
 */
public final class RespuestaPdf {

    private RespuestaPdf() { }

    public static ResponseEntity<byte[]> de(Documento documento) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(documento.nombre()).build().toString())
                .body(documento.contenido());
    }
}
