import { MaterialLinea } from '../nucleo/modelos';
import { redondear } from '../nucleo/numeros';

/**
 * Materiales más mano de obra, mientras el jefe teclea los precios.
 *
 * Repite la misma aritmética que el servidor (RespuestaAlbaran), redondeo por
 * línea incluido, para que vea el total al momento. Manda el del servidor: al
 * guardar, el albarán se recarga con el suyo.
 */
export function costeSumado(
  materiales: MaterialLinea[],
  horas: number | null,
  precioHora: number | null,
): number {
  const lineas = materiales.reduce((suma, linea) => {
    if (linea.cantidad === null || linea.precio === null || linea.precio === undefined) {
      return suma;
    }
    return suma + redondear(linea.cantidad * linea.precio);
  }, 0);
  const mano = horas !== null && precioHora !== null ? redondear(horas * precioHora) : 0;
  return redondear(lineas + mano);
}
