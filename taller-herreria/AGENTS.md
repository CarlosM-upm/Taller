# AGENTS.md — Taller de Herrería

Contexto del proyecto para agentes de IA que trabajen sobre este repositorio.
Léelo entero antes de proponer cambios: contiene decisiones de diseño ya cerradas
que **no deben revertirse sin preguntar**.

---

## 1. Qué es este proyecto

Aplicación de gestión para un **taller de herrería de tres trabajadores más el jefe**.
Registra tres cosas: **pedidos** que llegan, **trabajos realizados** y **albaranes**.

Arquitectura: **API REST** con toda la lógica de negocio en el servidor y el cliente
separado (una PWA en Angular, en la carpeta hermana `taller-pwa/`, que se empaqueta
dentro del jar del backend — ver §7).

### Entorno de despliegue (condiciona muchas decisiones)

- El servidor es un **mini-PC físico dentro del taller**. No hay nube.
- **Se enciende solo al dar corriente** por la mañana ("cuando se encienden los plomos"):
  BIOS configurada con *Restore on AC Power Loss = Power On*, y los servicios se lanzan
  solos al arrancar.
- Tablet y servidor se comunican por la **red local**. El taller **sí tiene línea de
  internet** en el router (se usa para instalar y actualizar el servidor), pero la
  aplicación **no depende de ella para nada**: si la línea se cae, el taller sigue
  trabajando igual. Mantenlo así.
- **Se apaga cada día** al bajar los plomos, y por eso las sesiones de usuario se guardan
  en base de datos (ver §5): así nadie tiene que volver a identificarse cada mañana.
- **No hay SAI ni copias de seguridad automáticas.** Es una decisión del dueño del
  proyecto, tomada a conciencia; el porqué y sus consecuencias están en §8. La rutina
  acordada para apagar es **pulsar el botón del mini-PC y esperar** a que se apague antes
  de cortar la corriente: una pulsación corta hace un apagado limpio.

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Backend | Java 21 + Spring Boot 3.4 + Maven |
| Base de datos | PostgreSQL 17 en Docker |
| Cliente | PWA en Angular 22 + Angular Material (carpeta `taller-pwa/`) |
| Documentos | PDF: plantilla HTML con Thymeleaf + openhtmltopdf (no Word — ver §8) |
| Servidor | Ubuntu + systemd: base de datos y aplicación (carpeta `infra/`) |

### Particularidades del entorno de desarrollo

- **Maven no está instalado.** Usa siempre el wrapper: `.\mvnw.cmd` en Windows,
  `./mvnw` en Linux/Mac. Nunca sugieras `mvn` a secas.
- **PostgreSQL corre en el puerto 5433**, no en el 5432. La máquina de desarrollo tiene
  un PostgreSQL nativo ocupando el 5432. `docker-compose.yml` mapea `"5433:5432"` y
  `application.yml` apunta al 5433; deben coincidir siempre.
- **La URL de la BD usa `127.0.0.1`, no `localhost`.** En Windows `localhost` resuelve
  primero a `::1` (IPv6), donde hay un relay de WSL escuchando, y la conexión acaba en
  un PostgreSQL que no es el del contenedor. El síntoma es un
  `password authentication failed` desconcertante. No lo cambies a `localhost`.
- La máquina de desarrollo es **Windows**; el destino final es **Linux**.
- Las pruebas manuales de la API se hacen con **Postman**.

### Arranque

Desarrollo, tres cosas a la vez:

```
docker compose up -d          # PostgreSQL (carpeta taller-herreria)
.\mvnw.cmd spring-boot:run    # API en el 8080. NO compila la PWA: arranca al instante
npm start                     # PWA en el 4200 (carpeta taller-pwa)
```

Empaquetar para el taller, un único jar con la PWA dentro:

```
.\mvnw.cmd package            # -> target/herreria-0.0.1-SNAPSHOT.jar
java -jar target\herreria-0.0.1-SNAPSHOT.jar
```

`docker compose down` para parar. **Nunca sugieras `down -v`** sin avisar de forma
explícita: borra el volumen y con él todos los datos.

**Antes de `package`, para `ng serve`.** `npm ci` borra `node_modules` entero, y si el
servidor de desarrollo está en marcha tiene `esbuild.exe` abierto: en Windows eso da un
`EPERM: operation not permitted` que no dice en ningún momento cuál es la causa real.

---

## 3. Estructura del código

Organización **por funcionalidad**, no por capa. Cada entidad tiene su carpeta con todo
lo suyo dentro:

```
src/main/java/com/taller/herreria/
├── HerreriaApplication.java
├── pedido/      Pedido, Repository, Service, Controller, dto/
├── trabajo/     Trabajo, Repository, Service, Controller, dto/
├── albaran/     Albaran, Repository, Service, 2 Controllers, dto/
├── documento/   GeneradorPdf, Documento y RespuestaPdf (los comparten las tres)
├── foto/        Foto, FotoRepository y ValidadorImagen (los comparten las tres)
├── config/      Configuracion: el contador de albaranes
├── comun/       Transversal: manejo de errores, CORS y reenvío de la PWA
└── seguridad/   Usuario, TokenAcceso, filtro, SecurityConfig, AuthService

src/main/resources/db/migration/          Migraciones de Flyway (V1__, V2__…)
src/main/resources/templates/documentos/  Plantillas HTML de los PDF
```

El cliente vive fuera del proyecto Maven, en `Taller/taller-pwa/`:

