# Puesta en marcha en el taller

Todo lo que hay que hacer, desde el mini-PC en la caja hasta la tablet
funcionando, en orden y sin saltarse nada.

## Cómo está planteado

Es deliberadamente sencillo: **una sola máquina y nada más**.

- El **mini-PC** guarda la base de datos y sirve la aplicación. No hay nada más.
- La **tablet** y el **ordenador del jefe** entran por el navegador, por la red
  local del taller.
- **No hay copias de seguridad automáticas ni SAI.** El respaldo documental son
  los **albaranes en PDF**, que el jefe se descarga desde la aplicación: cada PDF
  lleva dentro el número, la fecha, el cliente, el DNI, la descripción, la firma
  y las fotos, así que se abre en cualquier sitio sin necesidad del servidor.
- Consecuencia a tener presente: **lo que se borra en la aplicación no se
  recupera**, y si el disco del mini-PC falla se pierde lo que hubiera dentro.
  Lo que el jefe haya descargado en PDF sigue siendo suyo.

## Lo que no se puede hacer en el taller

**El taller no tiene internet, y la instalación sí lo necesita**: Ubuntu, Java,
Docker y la imagen de PostgreSQL son 1-1,5 GB de descarga. Se resuelve
**compartiendo internet desde el móvil** (Android → Ajustes → Conexión
compartida → *Anclaje por USB*; Linux lo reconoce solo). Cuenta ese gasto de
datos.

Y hay dos cosas que **tienes que traer hechas de casa**, porque allí no se
pueden fabricar: el **USB de instalación de Ubuntu** y el **jar de la
aplicación**.

> **Si lo prefieres, los pasos 2 al 12 se pueden hacer en tu casa** con calma,
> internet y una mesa, y dejar para el taller solo el 1, el 5 y del 13 en
> adelante. Ninguna configuración lleva la IP dentro, así que el mini-PC se puede
> preparar en una red y luego moverlo a otra sin tocar un solo fichero.

---

## Qué comprar

### El mini-PC: dos criterios eliminatorios

Compruébalos **antes de pagar**, porque no se arreglan después:

1. **BIOS con "Restore on AC Power Loss = Power On"** (según la marca: *After
   Power Failure*, *AC Back Function*, *Auto Power On*). Es lo que hace que
   arranque solo al subir los plomos por la mañana. Hay mini-PC baratos con la
   BIOS capada que no lo traen.
2. **Sin ventilador (fanless).** Es una herrería: la limadura de hierro flota en
   el aire y **es conductora**. Un ventilador la mete dentro del equipo.

| Componente | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 núcleos | Intel N100 / N150 |
| RAM | 4 GB | **16 GB** |
| Disco | 256 GB NVMe | **512 GB NVMe de marca** |
| Red | — | **Ethernet gigabit**, por cable |
| USB | 2 libres | 2-3 |
| Vídeo | HDMI | HDMI (solo para el montaje) |

**NVMe de marca conocida, nunca eMMC.** La eMMC soldada de los equipos baratos
es lenta y se desgasta con las escrituras constantes de una base de datos. Y como
no hay SAI, el equipo recibe un corte en seco cada tarde al bajar los plomos: los
NVMe genéricos sin DRAM son justo los que peor lo llevan.

**Qué tipo buscar:** un barebones industrial fanless con chasis metálico que hace
de disipador (categorías tipo Protectli, Qotom, OnLogic, o los genéricos N100 de
CWWK/Topton), 180-280 €. Los de consumo (Beelink, Minisforum) son buenos y
baratos pero **casi todos llevan ventilador**: verifica "fanless" en la ficha.

### La tablet

Android de 10-11", brillo alto y **funda reforzada**. Solo wifi. **No pagues por
la cámara**: las fotos se reducen a 1600 px antes de subirse. 250-350 € con funda.

### Prestado, solo para el montaje

- **Monitor o televisor con HDMI** y **teclado USB**. Sin ellos no entras en la
  BIOS ni instalas el sistema. Después el mini-PC se queda ciego.
- **Dos memorias USB**: una para el instalador de Ubuntu y otra para los ficheros
  del proyecto.
- Un **cable de red** del router al mini-PC.

---

