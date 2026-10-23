package com.taller.herreria.material;

import com.taller.herreria.catalogo.CatalogoService;
import com.taller.herreria.catalogo.MaterialCatalogo;
import com.taller.herreria.material.dto.MaterialDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sustituye las líneas de material de un trabajo o de un albarán.
 *
 * Vive aquí y no repetido en los dos servicios porque las reglas son las mismas:
 *
 * - Una línea nueva SOLO puede salir del catálogo (decisión del taller: que no
 *   vuelva el desorden de materiales escritos cada uno a su manera). Nombre y
 *   unidad se copian del catálogo; lo que mande la pantalla se ignora.
 * - Excepción: las líneas que ya existían sin catálogo (anteriores a él, o
 *   cuyo material se borró después) se conservan tal cual. Se admiten solo si
 *   ya estaban en ese mismo documento: sirve para no bloquear la edición de un
 *   trabajo antiguo, sin abrir la puerta a teclear materiales nuevos.
 * - En el albarán, si la línea no trae precio se toma el total del catálogo en
 *   ese momento, como COPIA.
 *
 * Se borran las líneas y se vuelven a insertar: la pantalla manda siempre la
 * lista entera, y casarlas una a una daría el mismo resultado con más código.
 */
@Component
@Transactional
public class LineasMaterial {

    private final MaterialRepository repositorio;
    private final CatalogoService catalogo;

    public LineasMaterial(MaterialRepository repositorio, CatalogoService catalogo) {
        this.repositorio = repositorio;
        this.catalogo = catalogo;
    }

    public void reemplazar(Material.OrigenTipo tipo, Long origenId, List<MaterialDto> lineas) {
        Map<String, String> sinCatalogoPrevias = sinCatalogoPrevias(tipo, origenId);
        repositorio.deleteByOrigenTipoAndOrigenId(tipo, origenId);

        for (MaterialDto linea : lineas) {
            exigirPrecioNoNegativo(tipo, linea);
            Material material;
            if (linea.catalogoId() != null) {
                material = delCatalogo(tipo, origenId, linea);
            } else if (linea.nombre() != null && sinCatalogoPrevias.containsKey(clave(linea.nombre()))) {
                material = antiguaSinCatalogo(tipo, origenId, linea, sinCatalogoPrevias);
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Los materiales se eligen del catálogo. Si falta alguno, el jefe "
                                + "lo da de alta en Ajustes");
            }
            repositorio.save(material);
        }
    }

    /**
     * Las líneas sin catálogo que ya tenía este documento, con su unidad: son
     * las únicas que se admiten sin catalogoId.
     */
    private Map<String, String> sinCatalogoPrevias(Material.OrigenTipo tipo, Long origenId) {
        Map<String, String> previas = new HashMap<>();
        for (Material previa : repositorio.findByOrigenTipoAndOrigenIdOrderByIdAsc(tipo, origenId)) {
            if (previa.getCatalogoId() == null) {
                previas.putIfAbsent(clave(previa.getNombre()), previa.getUnidad());
            }
        }
        return previas;
    }

    /** Nombre y unidad del catálogo; en el albarán, su precio total si la línea no trae otro. */
    private Material delCatalogo(Material.OrigenTipo tipo, Long origenId, MaterialDto linea) {
        MaterialCatalogo delCatalogo = catalogo.materialOFallar(linea.catalogoId());
        Material material = new Material(tipo, origenId, delCatalogo.getNombre(), linea.cantidad());
        material.setCatalogoId(delCatalogo.getId());
        material.setUnidad(delCatalogo.getUnidad());
        if (tipo == Material.OrigenTipo.ALBARAN) {
            material.setPrecio(linea.precio() != null ? linea.precio() : delCatalogo.precioTotal());
        }
        return material;
    }

    private static Material antiguaSinCatalogo(Material.OrigenTipo tipo, Long origenId,
                                               MaterialDto linea, Map<String, String> previas) {
        Material material = new Material(tipo, origenId, linea.nombre().trim(), linea.cantidad());
        material.setUnidad(previas.get(clave(linea.nombre())));
        if (tipo == Material.OrigenTipo.ALBARAN) material.setPrecio(linea.precio());
        return material;
    }

    /** Solo el albarán lleva precio, y no puede ser negativo. */
    private static void exigirPrecioNoNegativo(Material.OrigenTipo tipo, MaterialDto linea) {
        if (tipo != Material.OrigenTipo.ALBARAN || linea.precio() == null) return;
        if (linea.precio().compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El precio de un material no puede ser negativo");
        }
    }

    /** Si el documento lleva al menos una línea: un trabajo sin materiales no se envía. */
    public boolean hayAlguna(Material.OrigenTipo tipo, Long origenId) {
        return repositorio.countByOrigenTipoAndOrigenId(tipo, origenId) > 0;
    }

    /** Todas las líneas de un documento, al borrarlo. */
    public void borrarDe(Material.OrigenTipo tipo, Long origenId) {
        repositorio.deleteByOrigenTipoAndOrigenId(tipo, origenId);
    }

    /**
     * Copia las líneas de varios trabajos a un albarán, agrupando las que son el
     * mismo material y sumando cantidades.
     *
     * El precio de cada línea se toma del catálogo EN ESTE MOMENTO y se queda
     * copiado: si el catálogo cambia mañana, este albarán no.
     */
    public void copiarAAlbaran(List<Long> trabajoIds, Long albaranId) {
        Map<String, Material> agrupadas = new LinkedHashMap<>();
        for (Long trabajoId : trabajoIds) {
            for (Material original : repositorio.findByOrigenTipoAndOrigenIdOrderByIdAsc(
                    Material.OrigenTipo.TRABAJO, trabajoId)) {
                // Mismo material del catálogo => misma línea. Sin catálogo, se
                // agrupan por nombre como antes.
                String claveGrupo = original.getCatalogoId() != null
                        ? "c" + original.getCatalogoId()
                        : "n" + clave(original.getNombre());

                Material acumulada = agrupadas.get(claveGrupo);
                if (acumulada != null) {
                    acumulada.setCantidad(acumulada.getCantidad().add(original.getCantidad()));
                    continue;
                }
                Material copia = new Material(Material.OrigenTipo.ALBARAN, albaranId,
                        original.getNombre(), original.getCantidad());
                copia.setCatalogoId(original.getCatalogoId());
                copia.setUnidad(original.getUnidad());
                // Si el enlace sigue puesto, el material existe: al borrarlo del
                // catálogo la base de datos lo deja a nulo.
                if (original.getCatalogoId() != null) {
                    copia.setPrecio(catalogo.materialOFallar(original.getCatalogoId()).precioTotal());
                }
                agrupadas.put(claveGrupo, copia);
            }
        }
        agrupadas.values().forEach(repositorio::save);
    }

    private static String clave(String nombre) {
        return nombre == null ? "" : nombre.trim().toLowerCase();
    }
}
