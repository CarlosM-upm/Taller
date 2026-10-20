import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Albaran,
  AlbaranCambios,
  AlbaranNuevo,
  AlbaranUnificado,
  Cliente,
  DatosMaterialCatalogo,
  EstadoTrabajo,
  FamiliaMaterial,
  MaterialCatalogo,
  MaterialCatalogoConPrecio,
  Pedido,
  PedidoCambios,
  PedidoNuevo,
  ProximoNumero,
  RespuestaLogin,
  Trabajador,
  Trabajo,
  TrabajoDatos,
} from './modelos';

/**
 * Único punto de contacto con el backend.
 *
 * Las rutas son relativas ("/api/..."), nunca absolutas con host y puerto.
 * En desarrollo el proxy de Angular las reenvía al 8080; en el taller la PWA
 * se sirve desde el propio Spring Boot, así que es el mismo origen y funciona
 * igual sin tocar nada. Poner aquí una IP fija obligaría a recompilar el
 * cliente si algún día cambia el servidor.
 */
@Injectable({ providedIn: 'root' })
export class ApiTaller {
  private readonly http = inject(HttpClient);

  // --- Sesión --------------------------------------------------------------

  entrar(usuario: string, contrasena: string): Observable<RespuestaLogin> {
    return this.http.post<RespuestaLogin>('/api/login', { usuario, contrasena });
  }

  salir(): Observable<void> {
    return this.http.post<void>('/api/logout', {});
  }

  cambiarContrasena(actual: string, nueva: string): Observable<void> {
    return this.http.put<void>('/api/password', { actual, nueva });
  }

  // --- Clientes y trabajadores ---------------------------------------------
  //
  // Consultarlos lo pueden hacer los dos roles: la tablet los necesita para
  // poblar los desplegables. Crearlos, renombrarlos y borrarlos es solo del
  // jefe, y el backend lo rechaza con 403 si lo intenta la tablet.

  clientes(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>('/api/clientes');
  }

  crearCliente(nombre: string): Observable<Cliente> {
    return this.http.post<Cliente>('/api/clientes', { nombre });
  }

  /** Renombrar afecta a todos sus pedidos, trabajos y albaranes. */
  renombrarCliente(id: number, nombre: string): Observable<Cliente> {
    return this.http.put<Cliente>(`/api/clientes/${id}`, { nombre });
  }

  /** Falla con 409 si el cliente tiene documentos. */
  borrarCliente(id: number): Observable<void> {
    return this.http.delete<void>(`/api/clientes/${id}`);
  }

  trabajadores(): Observable<Trabajador[]> {
    return this.http.get<Trabajador[]>('/api/trabajadores');
  }

  crearTrabajador(nombre: string): Observable<Trabajador> {
    return this.http.post<Trabajador>('/api/trabajadores', { nombre });
  }

  renombrarTrabajador(id: number, nombre: string): Observable<Trabajador> {
    return this.http.put<Trabajador>(`/api/trabajadores/${id}`, { nombre });
  }

  borrarTrabajador(id: number): Observable<void> {
    return this.http.delete<void>(`/api/trabajadores/${id}`);
  }

  // --- Catálogo de materiales -----------------------------------------------
  //
  // La tablet lee el catálogo SIN precios; la lista con precios y cualquier
  // cambio son del jefe (el backend responde 403 al trabajador).

  familiasMaterial(): Observable<FamiliaMaterial[]> {
    return this.http.get<FamiliaMaterial[]>('/api/familias-material');
  }

  crearFamiliaMaterial(nombre: string): Observable<FamiliaMaterial> {
    return this.http.post<FamiliaMaterial>('/api/familias-material', { nombre });
  }

  renombrarFamiliaMaterial(id: number, nombre: string): Observable<FamiliaMaterial> {
    return this.http.put<FamiliaMaterial>(`/api/familias-material/${id}`, { nombre });
  }

  /** Falla con 409 si la familia tiene materiales. */
  borrarFamiliaMaterial(id: number): Observable<void> {
    return this.http.delete<void>(`/api/familias-material/${id}`);
  }

  catalogo(): Observable<MaterialCatalogo[]> {
    return this.http.get<MaterialCatalogo[]>('/api/catalogo');
  }

