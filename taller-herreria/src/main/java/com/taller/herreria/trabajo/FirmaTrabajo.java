package com.taller.herreria.trabajo;

import com.taller.herreria.foto.ValidadorImagen;
import com.taller.herreria.seguridad.SeguridadUtils;
import com.taller.herreria.trabajo.dto.TrabajoResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import static com.taller.herreria.trabajo.PermisosTrabajo.exigirJefeSiEnviado;

/** La firma del cliente en el trabajo, recogida en la obra desde la tablet. */
@Service
@Transactional
public class FirmaTrabajo {

    private final TrabajoRepository trabajoRepository;
    private final RespuestaTrabajo respuesta;

    public FirmaTrabajo(TrabajoRepository trabajoRepository, RespuestaTrabajo respuesta) {
        this.trabajoRepository = trabajoRepository;
        this.respuesta = respuesta;
    }

    /**
     * Recoger la firma del cliente en la obra, desde la tablet.
     *
     * Rompe a propósito la regla de "trabajo enviado = solo el jefe": el
     * trabajador puede firmar un trabajo YA enviado, porque es normal enviarlo
     * desde el taller y que el cliente firme después. Lo que no puede es
     * SUSTITUIR una firma ya recogida en un trabajo enviado: eso sí es del jefe.
     * Si no, cualquiera podría cambiar una firma que el cliente ya puso.
     */
    public TrabajoResponse guardar(Long id, MultipartFile fichero) {
        Trabajo trabajo = trabajoRepository.buscarOFallar(id);
        if (!trabajo.esBorrador() && trabajo.tieneFirma() && !SeguridadUtils.esJefe()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Este trabajo enviado ya tiene la firma del cliente: solo el jefe puede cambiarla");
        }
        ValidadorImagen.Imagen firma = ValidadorImagen.validar(fichero, "firma");
        trabajo.setFirma(firma.datos(), firma.tipoContenido());
        return respuesta.de(trabajo);
    }

    @Transactional(readOnly = true)
    public Trabajo obtener(Long id) {
        Trabajo trabajo = trabajoRepository.buscarOFallar(id);
        if (!trabajo.tieneFirma()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "El trabajo " + id + " no tiene firma");
        }
        return trabajo;
    }

    /** Quitar la firma: en un borrador cualquiera, en un enviado solo el jefe. */
    public TrabajoResponse borrar(Long id) {
        Trabajo trabajo = trabajoRepository.buscarOFallar(id);
        exigirJefeSiEnviado(trabajo, "quitar la firma de");
        trabajo.setFirma(null, null);
        return respuesta.de(trabajo);
    }
}