```
taller-pwa/src/app/
├── nucleo/          sesión, API, interceptores, guardias, fotos, descargas, borrador local
├── comun/           fotos, galería, confirmaciones, lienzo de firma, appSrcSeguro
├── armazon/         barra superior, aviso de sin red y navegación según el rol
├── sesion/          pantalla de login
├── pedidos/         listado, alta y ficha
├── trabajos/        listado con filtro, alta a medias y ficha con envío
├── albaranes/       listado, ficha con firma y generación desde un trabajo
└── configuracion/   contador de albaranes y cambio de contraseña
```

Y fuera de los dos proyectos, en la raíz del repositorio:

```
DESPLIEGUE.md   Guía paso a paso para montarlo en el taller (necesita el hardware)
infra/
└── systemd/    Dos unidades encadenadas: la base de datos y la aplicación
```

Capas y responsabilidades:

- **Controller** — solo traduce HTTP. No lleva lógica de negocio.
- **Service** — todas las reglas de negocio. Es donde va lo importante.
- **Repository** — acceso a datos vía Spring Data JPA.
- **DTOs** — `record` de Java, en el subpaquete `dto/` de cada entidad.
  Las entidades JPA **nunca** se exponen directamente en la API.

### Convenciones

- **El dominio se nombra en castellano** (`Pedido`, `Trabajo`, `Albaran`, `trabajador`,
  `descripcion`, `esBorrador()`). Manténlo. No traduzcas a inglés.
- Los errores se lanzan con `ResponseStatusException` y **mensajes en castellano**
  pensados para que un humano los entienda. `comun/ManejadorErrores` los convierte en
  un JSON uniforme (`RespuestaError`). **Sin ese manejador el mensaje no viaja**: por
  defecto Spring Boot usa `server.error.include-message: never`.
- Las entidades tienen constructor `protected` vacío (requisito de JPA) y setters solo
  para los campos que de verdad son editables.
- Comentarios en castellano, explicando el *porqué* de las reglas de negocio.

### Formato de error de la API

Todas las respuestas de error, incluidas las de seguridad, tienen esta forma:

```json
{
  "momento": "2026-09-07T20:43:00.14",
  "codigo": 400,
  "error": "Bad Request",
  "mensaje": "No se puede enviar: faltan campos por rellenar: cliente, horas",
  "ruta": "/api/trabajos/3/enviar",
  "campos": { "contrasena": "indique la contraseña" }
}
```

`campos` solo aparece cuando el fallo viene de una validación `@Valid`.
Los rechazos por token o permiso **no** pasan por `ManejadorErrores` (ocurren en la
cadena de filtros, antes del controlador): se generan en `SecurityConfig`, que escribe
el mismo formato a mano. Si cambias uno, cambia el otro.

---

## 4. Modelo de datos y reglas de negocio

Estas reglas fueron acordadas explícitamente. **No las cambies por iniciativa propia.**

### Pedido

Campos: `fecha`, `trabajador`, `cliente`, `descripcion`, fotos.

- La **fecha es automática** (la pone el servidor al crear). Columna `updatable = false`:
  no se teclea ni se edita nunca.
- El resto de campos se rellenan a mano y son obligatorios al crear.
- **No tiene relación con Trabajo.** Son entidades sueltas a propósito; el pedido no se
  "convierte" en trabajo. No añadas esa relación.

### Trabajo (trabajo realizado)

Campos: `estado`, `fecha`, `cliente`, `trabajador`, `descripcion`, `materiales`, `horas`, fotos.

- Ciclo **BORRADOR → ENVIADO**. Nace como borrador y **puede guardarse a medias**: al
  crear y al editar un borrador, todos los campos son opcionales. Es el caso de uso
  "empiezo hoy y lo termino otro día".
- **La fecha se estampa solo al enviar**, no al crear. Mientras es borrador, va vacía.
- La **validación de completitud ocurre en el envío**, no antes: `enviar()` comprueba que
  estén cliente, trabajador, descripción, materiales y horas, y si falta algo devuelve la
  lista exacta de lo que falta.
- No se puede enviar dos veces (segundo intento → 409).
- `materiales` es **texto libre**, no una lista estructurada.
- `horas` es **`BigDecimal` con 2 decimales**: decimal exacto, sin errores de redondeo al
  sumar. Acepta enteros (3 → 3.00). **No lo cambies a `double` ni a `float`.**

### Albaran

Campos: `numero`, `fecha`, `cliente`, `dniCliente`, `trabajador`, `descripcion`, `firma`,
`trabajoId`, fotos.

- **Nace siempre de un Trabajo ENVIADO**, nunca desde cero y nunca desde la tablet.
  Endpoint: `POST /api/trabajos/{id}/albaran`.
- Relación **uno a uno**: un trabajo genera como mucho un albarán (restricción única en BD).
- Es una **copia instantánea (snapshot)**, no una referencia viva. Al crearlo se copian
  cliente, trabajador, descripción y **también las fotos** (como fotos propias del albarán).
  Editar el albarán después **no debe afectar al trabajo original**. Esto es deliberado:
  preserva la integridad histórica del documento.
- `dniCliente` solo existe aquí y **lo teclea el jefe** al crearlo.
- La **fecha es elegida** por el jefe (no automática). Si no se indica, se usa la de hoy,
  y sigue siendo editable después.
- `firma` es una imagen (la firma del cliente), guardada en la propia entidad.

### Numeración de albaranes — contador editable

- Serie **única y global** (no reinicia por año).
- Hay una fila única en `configuracion` con `proximoNumeroAlbaran`. Cada albarán nuevo
  toma ese valor y el contador avanza solo.
