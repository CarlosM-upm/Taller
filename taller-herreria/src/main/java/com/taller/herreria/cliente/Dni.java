package com.taller.herreria.cliente;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.regex.Pattern;

/**
 * Limpia y comprueba el DNI de un cliente. Admite tres formas:
 *
 * - DNI: 8 cifras y letra (12345678Z). Se comprueba la letra. Con 7 cifras se
 *   rellena con un cero delante, que es como se escriben los DNI antiguos.
 * - NIE: X, Y o Z, 7 cifras y letra (X1234567L). Se comprueba la letra.
 * - CIF de empresa: letra, 7 cifras y control (B12345678). Se acepta tal cual,
 *   sin calcular el control: decidido así con el taller.
 *
 * Se guarda limpio (mayúsculas, sin espacios, guiones ni puntos) para que
 * "12.345.678-z" y "12345678Z" se reconozcan como el mismo y no se repitan.
 */
public final class Dni {

    private static final String LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";
    private static final Pattern DNI = Pattern.compile("\\d{7,8}[A-Z]");
    private static final Pattern NIE = Pattern.compile("[XYZ]\\d{7}[A-Z]");
    private static final Pattern CIF = Pattern.compile("[ABCDEFGHJNPQRSUVW]\\d{7}[0-9A-J]");

    private Dni() { }

    /** Devuelve el DNI limpio, o rechaza con 400 diciendo qué está mal. */
    public static String normalizar(String texto) {
        String limpio = texto == null ? "" : texto.toUpperCase().replaceAll("[\\s.\\-]", "");
        if (limpio.isEmpty()) {
            throw invalido("Indique el DNI del cliente");
        }

        if (DNI.matcher(limpio).matches()) {
            if (limpio.length() == 8) limpio = "0" + limpio;
            exigirLetra(limpio, Long.parseLong(limpio.substring(0, 8)));
            return limpio;
        }
        if (NIE.matcher(limpio).matches()) {
            long numero = Long.parseLong("XYZ".indexOf(limpio.charAt(0)) + limpio.substring(1, 8));
            exigirLetra(limpio, numero);
            return limpio;
        }
        if (CIF.matcher(limpio).matches()) {
            return limpio;
        }
        throw invalido("\"" + texto.trim() + "\" no parece un DNI (12345678Z), "
                + "un NIE (X1234567L) ni un CIF (B12345678)");
    }

    private static void exigirLetra(String dni, long numero) {
        char esperada = LETRAS.charAt((int) (numero % 23));
        if (dni.charAt(dni.length() - 1) != esperada) {
            throw invalido("La letra del DNI " + dni + " no cuadra: con esos números sería "
                    + esperada + ". Revise que esté bien escrito");
        }
    }

    private static ResponseStatusException invalido(String mensaje) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
    }
}
