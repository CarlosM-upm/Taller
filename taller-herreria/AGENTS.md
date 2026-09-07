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
- Tablet y servidor se comunican por la **red local**. La aplicación **no depende de
  internet** para nada.
- Se apaga cada día. Por eso hay un **SAI/UPS** previsto para apagados limpios, y por eso
  las sesiones de usuario se guardan en base de datos (ver §5).

---

## 2. Stack

| Capa | Tecnología |
|---|---|
| Backend | Java 21 + Spring Boot 3.4 + Maven |
| Base de datos | PostgreSQL 17 en Docker |
| Cliente | PWA en Angular 22 + Angular Material (carpeta `taller-pwa/`) |
| Documentos | PDF (no Word — ver §8) |

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
├── foto/        Foto y FotoRepository (compartidos por las tres entidades)
├── config/      Configuracion: el contador de albaranes
├── comun/       Transversal: manejo de errores, CORS y reenvío de la PWA
└── seguridad/   Usuario, TokenAcceso, filtro, SecurityConfig, AuthService
```

El cliente vive fuera del proyecto Maven, en `Taller/taller-pwa/`:

```
taller-pwa/src/app/
├── nucleo/          sesión, cliente de API, interceptores, guardias, fotos, avisos
├── comun/           selector de fotos, galería con visor, diálogo de confirmación
├── armazon/         barra superior y navegación inferior, según el rol
├── sesion/          pantalla de login
├── pedidos/         listado, alta y ficha
├── trabajos/        listado con filtro, alta a medias y ficha con envío
├── albaranes/
└── configuracion/
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
- Generar y ver PDFs (cuando existan).

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
PATCH  /api/pedidos/{id}              JEFE
DELETE /api/pedidos/{id}              JEFE
POST   /api/pedidos/{id}/fotos        multipart, campo "fotos", máx 5
GET    /api/pedidos/{id}/fotos/{fid}
DELETE /api/pedidos/{id}/fotos/{fid}  JEFE

POST   /api/trabajos                  crear borrador (campos opcionales)
GET    /api/trabajos?estado=borrador|enviado
GET    /api/trabajos/{id}
PATCH  /api/trabajos/{id}             enviado → solo JEFE
POST   /api/trabajos/{id}/enviar      valida completitud + estampa fecha
DELETE /api/trabajos/{id}             enviado → solo JEFE
POST   /api/trabajos/{id}/fotos
GET    /api/trabajos/{id}/fotos/{fid}
DELETE /api/trabajos/{id}/fotos/{fid}

POST   /api/trabajos/{id}/albaran     JEFE — crea el albarán desde el trabajo
GET    /api/albaranes                 JEFE
GET    /api/albaranes/{id}            JEFE
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
La tablet y el equipo del jefe abren `http://<ip-fija>:8080` e instalan desde ahí.

Consecuencia: en producción cliente y API comparten origen, así que **el CORS de
`comun/ConfiguracionCors` no llega a usarse**. En desarrollo tampoco, porque
`ng serve` usa el proxy de `proxy.conf.json`. Se mantiene como red de seguridad por
si algún día se sirve la PWA desde otro sitio, pero no es una pieza activa.

`comun/ReenvioPwa` devuelve `index.html` para cualquier ruta que no sea un fichero
real ni empiece por `api/`. Sin eso, recargar (F5) estando en `/trabajos/5` daría 404,
igual que abrir un favorito o reabrir la PWA instalada.

### Reglas que no se deben romper

- **Nunca cargues tipografías ni iconos desde Google Fonts.** El taller no tiene
  internet: los iconos aparecerían como palabras sueltas ("delete", "photo_camera").
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

### Pendiente, en orden

1. **Terminar la PWA**, que es el bloque grande:
   - Albaranes: generar desde un trabajo enviado, editar, firma en lienzo y fotos.
   - Configuración: contador de albaranes y cambio de contraseña.
   - Capa PWA: instalable, y no perder los formularios a medio rellenar si parpadea
     el wifi al guardar.
2. **Generación de PDFs** para las tres entidades. Solo JEFE.
   Se decidió **PDF y no Word**: son documentos finales, no editables, que se imprimen y
   archivan; la edición se hace en la aplicación y luego se regenera el documento.
3. **Flyway antes de producción**, mientras la base de datos aún esté casi vacía.
4. **Infraestructura del servidor:**
   - Servicio `systemd` para que API y base de datos arranquen solas al encender.
     Se puede escribir y probar en la WSL del portátil, que es Ubuntu con systemd real.
   - **Copia de seguridad nocturna automática** a un **disco externo USB** dedicado,
     conservando unos 30 días. Un solo disco (se descartó la rotación de dos).
     Conviene probar además que la copia **restaura**, no solo que se genera.
   - Integración con el **SAI**: detectar corte de luz por USB y apagar limpiamente si el
     corte se alarga, con margen para no reaccionar a microcortes.
     **Necesita el aparato**: no se puede probar sin él.
5. **IP fija local** para el servidor, para que la tablet siempre lo encuentre.
   Necesita el mini-PC y el router del taller.
6. **Cambiar las contraseñas** de las dos cuentas y la de PostgreSQL antes de que el
   taller empiece a usarlo de verdad. Que la de producción **no acabe en git**: para eso
   está `application-local.yml`, ya excluido en `.gitignore`.

### Lo que espera a tener el hardware delante

- El SAI, completo.
- La IP fija en el router.
- Ergonomía táctil real (botones con guantes) e instalación de la PWA en Android.
- Arranque en frío desde la BIOS con *Restore on AC Power Loss*.
- Fotos de cámara de verdad, sobre todo la orientación EXIF. Esto último se puede
  adelantar copiando al portátil unas fotos hechas con el móvil.

**Topología decidida:** son **dos equipos separados**. Un mini-PC hace de servidor (sin
pantalla, arranca solo al dar corriente) y el jefe usa otro ordenador distinto que se
conecta por red local. La PWA, por tanto, se sirve a dos clientes: la tablet y el equipo
del jefe.

### Decisiones de negocio aún sin tomar

- Borrar un trabajo que ya tiene albarán deja el albarán **huérfano**: `Albaran.trabajoId`
  es un `Long` sin clave foránea, así que la BD no lo impide. ¿Bloquear con 409?
- El contador de albaranes se lee e incrementa **sin bloqueo pesimista**: dos albaranes
  simultáneos pueden tomar el mismo número. Riesgo bajo con cuatro personas, pero real.
- La tabla `tokens_acceso` **crece indefinidamente** y los tokens se guardan en claro.
  Cambiar la contraseña **no invalida** las sesiones abiertas. Medido: una sola tarde de
  pruebas dejó 8 filas que nada purgará nunca. Con dos cuentas crece despacio, pero
  nunca baja.

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
- **`ddl-auto: update` no cambia el tipo de una columna que ya existe.** Solo añade
  tablas y columnas. Si cambias el tipo de un campo en una entidad, la base de datos de
  desarrollo se queda como estaba y no avisa: hay que migrarla a mano (o esperar a
  Flyway). En el mini-PC no afecta, porque allí la base nace de cero desde las entidades.
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
- No hay tests automatizados todavía. Si añades alguno, que no dependa de un PostgreSQL
  real levantado a mano.