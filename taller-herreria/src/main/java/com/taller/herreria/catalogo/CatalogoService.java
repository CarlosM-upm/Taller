package com.taller.herreria.catalogo;

import com.taller.herreria.catalogo.dto.CatalogoDto;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

/**
 * Catálogo de materiales y sus familias. Todo lo que escribe es del jefe; la
 * consulta sin precios la usa también la tablet.
 */
@Service
@Transactional
public class CatalogoService {

    private final FamiliaMaterialRepository familias;
    private final MaterialCatalogoRepository materiales;

    public CatalogoService(FamiliaMaterialRepository familias, MaterialCatalogoRepository materiales) {
        this.familias = familias;
        this.materiales = materiales;
    }

    // ---------- Familias ----------

    @Transactional(readOnly = true)
    public List<FamiliaMaterial> listarFamilias() {
        return familias.findAllByOrderByNombreAsc();
    }

    public FamiliaMaterial crearFamilia(String nombre) {
        String limpio = exigirTexto(nombre, "Indique el nombre de la familia");
        exigirFamiliaNoRepetida(limpio, null);
        return familias.save(new FamiliaMaterial(limpio));
    }

    public FamiliaMaterial renombrarFamilia(Long id, String nombre) {
        String limpio = exigirTexto(nombre, "Indique el nombre de la familia");
        exigirFamiliaNoRepetida(limpio, id);
        FamiliaMaterial familia = familiaOFallar(id);
        familia.setNombre(limpio);
        return familia;
    }

    /**
     * Una familia con materiales no se borra: habría que decidir qué pasa con
     * ellos, y esa decisión es del jefe, no de una cascada.
     */
    public void borrarFamilia(Long id) {
        FamiliaMaterial familia = familiaOFallar(id);
        long dentro = materiales.countByFamiliaId(id);
        if (dentro > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No se puede borrar la familia \"" + familia.getNombre() + "\": tiene "
                            + dentro + (dentro == 1 ? " material" : " materiales")
                            + ". Bórrelos o páselos a otra familia antes.");
        }
        familias.delete(familia);
    }

    // ---------- Materiales ----------

    @Transactional(readOnly = true)
    public List<MaterialCatalogo> listarMateriales() {
        return materiales.findAllByOrderByFamiliaNombreAscNombreAsc();
    }

    @Transactional(readOnly = true)
    public MaterialCatalogo materialOFallar(Long id) {
        return materiales.findById(id).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "No existe el material " + id + " en el catálogo"));
    }

    public MaterialCatalogo crearMaterial(CatalogoDto.DatosMaterial datos) {
        FamiliaMaterial familia = familiaOFallar(datos.familiaId());
        String nombre = exigirTexto(datos.nombre(), "Indique el nombre del material");
        exigirMaterialNoRepetido(familia, nombre, null);

        MaterialCatalogo material = new MaterialCatalogo(familia, nombre,
                exigirTexto(datos.unidad(), "Indique la unidad"));
        aplicarPrecio(material, datos);
        return materiales.save(material);
    }

    /** Editar también puede cambiarlo de familia. */
    public MaterialCatalogo editarMaterial(Long id, CatalogoDto.DatosMaterial datos) {
        MaterialCatalogo material = materialOFallar(id);
        FamiliaMaterial familia = familiaOFallar(datos.familiaId());
        String nombre = exigirTexto(datos.nombre(), "Indique el nombre del material");
        exigirMaterialNoRepetido(familia, nombre, id);

        material.setFamilia(familia);
        material.setNombre(nombre);
        material.setUnidad(exigirTexto(datos.unidad(), "Indique la unidad"));
        aplicarPrecio(material, datos);
        return material;
    }

    /**
     * Borrar SÍ se permite aunque se haya usado: cada trabajo y cada albarán
     * guardan su propia copia del nombre, la unidad y el precio, y la base de
     * datos deja su enlace a nulo. Ningún documento se queda sin su material.
     *
     * Si se bloqueara como con los clientes, el catálogo iría acumulando para
     * siempre todo material que se hubiera usado alguna vez.
     */
    public void borrarMaterial(Long id) {
        materiales.delete(materialOFallar(id));
    }

    // ---------- auxiliares ----------

    private void aplicarPrecio(MaterialCatalogo material, CatalogoDto.DatosMaterial datos) {
        material.setPrecio(datos.precio());
        material.setPorcentajeExtra(datos.porcentajeExtra() == null ? BigDecimal.ZERO : datos.porcentajeExtra());
        material.setTransporte(datos.transporte() == null ? BigDecimal.ZERO : datos.transporte());
    }

    private FamiliaMaterial familiaOFallar(Long id) {
        return familias.findById(id).orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "No existe la familia de materiales " + id));
    }

    private static String exigirTexto(String valor, String mensaje) {
        String limpio = valor == null ? "" : valor.trim();
        if (limpio.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, mensaje);
        }
        return limpio;
    }

    private void exigirFamiliaNoRepetida(String nombre, Long idAExcluir) {
        familias.findByNombreIgnoreCase(nombre)
                .filter(existente -> !existente.getId().equals(idAExcluir))
                .ifPresent(existente -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Ya existe una familia llamada \"" + existente.getNombre() + "\"");
                });
    }

    private void exigirMaterialNoRepetido(FamiliaMaterial familia, String nombre, Long idAExcluir) {
        materiales.findByFamiliaIdAndNombreIgnoreCase(familia.getId(), nombre)
                .filter(existente -> !existente.getId().equals(idAExcluir))
                .ifPresent(existente -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Ya existe \"" + existente.getNombre() + "\" en la familia "
                                    + familia.getNombre());
                });
    }
}
