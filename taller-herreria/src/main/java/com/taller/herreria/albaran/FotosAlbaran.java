package com.taller.herreria.albaran;

import com.taller.herreria.foto.Foto;
import com.taller.herreria.foto.FotoRepository;
import com.taller.herreria.foto.ValidadorImagen;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/** Las fotos de un albarán: subirlas, verlas, borrarlas y copiarlas de sus trabajos. */
@Service
@Transactional
public class FotosAlbaran {

    /**
     * Más alto que en pedidos y trabajos (5): un albarán unificado junta las
     * fotos de varios trabajos, y tres visitas con cinco fotos cada una no
     * caben en cinco. Entran las que quepan y el jefe borra las que sobren.
     */
    public static final int MAX_FOTOS = 15;

    private final AlbaranRepository albaranRepository;
    private final FotoRepository fotoRepository;

    public FotosAlbaran(AlbaranRepository albaranRepository, FotoRepository fotoRepository) {
        this.albaranRepository = albaranRepository;
        this.fotoRepository = fotoRepository;
    }

    public List<Long> subir(Long albaranId, List<MultipartFile> ficheros) {
        Albaran albaran = albaranRepository.buscarOFallar(albaranId);
        ValidadorImagen.exigirAlgunFichero(ficheros);

        long existentes = fotoRepository.countByOrigenTipoAndOrigenId(
                Foto.OrigenTipo.ALBARAN, albaran.getId());
        if (existentes + ficheros.size() > MAX_FOTOS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Máximo " + MAX_FOTOS + " fotos por albarán (ya tiene " + existentes + ")");
        }

        for (MultipartFile fichero : ficheros) {
            ValidadorImagen.Imagen imagen = ValidadorImagen.validar(fichero, "foto");
            fotoRepository.save(new Foto(Foto.OrigenTipo.ALBARAN, albaran.getId(),
                    imagen.tipoContenido(), imagen.datos()));
        }
        return idsDe(albaran.getId());
    }

    @Transactional(readOnly = true)
    public Foto obtener(Long albaranId, Long fotoId) {
        albaranRepository.buscarOFallar(albaranId);
        return fotoRepository.findByIdAndOrigenTipoAndOrigenId(
                        fotoId, Foto.OrigenTipo.ALBARAN, albaranId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Ese albarán no tiene esa foto"));
    }

    public void borrar(Long albaranId, Long fotoId) {
        fotoRepository.delete(obtener(albaranId, fotoId));
    }

    /** Las fotos de todos los trabajos, en su orden, hasta el máximo que admite un albarán. */
    int copiarDesdeTrabajos(List<Long> trabajoIds, Long albaranId) {
        int copiadas = 0;
        for (Long trabajoId : trabajoIds) {
            for (Foto original : fotoRepository.findByOrigenTipoAndOrigenId(
                    Foto.OrigenTipo.TRABAJO, trabajoId)) {
                if (copiadas >= MAX_FOTOS) return copiadas;
                fotoRepository.save(new Foto(Foto.OrigenTipo.ALBARAN, albaranId,
                        original.getTipoContenido(), original.getDatos()));
                copiadas++;
            }
        }
        return copiadas;
    }

    /** Las fotos completas, para el PDF. */
    @Transactional(readOnly = true)
    List<Foto> de(Long albaranId) {
        return fotoRepository.findByOrigenTipoAndOrigenId(Foto.OrigenTipo.ALBARAN, albaranId);
    }

    /** Solo los identificadores: los listados no deben cargar las imágenes. */
    @Transactional(readOnly = true)
    List<Long> idsDe(Long albaranId) {
        return fotoRepository.idsPorOrigen(Foto.OrigenTipo.ALBARAN, albaranId);
    }

    /** Al borrar el albarán. */
    void borrarTodas(Long albaranId) {
        fotoRepository.deleteByOrigenTipoAndOrigenId(Foto.OrigenTipo.ALBARAN, albaranId);
    }
}