- El jefe puede **editar el número de un albarán concreto** y **ajustar el próximo número**
  (`PUT /api/config/proximo-numero-albaran`) para reencauzar la serie si algo salió mal.
  Esta capacidad de control manual es intencionada: no la sustituyas por un
  "máximo + 1" automático.
- El número es único a nivel de BD; los choques se detectan y devuelven 409.

### Fotos

- Las tres entidades admiten fotos, **máximo 5 por entidad** (constante `MAX_FOTOS`).
- Se guardan **dentro de PostgreSQL**, no en el sistema de ficheros. Decisión
  deliberada: así una sola copia de seguridad de la BD se lleva absolutamente todo.
- Tabla única `fotos` con `origenTipo` (PEDIDO/TRABAJO/ALBARAN) + `origenId`, con índice
  `idx_foto_origen` sobre ambas columnas.
- Borrar una entidad arrastra sus fotos.
- **Solo se admiten JPEG y PNG**, y se comprueban los **bytes de cabecera**, no la
  cabecera `Content-Type` que declara el cliente (es falsificable, y dejaba pasar
  `image/svg+xml`, que puede llevar scripts). Está centralizado en
  `foto/ValidadorImagen`. **El tipo MIME se deduce del contenido**: si el cliente
  declara `image/png` y envía un JPEG, se guarda y se sirve como `image/jpeg`.
- **Los listados NO deben traer las imágenes.** Usa `FotoRepository.idsPorOrigen(...)`,
  que proyecta solo los identificadores. El lazy en atributos básicos **no funciona**
  sin instrumentación de bytecode, que este proyecto no tiene.

### Cómo se almacenan las imágenes: `bytea`, nunca `@Lob`

`Foto.datos` y `Albaran.firma` son `byte[]` **sin `@Lob` y sin `fetch = LAZY`**, a
propósito. No lo cambies:

- Con `@Lob`, Hibernate mapea `byte[]` a **`oid` (large object)** en PostgreSQL, y
  entonces **borrar la fila no libera la imagen**: queda huérfana en `pg_largeobject`
  y la base de datos crece para siempre. Estaba ocurriendo: se encontraron 5 large
  objects huérfanos con la tabla `fotos` vacía. Ya está migrado a `bytea` y verificado
  (borrar una foto deja `pg_largeobject_metadata` en 0).
- Con `fetch = LAZY` tampoco: no funciona sin el plugin de instrumentación, y si se
  añadiera ese plugin **rompería las descargas** (`GET /api/albaranes/{id}/firma` y las
  tres de foto), porque con `open-in-view: false` el controlador lee los bytes fuera de
  la transacción y saltaría `LazyInitializationException`.

Nota sobre copias de seguridad: un `pg_dump` normal **sí** incluye los large objects
por defecto (comprobado), así que el problema del `oid` nunca fue la copia de
seguridad, sino la fuga de espacio. Con `bytea` las imágenes viajan dentro del `COPY`
de la tabla, y los volcados selectivos (`pg_dump -t fotos`) también las llevan.

**Requisito para la PWA:** las fotos deben **redimensionarse en el cliente** antes de
subirlas (algo así como 1600 px de ancho). Una foto de tablet pesa 4-8 MB; sin reducir,
cinco fotos por trabajo llenan la base de datos del taller en poco tiempo. Se decidió
hacerlo en el cliente y no en el servidor.

---

## 5. Autenticación y permisos

**Dos cuentas, no más.** No hay registro de usuarios ni gestión de altas.

| Cuenta | Rol | Uso |
|---|---|---|
| `tablet` | TRABAJADOR | Compartida por los tres trabajadores, en la tablet |
| `jefe` | JEFE | Ordenador del jefe. Acceso total |

- Contraseñas iniciales `tablet123` / `jefe123`, **provisionales**: hay que cambiarlas con
  `PUT /api/password` al poner el sistema en marcha.
- Hash **BCrypt**. Nunca en claro.
- **Sesión por token guardado en base de datos** (tabla `tokens_acceso`), enviado como
  `Authorization: Bearer <token>`.
  **Por qué en BD y no en memoria:** el servidor del taller se apaga cada noche; así las
  sesiones sobreviven al reinicio y nadie tiene que volver a hacer login cada mañana.
  **No lo cambies a sesiones en memoria ni a JWT sin estado.**
- La sesión **no caduca**; dura hasta que se hace logout explícito. Es intencionado: se
  busca la mínima fricción posible en el taller.
- **No hay trazabilidad de quién hizo qué.** Es una decisión consciente (son tres personas
  y no la necesitan). No añadas campos de auditoría tipo `creadoPor` sin preguntar.

### Reparto de permisos

Solo JEFE:
- Todo lo de albaranes, incluida su creación desde un trabajo.
- La configuración del contador (`/api/config/**`).
- Editar y borrar pedidos (PATCH y DELETE sobre `/api/pedidos/**`).
- Los documentos PDF de las tres entidades. Los de albarán ya entran por la
  regla de `/api/albaranes/**`; los de pedido y trabajo están nombrados aparte
  en `SecurityConfig` porque el resto de esas rutas sí las ve el trabajador.

Ambos roles:
- Crear y consultar pedidos.
- Todo el ciclo de trabajos: crear, editar borradores, enviar, descartar borradores.

**Regla de edición por estado (importante):** en cuanto una entidad se finaliza y se envía,
pasa a ser territorio del jefe.
- Pedido: nace ya finalizado → el trabajador lo crea, pero editarlo es cosa del jefe.
  Eso incluye **borrar sus fotos**: el pedido no tiene estado borrador, así que si el
  trabajador sube una foto movida tiene que pedírselo al jefe. Es intencionado.
