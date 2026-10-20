package com.taller.herreria.catalogo;

import com.taller.herreria.catalogo.dto.CatalogoDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Catálogo de materiales.
 *
 * Hay dos lecturas del catálogo y no una con un campo de más o de menos según
 * el rol: GET /api/catalogo (sin precios, para la tablet) y
 * GET /api/catalogo/precios (con precios, solo jefe). Así el reparto lo decide
 * SecurityConfig por la URL, como todo lo demás, y no queda escondido en un if
 * del controlador.
 */
@RestController
public class CatalogoController {

    private final CatalogoService servicio;

    public CatalogoController(CatalogoService servicio) {
        this.servicio = servicio;
    }

    // ---------- Familias ----------

    @GetMapping("/api/familias-material")
    public List<CatalogoDto.Familia> familias() {
        return servicio.listarFamilias().stream().map(CatalogoDto.Familia::de).toList();
    }

    @PostMapping("/api/familias-material")
    @ResponseStatus(HttpStatus.CREATED)
    public CatalogoDto.Familia crearFamilia(@Valid @RequestBody CatalogoDto.DatosFamilia datos) {
        return CatalogoDto.Familia.de(servicio.crearFamilia(datos.nombre()));
    }

    @PutMapping("/api/familias-material/{id}")
    public CatalogoDto.Familia renombrarFamilia(@PathVariable Long id,
                                                @Valid @RequestBody CatalogoDto.DatosFamilia datos) {
        return CatalogoDto.Familia.de(servicio.renombrarFamilia(id, datos.nombre()));
    }

    @DeleteMapping("/api/familias-material/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrarFamilia(@PathVariable Long id) {
        servicio.borrarFamilia(id);
    }

    // ---------- Materiales ----------

    /** Sin precios: es lo que pide la tablet para poblar las filas de materiales. */
    @GetMapping("/api/catalogo")
    public List<CatalogoDto.Material> catalogo() {
        return servicio.listarMateriales().stream().map(CatalogoDto.Material::de).toList();
    }

    /** Con precios. Solo jefe. */
    @GetMapping("/api/catalogo/precios")
    public List<CatalogoDto.MaterialConPrecio> catalogoConPrecios() {
        return servicio.listarMateriales().stream().map(CatalogoDto.MaterialConPrecio::de).toList();
    }

    @PostMapping("/api/catalogo")
    @ResponseStatus(HttpStatus.CREATED)
    public CatalogoDto.MaterialConPrecio crearMaterial(@Valid @RequestBody CatalogoDto.DatosMaterial datos) {
        return CatalogoDto.MaterialConPrecio.de(servicio.crearMaterial(datos));
    }

    @PutMapping("/api/catalogo/{id}")
    public CatalogoDto.MaterialConPrecio editarMaterial(@PathVariable Long id,
                                                        @Valid @RequestBody CatalogoDto.DatosMaterial datos) {
        return CatalogoDto.MaterialConPrecio.de(servicio.editarMaterial(id, datos));
    }

    @DeleteMapping("/api/catalogo/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void borrarMaterial(@PathVariable Long id) {
        servicio.borrarMaterial(id);
    }
}