## Antes de salir de casa

1. **Compila el jar**: en `taller-herreria/`, `.\mvnw.cmd package`. **Para
   `ng serve` antes** o falla con un `EPERM` que no menciona la causa real. Salen
   unos 63 MB en `target/herreria-0.0.1-SNAPSHOT.jar`.

   > El jar **no está en GitHub** (`target/` está en `.gitignore`), así que no lo
   > puedes descargar allí. Si te lo dejas, no hay despliegue.

2. **Graba el USB de Ubuntu Server** (24.04 LTS o superior) con Rufus o
   balenaEtcher. No vale con copiar el fichero: tiene que ser un USB de arranque.

3. **Copia al segundo USB** estos cinco ficheros:

   | Fichero | De dónde |
   |---|---|
   | `herreria-0.0.1-SNAPSHOT.jar` | `taller-herreria/target/` |
   | `docker-compose.yml` | `taller-herreria/` |
   | `application-local.yml.ejemplo` | `taller-herreria/` |
   | `herreria.service` | `infra/systemd/` |
   | `herreria-bd.service` | `infra/systemd/` |
   | `DESPLIEGUE.md` | raíz del repositorio |

   No hace falta nada más: ni el código fuente del backend, ni la carpeta
   `taller-pwa/` (la aplicación web va **dentro** del jar), ni el resto de
   `infra/`.

4. **Ten apuntado**: los **datos fiscales del taller** (nombre, dirección,
   teléfono y CIF, que salen impresos en los albaranes) y **tres contraseñas
   nuevas** decididas: la de PostgreSQL, la de `jefe` y la de `tablet`.

5. **Averigua la contraseña de administración del router** del taller. La vas a
   necesitar en el paso 5 y sin ella te quedas a medias. Suele estar en una
   pegatina debajo del aparato.

---

# En el taller, paso a paso

## 1. Colocar y conectar

Piensa dónde va antes de enchufar nada. En una herrería importa más de lo normal:

- **Lejos de la zona de amolar y soldar.** El polvo de hierro es conductor y va
  donde lo lleve el aire.
- **Dentro de un armario o caja con ventilación**, mejor cerrado por delante.
- **Levantado del suelo**, treinta centímetros como mínimo: barridos, agua de
  fregar y golpes de carretilla.
- **Que no vibre**: nada de apoyarlo sobre una máquina, un compresor o una
  estantería que reciba martillazos.
- **Con el botón de encendido accesible.** Ahora importa: es el que se usará
  cada tarde para apagarlo bien (ver *La rutina diaria* al final).

Conecta el **cable de red al router**, el monitor, el teclado y la corriente.

**Pasa el cable de red separado de los cables de fuerza.** Si tienen que
cruzarse, que sea en ángulo recto: la corriente de una soldadora induce ruido en
un cable de datos que vaya pegado a ella durante metros.

## 2. La BIOS

Enciende y entra en la BIOS (normalmente `Supr` o `F2`, a veces `Esc`). Tres
ajustes:

1. **Restore on AC Power Loss → Power On.** No lo dejes en *Last State*: si la
   víspera se apagó, con *Last State* se quedaría apagado y por la mañana el
   taller no tendría servidor.
2. **Fecha y hora correctas.** Sin internet **no habrá NTP que corrija el
   reloj**, y esa fecha acaba impresa en los albaranes que firma el cliente.
3. **Orden de arranque**: el USB primero, para esta vez.

Guarda y sal.

## 3. Instalar Ubuntu Server

Arranca del USB e instala **Ubuntu Server** (sin escritorio: la máquina no tendrá
pantalla). Durante la instalación:

- **Marca OpenSSH server.** Es la única forma de entrar al mini-PC una vez
  emparedado en el armario. Si se te olvida, tendrás que volver a traer monitor y
  teclado.
- Nombre del equipo: **`servidor-taller`**.
- Crea tu usuario y **apunta la contraseña**.
- Deja que use el disco entero.

Saca el USB y reinicia.

## 4. Primer arranque

Entra en la consola con tu usuario y apunta la **MAC** de la tarjeta de red, que
hace falta en el paso siguiente:

```bash
ip -brief link       # algo como 3c:7c:3f:xx:xx:xx
```