- Trabajo BORRADOR: el trabajador lo edita libremente.
- Trabajo ENVIADO: solo el jefe puede editarlo, borrarlo o tocar sus fotos.

**Regla de campos vacíos en los PATCH:** un PATCH solo ignora los campos ausentes
(`null`), así que había que decidir qué hacer con `""` o `"   "`.
- **Trabajo BORRADOR**: la cadena en blanco se guarda como `null`. Vaciar un campo a
  medio rellenar es legítimo, y así `camposQueFaltan()` lo detecta al enviar.
- **Trabajo ENVIADO, Pedido y Albarán**: se rechaza con 400. Son documentos ya cerrados
  y no pueden quedar incompletos. (El `dniCliente` del albarán sí admite vacío: es
  opcional.)

Esta última regla **no se puede expresar solo con la URL** (depende del estado del objeto),
por eso vive en `TrabajoService.exigirJefeSiEnviado()` y no en `SecurityConfig`. Si añades
operaciones nuevas sobre trabajos, aplícala también.

---

## 6. API

Raíz `/api`. Convenciones: `PATCH` para ediciones parciales (solo se tocan los campos
informados), sub-recursos para fotos, y operaciones de negocio como endpoints propios
cuando tienen reglas asociadas (p. ej. `enviar`, en vez de un PATCH del campo estado).

```
POST   /api/login                     abierto
POST   /api/logout
PUT    /api/password

POST   /api/pedidos                   crear (fecha automática)
GET    /api/pedidos
GET    /api/pedidos/{id}
GET    /api/pedidos/{id}/pdf          JEFE
PATCH  /api/pedidos/{id}              JEFE
DELETE /api/pedidos/{id}              JEFE
POST   /api/pedidos/{id}/fotos        multipart, campo "fotos", máx 5
GET    /api/pedidos/{id}/fotos/{fid}
DELETE /api/pedidos/{id}/fotos/{fid}  JEFE

POST   /api/trabajos                  crear borrador (campos opcionales)
GET    /api/trabajos?estado=borrador|enviado
GET    /api/trabajos/{id}
GET    /api/trabajos/{id}/pdf         JEFE
PATCH  /api/trabajos/{id}             enviado → solo JEFE
POST   /api/trabajos/{id}/enviar      valida completitud + estampa fecha
DELETE /api/trabajos/{id}             enviado → solo JEFE
POST   /api/trabajos/{id}/fotos
GET    /api/trabajos/{id}/fotos/{fid}
DELETE /api/trabajos/{id}/fotos/{fid}

POST   /api/trabajos/{id}/albaran     JEFE — crea el albarán desde el trabajo
GET    /api/albaranes                 JEFE
GET    /api/albaranes/{id}            JEFE
GET    /api/albaranes/{id}/pdf        JEFE — el documento que se imprime
PATCH  /api/albaranes/{id}            JEFE — incluido el número
DELETE /api/albaranes/{id}            JEFE
PUT    /api/albaranes/{id}/firma      JEFE — multipart, campo "firma"
GET    /api/albaranes/{id}/firma      JEFE
POST   /api/albaranes/{id}/fotos      JEFE
GET    /api/albaranes/{id}/fotos/{fid}  JEFE
DELETE /api/albaranes/{id}/fotos/{fid}  JEFE

GET    /api/config/proximo-numero-albaran   JEFE
PUT    /api/config/proximo-numero-albaran   JEFE
```

---

## 7. La PWA (`taller-pwa/`)

Angular 22 con Material, componentes standalone, **signals** y **zoneless** (sin
zone.js). Sin NgRx: para esta aplicación sería sobreingeniería.

### Cómo llega al taller

Se empaqueta **dentro del jar de Spring Boot** y se sirve desde el propio backend.
Un solo servicio en el mini-PC, sin nginx que mantener en una máquina sin pantalla.
La tablet y el equipo del jefe abren `http://<ip-fija>:8080`.

**Matiz importante, descubierto al preparar el despliegue:** por `http://` a una IP
**no se puede instalar como PWA de verdad ni se registra el service worker**. Los
navegadores solo tratan como origen seguro `localhost` y `https://`. La aplicación
funciona entera (pedidos, trabajos, albaranes, fotos y firma); lo que no hay es
instalación real ni caché de la aplicación, así que en la tablet se usa "Añadir a
pantalla de inicio". Para tenerlas haría falta un certificado propio para la IP fija
instalado en los dos aparatos. Está explicado en `DESPLIEGUE.md` §10.

Consecuencia: en producción cliente y API comparten origen, así que **el CORS de
`comun/ConfiguracionCors` no llega a usarse**. En desarrollo tampoco, porque
`ng serve` usa el proxy de `proxy.conf.json`. Se mantiene como red de seguridad por
si algún día se sirve la PWA desde otro sitio, pero no es una pieza activa.

`comun/ReenvioPwa` devuelve `index.html` para cualquier ruta que no sea un fichero
real ni empiece por `api/`. Sin eso, recargar (F5) estando en `/trabajos/5` daría 404,
igual que abrir un favorito o reabrir la PWA instalada.

### Reglas que no se deben romper

- **Las imágenes protegidas se cargan con la directiva `appSrcSeguro`, nunca con un
  `<img src>` normal.** El navegador pide las imágenes por su cuenta, al margen de
  HttpClient, así que **no manda la cabecera del token** y el servidor responde 401:
  ni fotos ni firmas llegaban a verse, y encima ese 401 echaba al usuario al login.
  La directiva las pide con HttpClient y las pinta como URL de objeto. Pasó, y lo
  encontró la comprobación de humo.
