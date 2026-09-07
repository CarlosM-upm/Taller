# Taller de Herrería — Cliente (PWA)

Cliente Angular para la tablet del taller y para el ordenador del jefe.
Habla con la API que está en la carpeta hermana `taller-herreria/`.

## Requisitos

- **Node 24 LTS** (la versión exacta está fijada en el `pom.xml` del backend).
- Las dependencias se instalan con `npm install` la primera vez.

## Desarrollo

Hacen falta tres cosas en marcha. Desde `taller-herreria/`:

    docker compose up -d          # base de datos
    .\mvnw.cmd spring-boot:run    # API en el 8080

Y desde esta carpeta:

    npm start                     # PWA en el 4200

Abre **http://localhost:4200**. Ojo: `ng serve` escucha solo en IPv6, así que
`http://127.0.0.1:4200` **no** responde. Usa `localhost`.

Las llamadas a `/api` se reenvían al 8080 con el proxy de `proxy.conf.json`,
así que en desarrollo se trabaja como si todo estuviera en el mismo sitio,
igual que ocurrirá en el taller.

### Probar desde la tablet o el móvil

Por defecto el servidor solo escucha en el propio equipo. Para alcanzarlo
desde otro dispositivo de la misma red:

    npm start -- --host 0.0.0.0

Y entra desde la tablet a `http://<ip-del-portatil>:4200`.

## Cuentas de prueba

| Usuario  | Contraseña  | Rol         |
|----------|-------------|-------------|
| `tablet` | `tablet123` | TRABAJADOR  |
| `jefe`   | `jefe123`   | JEFE        |

Son provisionales: hay que cambiarlas antes de poner el sistema en marcha.

## Compilar para el taller

No se compila esta carpeta por separado. El backend la empaqueta dentro de su
jar. Desde `taller-herreria/`:

    .\mvnw.cmd package

**Antes hay que parar `ng serve`**: el empaquetado borra `node_modules` y el
servidor de desarrollo tiene ficheros abiertos; si no, sale un error `EPERM`
que no explica la causa.

El resultado es un único jar que sirve la API y la PWA a la vez. En el taller
se abre `http://<ip-del-servidor>:8080`.

## Estructura

    src/app/
    ├── nucleo/          sesión, cliente de API, interceptores, guardias, fotos
    ├── armazon/         barra superior y navegación inferior, según el rol
    ├── sesion/          pantalla de login
    ├── pedidos/
    ├── trabajos/
    ├── albaranes/
    └── configuracion/

## Cosas que conviene no romper

- **Nada se carga desde internet.** El taller no tiene conexión: la tipografía
  y los iconos vienen de `node_modules`, declarados en `angular.json`.
- **Las rutas de la API son relativas** (`/api/...`), nunca con host ni puerto.
- **El service worker no cachea `/api`**: mostrar datos de ayer como si fueran
  de hoy confunde más que avisar de que no hay conexión.
- **Las fotos se reducen antes de subirlas** y se corrige su orientación EXIF,
  o las hechas en vertical se ven tumbadas.
