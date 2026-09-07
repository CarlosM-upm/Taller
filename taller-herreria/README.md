# Taller de Herrería — Backend

API REST en Spring Boot para la gestión de pedidos, trabajos realizados y albaranes.

## Requisitos en la máquina

- **Java 21 (JDK)** — ya instalado si `java -version` responde "21".
- **Docker Desktop** (Windows) o Docker (Linux) — para la base de datos.
- Maven NO hace falta instalarlo: el proyecto trae el "Maven Wrapper" (`mvnw`),
  que descarga Maven solo la primera vez.

## Paso 0 (solo Windows): configurar JAVA_HOME

El wrapper necesita la variable de entorno `JAVA_HOME` apuntando al JDK.
Tener `java` en el PATH no basta. Para comprobarlo en PowerShell:

    echo $env:JAVA_HOME

Si sale vacío, hay que crearla. Averigua la ruta del JDK (algo como
`C:\Program Files\Eclipse Adoptium\jdk-21.0.10-hotspot`) y configúrala:

- Menú Inicio → "Editar las variables de entorno del sistema" →
  botón "Variables de entorno" → en "Variables del sistema" pulsa "Nueva":
    - Nombre:  JAVA_HOME
    - Valor:   la carpeta del JDK (sin el \bin al final)
- Acepta todo y **abre una PowerShell nueva** (las variables solo se
  aplican en terminales abiertas después).
- Comprueba de nuevo con `echo $env:JAVA_HOME`.

## Puesta en marcha

1. **Cambiar la contraseña** de la base de datos en `docker-compose.yml`
   y en `src/main/resources/application.yml` (deben coincidir).
   Si el contenedor ya existe, cambiar `docker-compose.yml` no basta:
   `POSTGRES_PASSWORD` solo se aplica al crear el volumen. Para cambiarla
   sin perder datos:

       docker exec herreria-db psql -U herreria -d herreria -c "ALTER USER herreria WITH PASSWORD 'la-nueva';"

2. **Arrancar Docker Desktop** y esperar a que ponga "Engine running".

3. **Levantar PostgreSQL** (en la carpeta del proyecto):

       docker compose up -d

   Compruébalo con `docker ps`: debe aparecer `herreria-db` con `0.0.0.0:5433->5432`.
   Se usa el **5433** porque el 5432 suele estar ocupado por un PostgreSQL
   nativo de Windows.

4. **Arrancar la API** con el wrapper (¡ojo al `.\` en PowerShell!):

       .\mvnw.cmd spring-boot:run

   La primera vez tarda: descarga Maven y las dependencias.
   Cuando veas "Started HerreriaApplication", la API escucha en
   http://localhost:8080

   (En Linux/Mac sería `./mvnw spring-boot:run`.)

## Probar que funciona

Todo salvo `/api/login` exige un token. Primero se entra:

    curl -X POST http://127.0.0.1:8080/api/login `
      -H "Content-Type: application/json" `
      -d '{\"usuario\":\"jefe\",\"contrasena\":\"jefe123\"}'

Eso devuelve `{"token":"...","rol":"JEFE"}`. Con ese token:

    curl http://127.0.0.1:8080/api/pedidos -H "Authorization: Bearer EL_TOKEN"

Si algo falla, la respuesta trae el motivo en castellano:

    {"codigo":401,"error":"Unauthorized","mensaje":"Usuario o contraseña incorrectos",...}

## Registro de actividad

La aplicación escribe en `logs/herreria.log`, con rotación y 30 días de
histórico. Es el primer sitio donde mirar si algo va mal en el taller,
porque allí el servidor no tiene a nadie delante.

## Fotos y firmas

Se guardan dentro de PostgreSQL, en columnas `bytea`, con un máximo de
5 fotos por pedido, trabajo o albarán. Solo se admiten **JPEG y PNG**, y
se comprueba el contenido real del fichero, no la extensión ni lo que
declare el navegador.

## Estructura

    src/main/java/com/taller/herreria/
    ├── HerreriaApplication.java   Arranque
    ├── pedido/                    Entidad, repository, service, controller y DTOs
    ├── trabajo/                   Ciclo borrador -> enviado
    ├── albaran/                   Se genera desde un trabajo enviado
    ├── foto/                      Entidad Foto y validación de imágenes
    ├── config/                    Contador de numeración de albaranes
    ├── comun/                     Errores, CORS y reenvío de la PWA
    └── seguridad/                 Login y roles TRABAJADOR / JEFE

El cliente está fuera, en la carpeta hermana `taller-pwa/`.

## Empaquetar para el taller

    .\mvnw.cmd package

Genera **un solo jar** con la API y la PWA dentro, que es lo que se lleva al
mini-PC. No hace falta Node allí: el cliente ya va compilado.

**Antes hay que parar `ng serve`** si lo tienes abierto: el empaquetado borra
`node_modules` y el servidor de desarrollo mantiene ficheros abiertos, lo que
provoca un error `EPERM` bastante críptico.

Para probar el resultado:

    java -jar target\herreria-0.0.1-SNAPSHOT.jar

y abre http://localhost:8080

## Pendiente (siguientes sesiones)

- Terminar la PWA: alta de pedidos, ciclo de trabajos, albaranes y firma
- Generación de PDFs
- Migraciones con Flyway antes de producción
- Copia de seguridad nocturna y arranque automático (systemd)
- IP fija para el mini-PC
- Cambiar las contraseñas de `tablet`, `jefe` y PostgreSQL