- **Los PDF se descargan con `nucleo/descargas`, nunca con un enlace directo ni
  `window.open`.** Es el mismo problema que el de las imágenes: el navegador
  pediría el fichero por su cuenta, sin la cabecera del token, y recibiría un
  401 que además echaría al usuario al login. El servicio lo pide con
  HttpClient y lo guarda desde una URL de objeto.
- **Un input obligatorio no se lee en el constructor.** Los `input.required()` de
  signals no tienen valor mientras se construye el componente: el router los inyecta
  después. Leerlos ahí lanza `NG0950`, el componente no llega a crearse y el router
  **aborta la navegación en silencio**. Lo que se ve es que pinchar en una lista no
  hace nada. Usa `ngOnInit`. Pasó con las dos fichas de detalle.
- **En los campos numéricos, `type="text"` con `inputmode="decimal"`, no
  `type="number"`.** Con `number`, Angular emite un número por `ngModelChange` mientras
  el componente trabaja con texto: el valor se veía escrito en pantalla y la aplicación
  seguía creyendo que el campo estaba vacío. Además `inputmode` abre igual el teclado
  numérico en la tablet y permite escribir "2,5" con coma, que es como se teclea aquí.
- **El lienzo de firma necesita `touch-action: none`.** Sin eso, arrastrar el dedo hace
  scroll en la página en lugar de dibujar y la firma no sale. Y hay que dimensionarlo
  según `devicePixelRatio`, o el trazo se ve borroso en la tablet.
- **Nunca cargues tipografías ni iconos desde Google Fonts.** El taller tiene internet,
  pero la aplicación no debe depender de él: el día que se caiga la línea los iconos
  aparecerían como palabras sueltas ("delete", "photo_camera") y la tablet quedaría
  inservible con el servidor a dos metros y funcionando perfectamente.
  Roboto y los iconos van desde `node_modules`, declarados en `angular.json`.
  El `ng new` los pone en el CDN por defecto; ya se han quitado.
- **Las rutas de la API son relativas** (`/api/...`), nunca con host y puerto. Así el
  mismo código vale para el proxy de desarrollo y para el mismo origen en producción.
  Poner una IP obligaría a recompilar el cliente si cambia el servidor.
- **El service worker no cachea `/api`.** Es deliberado: en un taller, enseñar el
  listado de ayer como si fuera el de hoy hace más daño que un aviso de "sin conexión".
  Solo se cachea la aplicación, para que abra sin red.
- **Las fotos se reducen en el cliente** antes de subirlas (`nucleo/fotos.ts`): 1600 px
  de lado mayor y JPEG 0,8, de 4-8 MB a 300-500 KB. Y se corrige la orientación EXIF con
  `createImageBitmap(..., { imageOrientation: 'from-image' })`, o las fotos hechas en
  vertical se ven tumbadas.
- **Los guardias de ruta no son seguridad**, solo evitan enseñar pantallas inútiles.
  Quien manda es el backend, que responde 403 aunque se manipule el navegador. Nunca
  muevas una regla de permisos al cliente quitándola de `SecurityConfig`.
- Navegación **abajo**: es lo que alcanza el pulgar sujetando una tablet. Objetivos
  táctiles de 48-64 px, pensados para manos con guantes. No bajes la densidad de
  Material a valores negativos.

### Detalles del entorno que hacen perder tiempo

- **`ng serve` escucha solo en `::1`.** Desde el propio portátil hay que usar
  `localhost:4200`, no `127.0.0.1:4200`. Para probar desde la tablet:
  `npm start -- --host 0.0.0.0`.
- La versión de Node está fijada en el `pom.xml` (`node.version`). El plugin descarga
  esa misma versión al compilar, así el jar no depende de lo que cada uno tenga
  instalado. El mini-PC **no necesita Node**: recibe el jar ya montado.

### Comprobación de humo en navegador

```
npm run humo        # en taller-pwa, con la API arrancada en el 8080
```

`e2e/humo.spec.ts` abre la aplicación en el Chrome instalado (no descarga navegadores),
entra, recorre las pantallas creando y borrando sus propios datos, y **falla si aparece
cualquier error en la consola del navegador o cualquier excepción sin capturar**. Son 9
comprobaciones: permisos por rol, pedidos, trabajos, el circuito completo hasta la firma
del albarán, subida y descarga de fotos, el contador de albaranes y la descarga de los
tres PDF (mirando que los primeros bytes sean `%PDF-`, porque un cuerpo de error
guardado con nombre .pdf también "se descarga").

Ojo: cada ejecución consume dos números de la serie de albaranes. El contador solo
avanza, y los albaranes de prueba se borran pero su número no se devuelve. Es
inofensivo en desarrollo; si molesta, se reencauza desde Ajustes.

Existe por un motivo concreto, y conviene recordarlo: las tres primeras pantallas se
dieron por buenas con decenas de comprobaciones contra la API con curl, y aun así tenían
fallos que dejaban pantallas en blanco, campos que no se recogían y fotos que nunca se
veían. **Probar la API no es probar la aplicación.** Si tocas la PWA, pasa esto antes de
darlo por hecho.

Las imágenes se comprueban con `naturalWidth`, no con `toBeVisible()`: un `<img>` con la
fuente rota sigue estando visible y pasaría por bueno.

