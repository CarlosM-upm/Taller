package com.taller.herreria.foto;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

/**
 * Comprueba que lo que llega es de verdad una imagen, y de un formato que
 * sabemos manejar. Lo usan las tres entidades (fotos de pedido, trabajo y
 * albarán) y también la firma del cliente.
 *
 * Antes cada Service se fiaba de la cabecera Content-Type que declara el
 * cliente. Eso tenía dos problemas: es falsificable (basta con decir
 * "image/jpeg" y mandar cualquier cosa) y dejaba pasar "image/svg+xml", que
 * es un formato de texto capaz de llevar scripts dentro. Aquí se miran los
 * primeros bytes del fichero, que no se pueden falsear tan fácilmente, y
 * **el tipo se deduce del contenido**, no se copia de lo que diga el cliente:
 * así lo que se guarda en la base de datos siempre describe la imagen real.
 *
 * Solo se admiten JPEG y PNG: JPEG es lo que sale de la cámara de la tablet
 * y PNG lo que produce el lienzo donde el cliente firma.
 */
public final class ValidadorImagen {

    /** Imagen ya leída y comprobada, con el tipo deducido de su contenido. */
    public record Imagen(byte[] datos, String tipoContenido) { }

    private static final byte[] CABECERA_JPEG = {
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF
    };
    private static final byte[] CABECERA_PNG = {
            (byte) 0x89, (byte) 0x50, (byte) 0x4E, (byte) 0x47,
            (byte) 0x0D, (byte) 0x0A, (byte) 0x1A, (byte) 0x0A
    };

    private ValidadorImagen() { } // solo métodos estáticos

    /**
     * Sin esto, subir el formulario sin adjuntar nada devolvía 201 y la lista
     * de fotos que ya había, dando a entender que se guardó algo.
     */
    public static void exigirAlgunFichero(List<MultipartFile> ficheros) {
        if (ficheros == null || ficheros.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No se recibió ninguna imagen");
        }
    }

    /**
     * @param queEs cómo llamar al fichero en los mensajes de error ("foto", "firma").
     */
    public static Imagen validar(MultipartFile fichero, String queEs) {
        if (fichero == null || fichero.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La " + queEs + " llegó vacía");
        }

        byte[] datos;
        try {
            datos = fichero.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "No se pudo leer la " + queEs + " recibida");
        }

        String tipo = tipoSegunContenido(datos);
        if (tipo == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La " + queEs + " debe ser una imagen JPEG o PNG");
        }
        return new Imagen(datos, tipo);
    }

    /** Devuelve el tipo MIME según los bytes de cabecera, o null si no lo reconocemos. */
    private static String tipoSegunContenido(byte[] datos) {
        if (empiezaPor(datos, CABECERA_JPEG)) return MediaType.IMAGE_JPEG_VALUE;
        if (empiezaPor(datos, CABECERA_PNG))  return MediaType.IMAGE_PNG_VALUE;
        return null;
    }

    private static boolean empiezaPor(byte[] datos, byte[] cabecera) {
        if (datos.length < cabecera.length) return false;
        for (int i = 0; i < cabecera.length; i++) {
            if (datos[i] != cabecera[i]) return false;
        }
        return true;
    }
}
