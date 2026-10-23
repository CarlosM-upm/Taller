package com.taller.herreria.trabajo;

import com.taller.herreria.foto.Foto;
import com.taller.herreria.foto.FotoRepository;
import com.taller.herreria.foto.ValidadorImagen;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static com.taller.herreria.trabajo.PermisosTrabajo.exigirJefeSiEnviado;

/** Las fotos de un trabajo. En uno enviado, añadirlas o quitarlas es del jefe. */
@Service
@Transactional
public class FotosTrabajo {

    public static final int MAX_FOTOS = 5;

    private final TrabajoRepository trabajoRepository;
    private final FotoRepository fotoRepository;

    public FotosTrabajo(TrabajoRepository trabajoRepository, FotoRepository fotoRepository) {
        this.trabajoRepository = trabajoRepository;
        this.fotoRepository = fotoRepository;
    }

    public List<Long> subir(Long id, List<MultipartFile> ficheros) {
        Trabajo trabajo = trabajoRepository.buscarOFallar(id);
        exigirJefeSiEnviado(trabajo, "añadir fotos a");
        ValidadorImagen.exigirAlgunFichero(ficheros);

        long existentes = fotoRepository.countByOrigenTipoAndOrigenId(
                Foto.OrigenTipo.TRABAJO, trabajo.getId());
        if (existentes + ficheros.size() > MAX_FOTOS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Máximo " + MAX_FOTOS + " fotos por trabajo (ya tiene " + existentes + ")");
        }

        for (MultipartFile fichero : ficheros) {
            ValidadorImagen.Imagen imagen = ValidadorImagen.validar(fichero, "foto");
            fotoRepository.save(new Foto(Foto.OrigenTipo.TRABAJO, trabajo.getId(),
                    imagen.tipoContenido(), imagen.datos()));
        }
        return idsDe(trabajo.getId());
    }

    @Transactional(readOnly = true)
    public Foto obtener(Long trabajoId, Long fotoId) {
        trabajoRepository.buscarOFallar(trabajoId);
        return fotoRepository.findByIdAndOrigenTipoAndOrigenId(
                        fotoId, Foto.OrigenTipo.TRABAJO, trabajoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Ese trabajo no tiene esa foto"));
    }

    public void borrar(Long trabajoId, Long fotoId) {
        exigirJefeSiEnviado(trabajoRepository.buscarOFallar(trabajoId), "quitar fotos de");
        fotoRepository.delete(obtener(trabajoId, fotoId));
    }

    /** Las fotos completas, para el PDF. */
    @Transactional(readOnly = true)
    List<Foto> de(Long trabajoId) {
        return fotoRepository.findByOrigenTipoAndOrigenId(Foto.OrigenTipo.TRABAJO, trabajoId);
    }

    /** Solo los identificadores: los listados no deben cargar las imágenes. */
    @Transactional(readOnly = true)
    List<Long> idsDe(Long trabajoId) {
        return fotoRepository.idsPorOrigen(Foto.OrigenTipo.TRABAJO, trabajoId);
    }

    /** Al borrar el trabajo. */
    void borrarTodas(Long trabajoId) {
        fotoRepository.deleteByOrigenTipoAndOrigenId(Foto.OrigenTipo.TRABAJO, trabajoId);
    }
}
