# AGENTS.md — Taller de Herrería

Contexto del proyecto para agentes de IA que trabajen sobre este repositorio.
Léelo entero antes de proponer cambios: contiene decisiones de diseño ya cerradas
que **no deben revertirse sin preguntar**.

---

## 1. Qué es este proyecto

Aplicación de gestión para un **taller de herrería de tres trabajadores más el jefe**.
Registra tres cosas: **pedidos** que llegan, **trabajos realizados** y **albaranes**.

Arquitectura: **API REST** con toda la lógica de negocio en el servidor y el cliente
separado (una PWA que aún no está construida).

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
| Cliente (pendiente) | PWA en Angular + TypeScript |
| Documentos | PDF (no Word — ver §7) |

### Particularidades del entorno de desarrollo

- **Maven no está instalado.** Usa siempre el wrapper: `.\mvnw.cmd` en Windows,
  `./mvnw` en Linux/Mac. Nunca sugieras `mvn` a secas.
- **PostgreSQL corre en el puerto 5433**, no en el 5432. La máquina de desarrollo tiene
  un PostgreSQL nativo ocupando el 5432. Está así en `docker-compose.yml` y en
  `application.yml`; deben coincidir siempre.
- La máquina de desarrollo es **Windows**; el destino final es **Linux**.
- Las pruebas manuales de la API se hacen con **Postman**.

### Arranque

```
docker compose up -d          # levanta PostgreSQL
.\mvnw.cmd spring-boot:run    # arranca la API en el puerto 8080
```

`docker compose down` para parar. **Nunca sugieras `down -v`** sin avisar de forma
explícita: borra el volumen y con él todos los datos.

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
└── seguridad/   Usuario, TokenAcceso, filtro, SecurityConfig, AuthService
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
  pensados para que un humano los entienda.
- Las entidades tienen constructor `protected` vacío (requisito de JPA) y setters solo
  para los campos que de verdad son editables.
- Comentarios en castellano, explicando el *porqué* de las reglas de negocio.

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
- Se guardan **dentro de PostgreSQL** (blob), no en el sistema de ficheros. Decisión
  deliberada: así una sola copia de seguridad de la BD se lleva absolutamente todo.
- Tabla única `fotos` con `origenTipo` (PEDIDO/TRABAJO/ALBARAN) + `origenId`.
- Borrar una entidad arrastra sus fotos.

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
- Trabajo BORRADOR: el trabajador lo edita libremente.
- Trabajo ENVIADO: solo el jefe puede editarlo, borrarlo o tocar sus fotos.

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
DELETE /api/pedidos/{id}/fotos/{fid}

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

## 7. Trabajo pendiente

En orden previsto:

1. **Generación de PDFs** para las tres entidades. Solo JEFE.
   Se decidió **PDF y no Word**: son documentos finales, no editables, que se imprimen y
   archivan; la edición se hace en la aplicación y luego se regenera el documento.
2. **Infraestructura del servidor:**
   - Servicio `systemd` para que API y base de datos arranquen solas al encender.
   - **Copia de seguridad nocturna automática** a un **disco externo USB** dedicado,
     conservando unos 30 días. Un solo disco (se descartó la rotación de dos).
   - Integración con el **SAI**: detectar corte de luz por USB y apagar limpiamente si el
     corte se alarga, con margen para no reaccionar a microcortes.
3. **PWA en Angular**: cliente para la tablet (pedidos y trabajos) y para el ordenador del
   jefe (todo). Instalable, con resiliencia offline para microcortes de wifi.
4. **IP fija local** para el servidor, para que la tablet siempre lo encuentre.

Nota sobre `ddl-auto: update`: vale para desarrollo, pero antes de producción conviene
pasar a migraciones controladas (Flyway).

---

## 8. Cómo trabajar en este repositorio

- **Las decisiones de diseño se confirman antes de implementar.** Es la forma de trabajar
  acordada con el dueño del proyecto: primero se decide, luego se escribe código. Si una
  tarea implica una decisión de diseño no cubierta aquí, **pregunta antes de codificar**.
- Si algo de este documento choca con lo que pide el usuario, **gana el usuario**, pero
  señala la discrepancia antes de aplicarla.
- Replica el patrón existente: `pedido/` y `trabajo/` son las plantillas de referencia para
  cualquier entidad nueva.
- Las validaciones y reglas de negocio van **en el Service**, nunca en el Controller.
- Al terminar un cambio, verifica que compila con `.\mvnw.cmd spring-boot:run`
  (o `.\mvnw.cmd compile` si solo quieres comprobar la compilación).
- No hay tests automatizados todavía. Si añades alguno, que no dependa de un PostgreSQL
  real levantado a mano.