  /** Solo jefe. */
  catalogoConPrecios(): Observable<MaterialCatalogoConPrecio[]> {
    return this.http.get<MaterialCatalogoConPrecio[]>('/api/catalogo/precios');
  }

  crearMaterialCatalogo(datos: DatosMaterialCatalogo): Observable<MaterialCatalogoConPrecio> {
    return this.http.post<MaterialCatalogoConPrecio>('/api/catalogo', datos);
  }

  editarMaterialCatalogo(id: number, datos: DatosMaterialCatalogo): Observable<MaterialCatalogoConPrecio> {
    return this.http.put<MaterialCatalogoConPrecio>(`/api/catalogo/${id}`, datos);
  }

  /** Se permite aunque se haya usado: los documentos guardan su propia copia. */
  borrarMaterialCatalogo(id: number): Observable<void> {
    return this.http.delete<void>(`/api/catalogo/${id}`);
  }

  // --- Pedidos -------------------------------------------------------------

  pedidos(): Observable<Pedido[]> {
    return this.http.get<Pedido[]>('/api/pedidos');
  }

  pedido(id: number): Observable<Pedido> {
    return this.http.get<Pedido>(`/api/pedidos/${id}`);
  }

  crearPedido(datos: PedidoNuevo): Observable<Pedido> {
    return this.http.post<Pedido>('/api/pedidos', datos);
  }

  /** Solo jefe. */
  editarPedido(id: number, cambios: PedidoCambios): Observable<Pedido> {
    return this.http.patch<Pedido>(`/api/pedidos/${id}`, cambios);
  }

  /** Solo jefe. */
  borrarPedido(id: number): Observable<void> {
    return this.http.delete<void>(`/api/pedidos/${id}`);
  }

  subirFotosPedido(id: number, fotos: Blob[]): Observable<number[]> {
    return this.http.post<number[]>(`/api/pedidos/${id}/fotos`, cuerpoFotos(fotos));
  }

  /** Solo jefe: el pedido nace finalizado, así que sus fotos son cosa suya. */
  borrarFotoPedido(id: number, fotoId: number): Observable<void> {
    return this.http.delete<void>(`/api/pedidos/${id}/fotos/${fotoId}`);
  }

  urlFotoPedido(id: number, fotoId: number): string {
    return `/api/pedidos/${id}/fotos/${fotoId}`;
  }

  /** Solo jefe. Se descarga con el servicio Descargas, que sí manda el token. */
  urlPdfPedido(id: number): string {
    return `/api/pedidos/${id}/pdf`;
  }

  // --- Trabajos ------------------------------------------------------------

  trabajos(estado?: EstadoTrabajo, clienteId?: number | null): Observable<Trabajo[]> {
    const partes: string[] = [];
    if (estado) partes.push(`estado=${estado.toLowerCase()}`);
    if (clienteId) partes.push(`clienteId=${clienteId}`);
    const filtro = partes.length ? `?${partes.join('&')}` : '';
    return this.http.get<Trabajo[]>(`/api/trabajos${filtro}`);
  }

  trabajo(id: number): Observable<Trabajo> {
    return this.http.get<Trabajo>(`/api/trabajos/${id}`);
  }

  crearTrabajo(datos: TrabajoDatos): Observable<Trabajo> {
    return this.http.post<Trabajo>('/api/trabajos', datos);
  }

  /** Si el trabajo ya está enviado, el backend exige rol JEFE. */
  editarTrabajo(id: number, datos: TrabajoDatos): Observable<Trabajo> {
    return this.http.patch<Trabajo>(`/api/trabajos/${id}`, datos);
  }

  /** Valida que esté completo; si falta algo, responde 400 diciendo qué. */
  enviarTrabajo(id: number): Observable<Trabajo> {
    return this.http.post<Trabajo>(`/api/trabajos/${id}/enviar`, {});
  }

  borrarTrabajo(id: number): Observable<void> {
    return this.http.delete<void>(`/api/trabajos/${id}`);
  }

  subirFotosTrabajo(id: number, fotos: Blob[]): Observable<number[]> {
    return this.http.post<number[]>(`/api/trabajos/${id}/fotos`, cuerpoFotos(fotos));
  }

  borrarFotoTrabajo(id: number, fotoId: number): Observable<void> {
    return this.http.delete<void>(`/api/trabajos/${id}/fotos/${fotoId}`);
  }

