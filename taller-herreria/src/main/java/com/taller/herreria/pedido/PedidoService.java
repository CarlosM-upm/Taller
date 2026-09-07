package com.taller.herreria.pedido;

import com.taller.herreria.foto.Foto;
import com.taller.herreria.foto.FotoRepository;
import com.taller.herreria.foto.ValidadorImagen;
import com.taller.herreria.pedido.dto.PedidoPatch;
import com.taller.herreria.pedido.dto.PedidoRequest;
import com.taller.herreria.pedido.dto.PedidoResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Lógica de negocio de los pedidos.
 * Aquí viven las reglas: fecha automática, máximo 5 fotos, etc.
 */
@Service
@Transactional
public class PedidoService {

    /** Máximo de fotos por entidad, decidido en el diseño. */
    public static final int MAX_FOTOS = 5;

    private final PedidoRepository pedidoRepository;
    private final FotoRepository fotoRepository;

    public PedidoService(PedidoRepository pedidoRepository, FotoRepository fotoRepository) {
        this.pedidoRepository = pedidoRepository;
        this.fotoRepository = fotoRepository;
    }

    public PedidoResponse crear(PedidoRequest datos) {
        Pedido pedido = new Pedido(datos.trabajador(), datos.cliente(), datos.descripcion());
        pedidoRepository.save(pedido);
        return aRespuesta(pedido);
    }

    @Transactional(readOnly = true)
    public List<PedidoResponse> listar() {
        return pedidoRepository.findAll().stream().map(this::aRespuesta).toList();
    }

    @Transactional(readOnly = true)
    public PedidoResponse obtener(Long id) {
        return aRespuesta(buscarOFallar(id));
    }

    /** Edición parcial: solo se tocan los campos que vienen informados. Solo jefe. */
    public PedidoResponse editar(Long id, PedidoPatch cambios) {
        Pedido pedido = buscarOFallar(id);
        if (cambios.trabajador() != null)
            pedido.setTrabajador(exigirNoVacio(cambios.trabajador(), "trabajador"));
        if (cambios.cliente() != null)
            pedido.setCliente(exigirNoVacio(cambios.cliente(), "cliente"));
        if (cambios.descripcion() != null)
            pedido.setDescripcion(exigirNoVacio(cambios.descripcion(), "descripción"));
        return aRespuesta(pedido);
    }

    /** Borrado (solo jefe). Elimina también sus fotos. */
    public void borrar(Long id) {
        Pedido pedido = buscarOFallar(id);
        fotoRepository.deleteByOrigenTipoAndOrigenId(Foto.OrigenTipo.PEDIDO, pedido.getId());
        pedidoRepository.delete(pedido);
    }

    // ---------- Fotos ----------

    public List<Long> subirFotos(Long id, List<MultipartFile> ficheros) {
        Pedido pedido = buscarOFallar(id);
        ValidadorImagen.exigirAlgunFichero(ficheros);

        long existentes = fotoRepository.countByOrigenTipoAndOrigenId(
                Foto.OrigenTipo.PEDIDO, pedido.getId());
        if (existentes + ficheros.size() > MAX_FOTOS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Máximo " + MAX_FOTOS + " fotos por pedido (ya tiene " + existentes + ")");
        }

        for (MultipartFile fichero : ficheros) {
            ValidadorImagen.Imagen imagen = ValidadorImagen.validar(fichero, "foto");
            fotoRepository.save(new Foto(Foto.OrigenTipo.PEDIDO, pedido.getId(),
                    imagen.tipoContenido(), imagen.datos()));
        }
        return idsDeFotos(pedido.getId());
    }

    @Transactional(readOnly = true)
    public Foto obtenerFoto(Long pedidoId, Long fotoId) {
        buscarOFallar(pedidoId);
        return fotoRepository.findByIdAndOrigenTipoAndOrigenId(
                        fotoId, Foto.OrigenTipo.PEDIDO, pedidoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Ese pedido no tiene esa foto"));
    }

    public void borrarFoto(Long pedidoId, Long fotoId) {
        Foto foto = obtenerFoto(pedidoId, fotoId);
        fotoRepository.delete(foto);
    }

    // ---------- auxiliares ----------

    private Pedido buscarOFallar(Long id) {
        return pedidoRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No existe el pedido " + id));
    }

    /**
     * Un PATCH solo ignora los campos ausentes (null). Sin esta comprobación,
     * enviar "" o "   " vaciaba un campo obligatorio del pedido, que nace ya
     * finalizado y por tanto siempre debe estar completo.
     */
    private String exigirNoVacio(String valor, String campo) {
        if (valor.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El campo '" + campo + "' no puede quedar vacío");
        }
        return valor.trim();
    }

    private List<Long> idsDeFotos(Long pedidoId) {
        return fotoRepository.idsPorOrigen(Foto.OrigenTipo.PEDIDO, pedidoId);
    }

    private PedidoResponse aRespuesta(Pedido p) {
        return new PedidoResponse(p.getId(), p.getFecha(), p.getTrabajador(),
                p.getCliente(), p.getDescripcion(), idsDeFotos(p.getId()));
    }
}
