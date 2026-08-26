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

2. **Arrancar Docker Desktop** y esperar a que ponga "Engine running".

3. **Levantar PostgreSQL** (en la carpeta del proyecto):

       docker compose up -d

   Compruébalo con `docker ps`: debe aparecer `herreria-db`.

4. **Arrancar la API** con el wrapper (¡ojo al `.\` en PowerShell!):

       .\mvnw.cmd spring-boot:run

   La primera vez tarda: descarga Maven y las dependencias.
   Cuando veas "Started HerreriaApplication", la API escucha en
   http://localhost:8080

   (En Linux/Mac sería `./mvnw spring-boot:run`.)

## Probar que funciona

Crear un pedido (PowerShell):

    curl -X POST http://localhost:8080/api/pedidos `
      -H "Content-Type: application/json" `
      -d '{\"trabajador\":\"Juan\",\"cliente\":\"Construcciones Perez\",\"descripcion\":\"Barandilla 6 metros\"}'

Listar pedidos:

    curl http://localhost:8080/api/pedidos

## Estructura

    src/main/java/com/taller/herreria/
    ├── HerreriaApplication.java   Arranque
    ├── pedido/                    Entidad, repository, service, controller y DTOs
    ├── foto/                      Entidad Foto compartida
    ├── config/                    (próximamente: contador de albaranes)
    └── seguridad/                 (próximamente: login trabajador/jefe)

## Pendiente (siguientes sesiones)

- Entidades Trabajo Realizado (borrador/enviado) y Albarán
- Login con roles TRABAJADOR / JEFE
- Generación de PDFs
- Copia de seguridad nocturna y arranque automático (systemd)
