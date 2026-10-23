package com.taller.herreria.comun;

import java.util.ArrayList;
import java.util.List;

/**
 * Cuántos documentos cuelgan de un cliente o de un trabajador, en palabras:
 * "2 pedidos, 1 trabajo". Lo usan los dos al negarse a borrar a alguien con
 * documentos, para que el jefe sepa dónde mirar.
 */
public final class RecuentoDocumentos {

    private RecuentoDocumentos() { }

    /** Vacío si no tiene ninguno. */
    public static String texto(long pedidos, long trabajos, long albaranes) {
        List<String> partes = new ArrayList<>();
        anadir(partes, pedidos, " pedido", " pedidos");
        anadir(partes, trabajos, " trabajo", " trabajos");
        anadir(partes, albaranes, " albarán", " albaranes");
        return String.join(", ", partes);
    }

    private static void anadir(List<String> partes, long cuantos, String uno, String varios) {
        if (cuantos > 0) partes.add(cuantos + (cuantos == 1 ? uno : varios));
    }
}