## 5. IP fija en el router

La tablet tiene que encontrar siempre el servidor en la misma dirección.

Entra en el router del taller, busca *DHCP* → *Reserva de direcciones* (o
*Static Lease*) y ata esa MAC a una IP fuera del rango que reparte el router, por
ejemplo `192.168.1.50`.

Si el router no permite reservas, la alternativa es fijarla en el propio equipo:
edita `/etc/netplan/50-cloud-init.yaml`, desactiva el DHCP, escribe dirección,
puerta de enlace y DNS, y `sudo netplan apply`.

**Comprobar:** `sudo reboot` y, al volver, `ip -brief addr` da la misma IP.
Apúntala: aparece en todo lo que viene después.

## 6. Internet, con el móvil

Conecta el móvil por USB y activa **Anclaje por USB**. Comprueba:

```bash
ping -c2 ubuntu.com
```

## 7. Ajustes base del sistema

```bash
sudo apt update && sudo apt upgrade -y

# Zona horaria: sin esto el servidor va en UTC y a última hora de la tarde
# las fechas de los albaranes saldrían con el día cambiado.
sudo timedatectl set-timezone Europe/Madrid
timedatectl

# Que no se duerma nunca.
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

# Para poder llamarlo por nombre: servidor-taller.local
sudo apt install -y avahi-daemon
```

## 8. Java, Docker y la base de datos

El paso que consume los datos del móvil:

```bash
sudo apt install -y openjdk-21-jre-headless
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo docker pull postgres:17
```

**Comprobar:** `java -version` dice 21, `docker run --rm hello-world` funciona y
`sudo docker images` muestra `postgres:17`.

Cuando esto termine, **ya puedes soltar el móvil**: a partir de aquí no hace
falta internet nunca más.

## 9. Copiar los ficheros del proyecto

Enchufa el segundo USB y móntalo:

```bash
lsblk                              # localiza el USB, p. ej. sdb1
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb
```

Crea el sitio donde vivirá la aplicación:

```bash
sudo useradd --system --home-dir /opt/herreria --shell /usr/sbin/nologin herreria
sudo mkdir -p /opt/herreria/logs

sudo cp /mnt/usb/herreria-0.0.1-SNAPSHOT.jar /opt/herreria/herreria.jar
sudo cp /mnt/usb/docker-compose.yml           /opt/herreria/
sudo cp /mnt/usb/application-local.yml.ejemplo /opt/herreria/
sudo cp /mnt/usb/DESPLIEGUE.md                /opt/herreria/
sudo cp /mnt/usb/herreria.service /mnt/usb/herreria-bd.service /etc/systemd/system/

sudo chown -R herreria:herreria /opt/herreria
sudo chmod 644 /etc/systemd/system/herreria*.service
```

Copiar esta guía al propio servidor no es un capricho: el día que haya un
problema, allí no hay internet para consultarla.

## 10. Contraseña de la base de datos y configuración

> **Esto hay que hacerlo ANTES del primer arranque de PostgreSQL.** La contraseña
> se fija al crear la base de datos. Si arrancas primero y la cambias después, el
> contenedor seguirá con la vieja y verás un `password authentication failed`
> incomprensible. (Si te pasa, la solución está al final, en *Problemas típicos*.)

```bash
printf 'POSTGRES_PASSWORD=%s\n' 'LA-QUE-HAYAS-DECIDIDO' | sudo tee /opt/herreria/.env
sudo chmod 600 /opt/herreria/.env
sudo chown root:root /opt/herreria/.env

sudo mv /opt/herreria/application-local.yml.ejemplo /opt/herreria/application-local.yml
sudo nano /opt/herreria/application-local.yml
sudo chown herreria:herreria /opt/herreria/application-local.yml
sudo chmod 600 /opt/herreria/application-local.yml
```

En `application-local.yml` rellena dos cosas:

- **La misma contraseña** que acabas de poner en el `.env`.
- **Los datos fiscales del taller** (`taller.documento`): encabezan los albaranes
  que se entregan al cliente.