Los botones se localizan por su `aria-label` exacto, no por el texto visible ("Borrar"):
en cuanto hay fotos en pantalla conviven varios botones "Borrar" (el general, el de cada
foto, el del diálogo de confirmación) y un selector por texto se vuelve ambiguo. Con eso,
el ayudante `borrarYConfirmar()` daba por bueno un borrado que en realidad no había
ocurrido — un falso positivo silencioso, justo lo que esta comprobación existe para evitar.

Los datos de prueba llevan la hora en el nombre y se borran al terminar. Si una ejecución
falla a mitad puede dejar algo: se reconoce porque el cliente empieza por `PRUEBA-HUMO`.

---

## 8. Trabajo pendiente

### Ya hecho (Fase 0 — cimientos, Fase 1 — imágenes, Fase 2 — seguridad probada)

Verificado arrancando la aplicación contra PostgreSQL real:

- `comun/ManejadorErrores` + `RespuestaError`: los mensajes en castellano por fin llegan
  al cliente, con formato uniforme.
- Peticiones sin token devuelven **401** (antes 403, por el `Http403ForbiddenEntryPoint`
  que Spring Security usa cuando no se registra un `AuthenticationEntryPoint`).
- **CORS** configurado en `comun/ConfiguracionCors`, orígenes en `taller.cors.origenes`.
- Proyección `idsPorOrigen` + índice `idx_foto_origen`: los listados ya no cargan las
  imágenes en memoria.
- Registro en fichero rotativo (`logs/herreria.log`, 30 días).
- `@Valid` en login y cambio de contraseña: los cuerpos incompletos dan 400, no 500.
- Puerto y host de la BD corregidos (5433 y `127.0.0.1`).
- **Imágenes migradas de `oid` a `bytea`** y fuga de large objects cerrada (verificado:
  borrar una foto deja `pg_largeobject_metadata` en 0).
- **`foto/ValidadorImagen`**: solo JPEG y PNG, comprobando bytes de cabecera, con el
  tipo MIME deducido del contenido. Sustituye a 4 copias de la misma comprobación.
- **Capa de seguridad probada de punta a punta: 35 comprobaciones, 35 correctas.**
  La matriz de permisos se comporta exactamente como dice §5. Además, verificado que
  **la sesión sobrevive al reinicio de la API** (se para, se arranca y el mismo token
  sigue valiendo) y que el logout explícito sí la invalida. Es la razón de guardar los
  tokens en base de datos, y funciona.
- **Andamiaje de la PWA**: login real contra la API, armazón con navegación por rol,
  núcleo completo (sesión, cliente de API con los 32 endpoints, interceptores de token
  y de errores, guardias, servicio de fotos) y listado de pedidos. Empaquetado dentro
  del jar y verificado ejecutándolo: 14 comprobaciones, 14 correctas.
- **Pedidos, completos en la PWA**: listado, alta con fotos, ficha, edición y borrado
  para el jefe, y borrado de fotos sueltas. Con componentes reutilizables en `comun/`
  (selector de fotos, galería con visor y diálogo de confirmación) que servirán igual
  para trabajos y albaranes. Verificado contra la API real: 19 comprobaciones.
- **Trabajos, completos en la PWA**: listado con filtro borrador/enviado, alta que
  admite guardar solo con lo que haya, ficha con guardado parcial, aviso de qué falta
  para poder enviar, envío con confirmación, fotos y borrado. La regla "enviado = solo
  el jefe" se refleja en la pantalla. Verificado: 30 comprobaciones.
- **Albaranes, completos en la PWA**: listado, ficha con edición del número y la fecha,
  DNI, fotos, borrado, y **firma del cliente en un lienzo**. Se generan desde la ficha
  de un trabajo enviado, que además enlaza al albarán si ya existe.
- **Dos reglas de negocio cerradas**: no se puede borrar un trabajo que ya generó
  albarán (409 diciendo cuál), y cambiar la contraseña **cierra todas las sesiones** de
  ese usuario, incluida la de quien la cambia. El caso que importa es la cuenta
  `tablet`, compartida: si se va un trabajador y se cambia la contraseña, los tres
  tienen que salir de verdad.
- **Ajustes, en la PWA**: el jefe reencauza la numeración de albaranes y cambia su
  contraseña. Al cambiarla se le lleva al login, porque el servidor acaba de cerrar su
  sesión.
- **Capa PWA**: manifiesto en castellano e instalable, `nucleo/borrador-local` que
  guarda en el navegador el formulario de alta de pedido **antes** de enviarlo (si el
  wifi parpadea al guardar, lo tecleado no se pierde y se ofrece recuperarlo), y una
  banda de aviso cuando no hay red.
- **Flyway**, con `V1__esquema_inicial.sql` sacado con `pg_dump` de la base real para no
  dejarse nada. `ddl-auto` pasa de `update` a **`validate`**: el esquema lo manda Flyway
  y Hibernate solo comprueba que concuerda. Verificados los dos caminos: sobre la base
  de desarrollo que ya tenía tablas (baseline, no toca nada) y sobre una base vacía
  (aplica la V1 y la aplicación arranca y funciona).