  urlFotoTrabajo(id: number, fotoId: number): string {
    return `/api/trabajos/${id}/fotos/${fotoId}`;
  }

  /**
   * Firma del cliente en la obra. La tablet puede firmar un borrador, y un
   * enviado si aún no tiene firma; sustituirla en un enviado es del jefe.
   */
  guardarFirmaTrabajo(id: number, firma: Blob): Observable<Trabajo> {
    const cuerpo = new FormData();
    cuerpo.append('firma', firma, 'firma.png');
    return this.http.put<Trabajo>(`/api/trabajos/${id}/firma`, cuerpo);
  }

  borrarFirmaTrabajo(id: number): Observable<Trabajo> {
    return this.http.delete<Trabajo>(`/api/trabajos/${id}/firma`);
  }

  urlFirmaTrabajo(id: number): string {
    return `/api/trabajos/${id}/firma`;
  }

  /** Solo jefe. */
  urlPdfTrabajo(id: number): string {
    return `/api/trabajos/${id}/pdf`;
  }

  // --- Albaranes (solo jefe) -----------------------------------------------

  albaranes(): Observable<Albaran[]> {
    return this.http.get<Albaran[]>('/api/albaranes');
  }

  albaran(id: number): Observable<Albaran> {
    return this.http.get<Albaran>(`/api/albaranes/${id}`);
  }

  /** Nace siempre de un trabajo ENVIADO, nunca desde cero. */
  crearAlbaranDesdeTrabajo(trabajoId: number, datos: AlbaranNuevo): Observable<Albaran> {
    return this.http.post<Albaran>(`/api/trabajos/${trabajoId}/albaran`, datos);
  }

  /**
   * Varios trabajos del mismo cliente en un solo albarán.
   *
   * Cuelga de /api/albaranes y no de un trabajo porque no nace de ninguno en
   * concreto: nace de una selección.
   */
  crearAlbaranUnificado(datos: AlbaranUnificado): Observable<Albaran> {
    return this.http.post<Albaran>('/api/albaranes/unificado', datos);
  }

  editarAlbaran(id: number, cambios: AlbaranCambios): Observable<Albaran> {
    return this.http.patch<Albaran>(`/api/albaranes/${id}`, cambios);
  }

  borrarAlbaran(id: number): Observable<void> {
    return this.http.delete<void>(`/api/albaranes/${id}`);
  }

  guardarFirma(id: number, firma: Blob): Observable<Albaran> {
    const cuerpo = new FormData();
    cuerpo.append('firma', firma, 'firma.png');
    return this.http.put<Albaran>(`/api/albaranes/${id}/firma`, cuerpo);
  }

  urlFirma(id: number): string {
    return `/api/albaranes/${id}/firma`;
  }

  subirFotosAlbaran(id: number, fotos: Blob[]): Observable<number[]> {
    return this.http.post<number[]>(`/api/albaranes/${id}/fotos`, cuerpoFotos(fotos));
  }

  borrarFotoAlbaran(id: number, fotoId: number): Observable<void> {
    return this.http.delete<void>(`/api/albaranes/${id}/fotos/${fotoId}`);
  }

  urlFotoAlbaran(id: number, fotoId: number): string {
    return `/api/albaranes/${id}/fotos/${fotoId}`;
  }

  /** El documento que se imprime y se archiva. */
  urlPdfAlbaran(id: number): string {
    return `/api/albaranes/${id}/pdf`;
  }

  // --- Configuración (solo jefe) -------------------------------------------

  proximoNumeroAlbaran(): Observable<ProximoNumero> {
    return this.http.get<ProximoNumero>('/api/config/proximo-numero-albaran');
  }

  cambiarProximoNumeroAlbaran(numero: number): Observable<ProximoNumero> {
    return this.http.put<ProximoNumero>('/api/config/proximo-numero-albaran', {
      proximoNumeroAlbaran: numero,
    });
  }
}

/**
 * El backend espera un multipart con el campo repetido "fotos".
 * No se fija el Content-Type a mano: el navegador tiene que añadir el
 * "boundary" al enviar FormData, y ponerlo nosotros rompería la subida.
 */
function cuerpoFotos(fotos: Blob[]): FormData {
  const cuerpo = new FormData();
  fotos.forEach((foto, i) => cuerpo.append('fotos', foto, `foto-${i + 1}.jpg`));
  return cuerpo;
}