## 11. Arrancar

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now herreria-bd.service
sudo systemctl enable --now herreria.service
```

**Comprobar:**

```bash
systemctl status herreria-bd.service herreria.service
curl -si http://localhost:8080/api/pedidos | head -1            # 401
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/ # 200
```

Un **401** en `/api/pedidos` es la respuesta correcta: la API está viva y exige
identificarse. El **200** en la raíz es la aplicación web sirviéndose desde el
propio jar.

## 12. Cambiar las contraseñas de las dos cuentas

Las que trae el sistema (`jefe123` y `tablet123`) **están en un repositorio
público**. Desde cualquier navegador de la red, en `http://192.168.1.50:8080`:

1. Entra como `jefe` / `jefe123` → **Ajustes** → cambiar contraseña. Al guardar
   te echa al login: cambiar la contraseña cierra todas las sesiones de ese
   usuario, y es a propósito.
2. Vuelve a entrar con la nueva y repite entrando como `tablet` / `tablet123`.

**Comprobar:** las contraseñas viejas ya no entran.

## 13. La tablet y el ordenador del jefe

Conecta la tablet al **mismo wifi** que el router y abre
`http://192.168.1.50:8080`.

> **Si no carga pero desde otro equipo sí**, mira dos cosas en el router: que la
> tablet no esté en la **red de invitados** (está aislada a propósito) y que no
> tenga activado el **aislamiento de clientes** (*AP isolation*), que impide que
> los aparatos del wifi se hablen entre ellos ni con los del cable.

En la tablet, además:

- Ponle **la hora y la zona horaria** correctas.
- Quita el **ahorro de batería agresivo** para Chrome, o Android le cortará el
  wifi con la pantalla apagada.
- Sube el **tiempo de apagado de pantalla** a un par de minutos: con las manos
  ocupadas, treinta segundos es un incordio.
- **Menú de Chrome → Añadir a pantalla de inicio.**

Y prueba lo que solo se ve con la tablet en la mano:

- Los botones se pulsan bien **con guantes** (están pensados de 48-64 px).
- La navegación de abajo se alcanza con el pulgar sujetando la tablet.
- **Hacer una foto de verdad** desde el alta de un pedido: que se vea derecha y
  no tumbada, y que suba en un tiempo razonable.
- La **firma del cliente** se dibuja con el dedo sin que la página haga scroll.

En el ordenador del jefe, abre la misma dirección y **descarga el PDF de un
albarán** para comprobar que los datos del taller salen bien en la cabecera.

### Sobre "instalar" la aplicación en la tablet

Para que Chrome ofrezca *Instalar aplicación* de verdad, el sitio tendría que
servirse por **HTTPS**; `http://192.168.1.50:8080` no cuenta como origen seguro.
Con el acceso directo en la pantalla de inicio **funciona todo**: pedidos,
trabajos, albaranes, fotos, firma y PDFs. Es lo recomendable, y no requiere nada
más.

## 14. El arranque en frío

La prueba que reproduce lo que pasa cada mañana, y **la que valida todo lo
anterior**:

1. Apaga el mini-PC: `sudo poweroff`.
2. **Baja los plomos** del cuadro, como al cerrar el taller.
3. Espera unos segundos y vuelve a subirlos.
4. Sin tocar nada más, a los dos minutos, desde el ordenador del jefe:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.1.50:8080/    # 200
```

O simplemente abre la página en la tablet. Si entra, el taller puede empezar la
jornada sin que nadie toque el servidor.

## 15. Recoger

- Desconecta monitor y teclado.
- Etiqueta el enchufe: **NO DESENCHUFAR — SERVIDOR**.
- Deja pegada dentro del armario una hoja con: la dirección
  `http://192.168.1.50:8080`, **cómo se apaga** (ver abajo) y un teléfono al que
  llamar. Las contraseñas **no** van en esa hoja.

---

## La rutina diaria del taller

Como no hay SAI, esto importa. **Antes de bajar los plomos por la tarde:**

> **Pulsar una vez el botón de encendido del mini-PC y esperar a que se apague
> la luz** (unos 20 segundos). Después, bajar los plomos.

Una pulsación corta hace un **apagado limpio**: Linux cierra la base de datos
ordenadamente antes de irse. Son cinco segundos y evitan el desgaste de cortar en
seco con la base de datos abierta, unas 250 veces al año.