- **Documentos PDF de las tres entidades, solo JEFE.** Decisión cerrada (llevaba dos
  aplazamientos): **plantilla HTML con Thymeleaf convertida con openhtmltopdf**, y no
  dibujarlo por código. El motivo es de mantenimiento: ajustar un albarán —márgenes,
  el logotipo, mover un bloque— es editar `templates/documentos/`, no recompilar Java.
  Llevan las **fotos al final** y, el albarán, la **firma del cliente**. La cabecera
  con los datos fiscales del taller sale de `taller.documento` en la configuración.
  Verificado de tres formas: la API devuelve los tres PDF y rechaza al trabajador con
  403; los documentos se han **rasterizado a imagen y mirado uno a uno** (que era el
  motivo de elegir HTML); y la comprobación de humo los descarga desde la interfaz.
  No se empaqueta ninguna tipografía: el CSS pide Helvetica, que es una de las fuentes
  estándar del PDF y cubre acentos y eñes.
  Dos cosas que cuestan tiempo si no se saben:
  **Thymeleaf cachea las plantillas**, así que tocar el HTML o el CSS y volver a pedir
  el PDF devuelve exactamente el mismo fichero: hay que reiniciar la aplicación para
  ver el cambio. Y **el lector de openhtmltopdf es de XML**, no de HTML: un `<img>` o
  un `<br>` sin cerrar no da una página fea, da una excepción al generar.
  Comprobado también el caso de varias páginas (cinco fotos y una descripción larga):
  la rejilla no parte ninguna foto, el pie numera bien ("Página 2 de 2") y los títulos
  llevan `page-break-after: avoid` porque "FOTOGRAFÍAS" se quedaba solo al final de una
  página, con medio folio en blanco y las fotos en la siguiente.
- **Infraestructura del servidor escrita y probada** (`infra/`, y `DESPLIEGUE.md` en la
  raíz):
  - Unidades `systemd` para la base de datos y la aplicación, encadenadas: la de la
    base de datos no se da por arrancada hasta que PostgreSQL **responde de verdad**
    (`pg_isready` en bucle), y la aplicación reintenta cada 10 s. Es el caso de la
    mañana: si la base tarda, nadie tiene que subir a tocar el mini-PC. Probadas en la
    WSL de este portátil, que lleva systemd real.
  - Hubo además **copia diaria a USB con prueba de restauración** (probada de verdad:
    se generaba, se verificaba y restauraba con las fotos dentro) y **configuración de
    NUT para el SAI**. Las dos se **retiraron** al simplificar el despliegue; el porqué
    está más abajo, en *Decisiones cerradas*. Siguen en el historial de git, en el
    commit «Infraestructura del servidor», por si algún día se recuperan.
- **Los secretos ya pueden salir del repositorio**: `docker-compose.yml` lee
  `POSTGRES_PASSWORD` de un `.env` (con `cambiame` como valor por defecto para
  desarrollo), y `application-local.yml.ejemplo` es la plantilla de lo que se rellena
  en el servidor. Ambos destinos están en `.gitignore` (verificado con
  `git check-ignore`).

### Pendiente

**Ya no queda nada que se pueda hacer sin el hardware delante.** Todo lo que falta
está en `DESPLIEGUE.md`, en la raíz del repositorio, paso a paso y con lo que hay que
comprobar en cada punto. En resumen:

1. **Montar el mini-PC**: Ubuntu, Docker y Java, y activar las unidades de
   `infra/systemd/`. El taller **sí tiene internet**, así que allí se descarga todo:
   la configuración con `git clone` y el **jar desde la *release* de GitHub**
   (`releases/latest/download/herreria.jar`). El jar no está en el repositorio
   porque `target/` está en `.gitignore`; se publica como adjunto de la release al
   sacar versión, y ese adjunto **tiene que llamarse exactamente `herreria.jar`**.
2. **IP fija**, fijándola en el propio equipo con netplan (así no depende de tener
   la contraseña del router) o como reserva DHCP. No hay que añadirla a
   `taller.cors.origenes`: la PWA y la API comparten origen en producción.
3. **Las tres contraseñas**: `tablet123`, `jefe123` y la de PostgreSQL (`cambiame`).
   **Las tres están en un repositorio público.** Las dos de usuario se cambian desde
   Ajustes; la de PostgreSQL va en el `.env` del servidor y **hay que ponerla antes
   del primer arranque**: una vez creado el volumen, cambiar la variable ya no cambia
   nada y hace falta un `ALTER USER`.
4. **La BIOS**: *Restore on AC Power Loss* en **Power On** (no *Last State*: si la
   víspera se quedó apagada, con *Last State* seguiría apagada por la mañana). Y probar
   el arranque en frío cortando la corriente de verdad, que es lo que valida el resto.
5. **La tablet**: ergonomía con guantes, fotos con la cámara real (orientación EXIF) y
   la firma con el dedo. Y decidir si basta con el acceso directo o se quiere
   certificado propio para instalarla como PWA de verdad (ver §7).

### Lo único que se puede adelantar sin hardware

Probar con **fotos hechas con un móvil de verdad**, sobre todo la orientación EXIF:
basta con copiar unas cuantas al portátil y subirlas desde el navegador. Las fotos
generadas por código que usa la comprobación de humo no llevan EXIF, así que esa
corrección (`imageOrientation: 'from-image'`) nunca se ha ejercitado con una foto
tomada en vertical.

### Topología

Son **dos equipos separados**. Un mini-PC hace de servidor (sin
pantalla, arranca solo al dar corriente) y el jefe usa otro ordenador distinto que se
conecta por red local. La PWA, por tanto, se sirve a dos clientes: la tablet y el equipo
del jefe.

### Decisiones de negocio ya cerradas

