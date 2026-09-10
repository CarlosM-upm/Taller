package com.taller.herreria.documento;

/**
 * Un PDF ya generado, con el nombre de fichero que le corresponde.
 *
 * El nombre lo decide el servicio porque depende del negocio (el albarán se
 * identifica por su número, no por su id), y el controlador se limita a
 * ponerlo en la cabecera Content-Disposition.
 */
public record Documento(String nombre, byte[] contenido) { }