Por la mañana no hay que hacer nada: al subir los plomos el equipo arranca solo.

**Y una vez al mes**, que el jefe se descargue en PDF los albaranes del mes desde
la aplicación y los guarde donde guarde los papeles del taller. Cada PDF es el
documento completo, con firma y fotos incluidas.

---

## Comprobación final

- [ ] El mini-PC arranca solo al subir los plomos y responde en su IP fija (14).
- [ ] `systemctl status herreria-bd herreria` en verde después de reiniciar.
- [ ] La **hora del servidor** es correcta (`timedatectl`).
- [ ] Las contraseñas `jefe123`, `tablet123` y `cambiame` ya no valen (10, 12).
- [ ] `/opt/herreria/.env` y `application-local.yml` con permisos 600.
- [ ] Desde la tablet: alta de pedido con foto, trabajo enviado, albarán
      generado, firmado y **descargado en PDF**.
- [ ] Los **datos fiscales del taller** salen bien en la cabecera de ese PDF.
- [ ] El jefe sabe **apagar con el botón** antes de bajar los plomos.
- [ ] La hoja del paso 15 está pegada en el armario.

---

## Mantenimiento

**Entrar al servidor** desde cualquier equipo de la red:

```bash
ssh tu-usuario@192.168.1.50        # o servidor-taller.local
```

**Actualizar la aplicación** con una versión nueva compilada en tu equipo:

```bash
scp taller-herreria/target/herreria-0.0.1-SNAPSHOT.jar tu-usuario@192.168.1.50:/tmp/herreria.jar
sudo systemctl stop herreria.service
sudo cp /opt/herreria/herreria.jar /opt/herreria/herreria.jar.anterior   # por si acaso
sudo mv /tmp/herreria.jar /opt/herreria/herreria.jar
sudo chown herreria:herreria /opt/herreria/herreria.jar
sudo systemctl start herreria.service
```

Si algo va mal: `sudo systemctl stop herreria` y restaurar `herreria.jar.anterior`.

**El reloj.** Sin internet no hay NTP, y el reloj de un PC se desvía alrededor de
un minuto al mes. Una vez al año, compáralo con el móvil y corrígelo:

```bash
sudo timedatectl set-time '2027-01-15 09:30:00'
```

**Actualizaciones del sistema.** Sin internet no habrá ninguna. Es el precio de
una máquina aislada, y es un intercambio razonable: no está expuesta a nada más
que a la red del taller.

**Dónde mirar cuando algo falla:**

| Qué | Dónde |
|---|---|
| La aplicación | `journalctl -u herreria -f` y `/opt/herreria/logs/herreria.log` (30 días) |
| La base de datos | `docker logs herreria-db` |
| El arranque | `journalctl -b` |

---

## Problemas típicos

**`password authentication failed` al arrancar la aplicación.** La contraseña de
`application-local.yml` no coincide con la que tiene PostgreSQL. Si es porque
arrancaste el contenedor antes de poner el `.env`:

```bash
docker exec -i herreria-db psql -U herreria -d postgres \
  -c "ALTER USER herreria WITH PASSWORD 'LA-QUE-HAYAS-DECIDIDO';"
sudo systemctl restart herreria
```

**La aplicación se reinicia una y otra vez por la mañana.** Es el arranque antes
de tiempo: `herreria.service` reintenta cada 10 segundos hasta que la base de
datos responde. Si no se estabiliza en un par de minutos, mira
`systemctl status herreria-bd`: el problema estará en Docker, no en la aplicación.

**La tablet no encuentra el servidor.** Por orden: ¿está encendido el mini-PC
(`ping 192.168.1.50`)? ¿Sigue teniendo la IP reservada en el router? ¿Está la
tablet en la red de invitados, o el router tiene el aislamiento de clientes
activado (paso 13)? Si el router se reinició y perdió la reserva, la IP habrá
cambiado y hay que volver al paso 5.

**No arranca solo al subir los plomos.** La BIOS ha perdido el ajuste, casi
siempre porque se agotó la pila de botón de la placa (se nota además en que la
hora se va). Cámbiala y vuelve a poner *Restore on AC Power Loss = Power On*
(paso 2).