- **Sin SAI y sin copias de seguridad automáticas. Una sola máquina y nada más.**
  Decisión expresa del dueño del proyecto, tomada después de repasar las alternativas
  (disco USB dedicado, copia al ordenador del jefe) y de conocer el riesgo. **No la
  reabras ni propongas copias por iniciativa propia**; si algún día cambia, el código
  retirado está en el historial, en el commit «Infraestructura del servidor».
  - El respaldo documental son los **albaranes en PDF** que el jefe se descarga desde
    la aplicación: cada PDF lleva dentro número, fecha, cliente, DNI, descripción,
    firma y fotos, así que es el documento completo y se abre sin el servidor.
  - Consecuencia asumida: **lo que se borra no se recupera**, y si falla el disco del
    mini-PC se pierde lo que hubiera dentro.
  - Lo que sustituye al SAI es una **rutina, no un aparato**: pulsar el botón del
    mini-PC y esperar a que se apague antes de bajar los plomos. Una pulsación corta
    hace un apagado limpio (`HandlePowerKey=poweroff`, el comportamiento por defecto de
    systemd). Por eso el equipo debe colocarse **con el botón accesible**.
  - Por eso también el disco importa más de lo normal al comprar: sin SAI, el mini-PC
    recibe un corte en seco cada tarde. **NVMe de marca, nunca eMMC ni genéricos sin
    DRAM**, que son los que peor gestionan una pérdida de corriente.
- Borrar un trabajo que ya generó albarán: **bloqueado con 409**, diciendo qué albarán
  es. Un albarán es un documento que el cliente firmó y ese trabajo es su respaldo.
- Cambiar la contraseña **cierra todas las sesiones** del usuario, incluida la de quien
  la cambia.
- El contador de albaranes se lee e incrementa **sin bloqueo pesimista**: dos albaranes
  simultáneos podrían tomar el mismo número. **Decidido dejarlo así**: solo el jefe crea
  albaranes, el botón se deshabilita mientras se envía, y si aun así coincidieran, la
  restricción única de la BD lo rechaza y `ManejadorErrores` lo traduce a un 409 con un
  mensaje claro. Basta con reintentar.
- La tabla `tokens_acceso` **crece indefinidamente** y los tokens se guardan en claro.
  Medido: una tarde de pruebas dejó 8 filas. Con dos cuentas crece despacio y nunca
  baja, pero en tamaño es irrelevante durante décadas. **Decidido no tocarlo**: cifrar
  los tokens taparía un agujero que solo se abre si alguien se lleva el disco del
  servidor, y quien se lo lleve ya tiene todos los datos del negocio.

---

## 9. Cómo trabajar en este repositorio

- **Las decisiones de diseño se confirman antes de implementar.** Es la forma de trabajar
  acordada con el dueño del proyecto: primero se decide, luego se escribe código. Si una
  tarea implica una decisión de diseño no cubierta aquí, **pregunta antes de codificar**.
- Si algo de este documento choca con lo que pide el usuario, **gana el usuario**, pero
  señala la discrepancia antes de aplicarla.
- Replica el patrón existente: `pedido/` y `trabajo/` son las plantillas de referencia para
  cualquier entidad nueva.
- Las validaciones y reglas de negocio van **en el Service**, nunca en el Controller.
- Al terminar un cambio, verifica que compila con `.\mvnw.cmd compile`. **Compilar no
  basta**: el cableado de beans, la validez de las consultas JPQL y la configuración de
  seguridad solo fallan al arrancar. Levanta la aplicación de verdad
  (`.\mvnw.cmd spring-boot:run`) y comprueba al menos que sale
  `Started HerreriaApplication`.
- Cuidado con dos nombres que el framework impone y que no se pueden traducir:
  el bean **debe** llamarse `corsConfigurationSource` (Spring Security lo busca por ese
  nombre literal), y no declares un `@ExceptionHandler` para excepciones que
  `ResponseEntityExceptionHandler` ya trata (p. ej. `MaxUploadSizeExceededException`):
  el arranque falla con "Ambiguous @ExceptionHandler method mapped".
- **`ddl-auto` es `validate`, no `update`. El esquema lo manda Flyway.**
  Si cambias una entidad, la aplicación **fallará al arrancar** hasta que escribas la
  migración correspondiente en `src/main/resources/db/migration/` (`V2__...`, `V3__...`).
  Es a propósito: con `update`, Hibernate iba creando columnas solo, pero **nunca
  cambiaba el tipo de una que ya existía** y no avisaba, así que un cambio de tipo se
  aplicaba en el código y la base de datos se quedaba como estaba.
- **Para `ng serve` antes de `.\mvnw.cmd package`.** `npm ci` borra `node_modules`, y el
  servidor de desarrollo tiene `esbuild.exe` abierto: en Windows da un `EPERM` cuyo
  mensaje no menciona en ningún momento la causa real.
- Si pruebas la API con PowerShell, **no uses `-o $null` en `curl.exe`**: PowerShell
  descarta el argumento, curl se come el siguiente parámetro como nombre de fichero y
  acabas haciendo un GET donde creías hacer un DELETE, con un "204" falso en pantalla.
  Usa una ruta de fichero real. Pasó, y dio por buenos dos borrados que nunca ocurrieron.
- En Windows, **`localhost` resuelve primero a `::1`**. Ha mordido dos veces: con
  PostgreSQL (la conexión acababa en un relay de WSL) y con `ng serve` (que escucha solo
  en `::1`, así que `127.0.0.1:4200` no responde). Ante un "conexión rechazada" o un
  "autenticación fallida" raro, comprueba primero IPv4 contra IPv6.
- No hay tests automatizados del backend todavía. Si añades alguno, que no dependa de un
  PostgreSQL real levantado a mano. La PWA **sí** tiene una comprobación de humo en
  navegador (`npm run humo`, ver §7): pásala antes de dar por buena cualquier pantalla.