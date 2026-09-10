# Puesta en marcha en el taller

Guía completa, paso a paso y comando a comando, desde el mini-PC en la caja hasta
la aplicación funcionando en la tablet.

## Cómo está planteado

Es deliberadamente sencillo: **una sola máquina y nada más**.

- El **mini-PC** guarda la base de datos y sirve la aplicación.
- La **tablet** y el **ordenador del jefe** entran por el navegador, por la red
  local del taller.
- **No hay copias de seguridad automáticas ni SAI.** El respaldo documental son
  los **albaranes en PDF** que el jefe se descarga desde la aplicación: cada uno
  lleva dentro el número, la fecha, el cliente, el DNI, la descripción, la firma
  y las fotos, así que es el documento completo y se abre sin el servidor.
- Consecuencia asumida: **lo que se borra no se recupera**, y si falla el disco
  del mini-PC se pierde lo que hubiera dentro.

**El taller tiene internet en el router**, lo que hace la instalación mucho más
sencilla: el mini-PC se conecta por el cable de red y se descarga todo solo. Aun
así, **la aplicación no depende de internet**: si un día se cae la línea, el
taller sigue trabajando con normalidad.

---

## Qué llevar

**Antes de nada, desde casa: `git push`.**

El paso 8 clona el repositorio desde GitHub para traerse los ficheros de
configuración. Si te dejas commits sin subir, en el taller te bajarás una versión
vieja **sin `infra/`, sin `application-local.yml.ejemplo` y sin esta guía**, y no
lo descubrirás hasta que los comandos empiecen a fallar. Compruébalo con:

```bash
git status -sb          # tiene que decir "main...origin/main" y nada de "ahead"
```

**Lo único que no se puede conseguir allí:**

1. **Una memoria USB con el instalador de Ubuntu Server**, grabada en casa con
   Rufus o balenaEtcher desde la imagen de ubuntu.com/download/server. No vale
   copiar el fichero: tiene que ser un USB de arranque.
2. **El jar de la aplicación**, en otra memoria USB.

   > El jar **no está en GitHub**: `target/` está en `.gitignore`. Se compila en
   > tu equipo con `.\mvnw.cmd package` desde `taller-herreria/`, y **hay que
   > parar `ng serve` antes** o falla con un `EPERM` que no menciona la causa.
   > Son unos 63 MB en `target/herreria-0.0.1-SNAPSHOT.jar`.
   >
   > Si te lo dejas, hay salida: con internet se puede compilar en el propio
   > mini-PC (ver *Problemas típicos*), pero tarda y es incómodo.

**Prestado, solo para el montaje:**

- **Monitor o televisor con HDMI** y **su cable** (muchos mini-PC no lo traen).
- **Teclado USB.**
- Si el mini-PC tiene pocos puertos USB, un **hub** para no quedarte corto entre
  teclado y pendrives.

**Y ten a mano:**

- Los **datos fiscales del taller**: nombre, dirección, teléfono y CIF. Salen
  impresos en los albaranes que firma el cliente.
- **Tres contraseñas nuevas** decididas: la de PostgreSQL, la de `jefe` y la de
  `tablet`.
- La **contraseña de administración del router**, por si optas por la reserva
  DHCP del paso 6. Suele estar en una pegatina debajo del aparato.

---

## Qué comprar

### El mini-PC: dos criterios eliminatorios

Compruébalos **antes de pagar**, porque no se arreglan después:

1. **BIOS con "Restore on AC Power Loss = Power On"** (según la marca: *After
   Power Failure*, *AC Back Function*, *Auto Power On*). Es lo que hace que
   arranque solo al subir los plomos por la mañana.
2. **Sin ventilador (fanless).** Es una herrería: la limadura de hierro flota en
   el aire y es **conductora**.

| Componente | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 núcleos | Intel N100 / N150 |
| RAM | 4 GB | **16 GB** |
| Disco | 256 GB NVMe | **512 GB NVMe de marca** |
| Red | — | **Ethernet gigabit** |
| USB | 2 libres | 2-3 |

**NVMe de marca conocida, nunca eMMC.** Como no hay SAI, el equipo recibe un
corte en seco cada tarde al bajar los plomos, y los NVMe genéricos sin DRAM son
justo los que peor lo llevan. Busca un **barebones industrial fanless** de chasis
metálico (Protectli, Qotom, OnLogic, o los genéricos N100 de CWWK/Topton),
180-280 €. Los de consumo (Beelink, Minisforum) valen, pero **casi todos llevan
ventilador**: verifica que ponga "fanless".

### La tablet

Android de 10-11", brillo alto y **funda reforzada**. Solo wifi. **No pagues por
la cámara**: las fotos se reducen a 1600 px antes de subirse. 250-350 € con funda.

---

# Los pasos

## 1. Colocar y conectar

Piensa dónde va antes de enchufar nada. En una herrería importa más de lo normal:

- **Lejos de la zona de amolar y soldar.** El polvo de hierro es conductor.
- **Dentro de un armario o caja con ventilación**, mejor cerrado por delante.
- **Levantado del suelo**, treinta centímetros como mínimo.
- **Que no vibre**: nada de apoyarlo sobre una máquina o un compresor.
- **Con el botón de encendido accesible**: es el que se usará cada tarde para
  apagarlo bien (ver *La rutina diaria*).

Conecta: **cable de red al router**, monitor, teclado y corriente.

**Pasa el cable de red separado de los cables de fuerza.** Si tienen que
cruzarse, en ángulo recto: una soldadora induce ruido en un cable de datos que
vaya pegado a ella durante metros.

## 2. La BIOS

Enciende y entra en la BIOS (normalmente `Supr` o `F2`, a veces `Esc`):

1. **Restore on AC Power Loss → Power On.** No lo dejes en *Last State*: si la
   víspera se quedó apagada, con *Last State* seguiría apagada por la mañana.
2. **Fecha y hora** aproximadas (luego se corregirán solas por internet).
3. **Orden de arranque**: el USB primero, para esta vez.

Guarda y sal.

## 3. Instalar Ubuntu Server

Arranca desde el USB e instala **Ubuntu Server 24.04 LTS o superior**, sin
escritorio. Durante la instalación:

- La red se configura sola por DHCP: el instalador ya tiene internet.
- **Marca "Install OpenSSH server".** Es la única forma de entrar al mini-PC una
  vez metido en el armario. Si se te olvida, tendrás que traer otra vez monitor y
  teclado.
- Nombre del equipo: **`servidor-taller`**.
- Crea tu usuario y **apunta la contraseña**.
- Deja que use el disco entero.

Al terminar, **saca el USB** y reinicia.

## 4. Primer arranque

Entra en la consola con tu usuario y mira qué IP le ha dado el router y cómo se
llama la tarjeta de red:

```bash
ip -brief addr
```

Verás algo como `enp1s0  UP  192.168.1.137/24`. Apunta las dos cosas: el nombre
de la interfaz (`enp1s0`, `eno1`, `enp2s0`…) y la IP actual.

Comprueba que hay internet:

```bash
ping -c3 ubuntu.com
```

A partir de aquí ya puedes hacerlo todo desde otro equipo por SSH, que es más
cómodo que teclear en el monitor prestado:

```bash
ssh tu-usuario@192.168.1.137
```

## 5. Actualizar el sistema y ajustes base

```bash
sudo apt update && sudo apt upgrade -y
```

**Zona horaria.** Sin esto el servidor va en UTC, y a última hora de la tarde las
fechas saldrían con el día cambiado en los albaranes que firma el cliente:

```bash
sudo timedatectl set-timezone Europe/Madrid
timedatectl
```

En la salida deben aparecer `System clock synchronized: yes` y
`NTP service: active`. Como hay internet, el reloj se mantiene solo y no hay que
volver a tocarlo nunca.

**Que no se duerma nunca.** En Ubuntu Server no suele pasar, pero si algún día se
instala un escritorio encima esto ya está puesto:

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

**Para poder llamarlo por su nombre** (`servidor-taller.local`) sin recordar la IP:

```bash
sudo apt install -y avahi-daemon
```

## 6. La IP fija

La tablet tiene que encontrar siempre el servidor en la misma dirección. Hay dos
caminos; **con hacer uno basta**.

### Opción A — Fijarla en el propio mini-PC (recomendada)

No depende del router ni de tener su contraseña. Elige una IP **fuera del rango
que reparte el router por DHCP** (mira en su panel; si reparte de `.100` a `.200`,
la `.50` está libre). Aquí se usa `192.168.1.50`.

Primero, evita que cloud-init sobrescriba la configuración en cada arranque:

```bash
echo 'network: {config: disabled}' | sudo tee /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg
```

Crea el fichero de red (cambia `enp1s0` por tu interfaz y `192.168.1.1` por la IP
de tu router):

```bash
sudo nano /etc/netplan/99-taller.yaml
```

Con este contenido exacto — **el sangrado importa**, son espacios, nunca
tabuladores:

```yaml
network:
  version: 2
  ethernets:
    enp1s0:
      dhcp4: false
      addresses:
        - 192.168.1.50/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [192.168.1.1, 1.1.1.1]
```

Ajusta permisos y aplica:

```bash
sudo chmod 600 /etc/netplan/99-taller.yaml
sudo netplan apply
```

> Si lo haces por SSH **se te cortará la conexión**, porque la IP acaba de
> cambiar. Es normal: vuelve a entrar con `ssh tu-usuario@192.168.1.50`.

### Opción B — Reserva DHCP en el router

Apunta la MAC del mini-PC:

```bash
ip -brief link
```

Entra en el router, busca *DHCP* → *Reserva de direcciones* (o *Static Lease*) y
ata esa MAC a `192.168.1.50`. La configuración vive en un solo sitio y el mini-PC
no necesita saber nada.

### Comprobar (con cualquiera de las dos)

```bash
sudo reboot
```

Y al volver:

```bash
ssh tu-usuario@192.168.1.50
ip -brief addr        # tiene que decir 192.168.1.50
ping -c3 ubuntu.com   # y seguir teniendo internet
```

**Apunta esa IP: aparece en todo lo que viene después.**

## 7. Java y Docker

```bash
sudo apt install -y openjdk-21-jre-headless git
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
```

**Comprobar:**

```bash
java -version                    # tiene que decir 21
sudo docker run --rm hello-world # tiene que terminar sin error
```

## 8. Traer los ficheros del proyecto

Como hay internet, los ficheros de configuración se bajan del repositorio. Lo
único que no está ahí es el jar, que traes tú.

```bash
cd /tmp
git clone https://github.com/CarlosM-upm/Taller.git
```

Ahora el jar. Enchufa el pendrive donde lo traes y móntalo:

```bash
lsblk                       # localiza el pendrive, p. ej. sdb1
sudo mkdir -p /mnt/usb
sudo mount /dev/sdb1 /mnt/usb
ls /mnt/usb                 # comprueba que ves el jar
```

> **Alternativa sin pendrive:** desde tu portátil, en la carpeta del proyecto:
> `scp taller-herreria/target/herreria-0.0.1-SNAPSHOT.jar tu-usuario@192.168.1.50:/tmp/`

Crea el usuario y el directorio de la aplicación, y coloca todo:

```bash
sudo useradd --system --home-dir /opt/herreria --shell /usr/sbin/nologin herreria
sudo mkdir -p /opt/herreria/logs

sudo cp /mnt/usb/herreria-0.0.1-SNAPSHOT.jar /opt/herreria/herreria.jar
sudo cp /tmp/Taller/taller-herreria/docker-compose.yml /opt/herreria/
sudo cp /tmp/Taller/taller-herreria/application-local.yml.ejemplo /opt/herreria/
sudo cp /tmp/Taller/DESPLIEGUE.md /opt/herreria/

sudo cp /tmp/Taller/infra/systemd/herreria.service /etc/systemd/system/
sudo cp /tmp/Taller/infra/systemd/herreria-bd.service /etc/systemd/system/

sudo chown -R herreria:herreria /opt/herreria
sudo chmod 644 /etc/systemd/system/herreria*.service
```

## 9. Contraseña de la base de datos y configuración

> **Esto hay que hacerlo ANTES del primer arranque de PostgreSQL.** La contraseña
> se fija al crear la base de datos. Si arrancas primero y la cambias después, el
> contenedor seguirá con la vieja y verás un `password authentication failed`
> incomprensible. (Si te pasa, la solución está en *Problemas típicos*.)

```bash
printf 'POSTGRES_PASSWORD=%s\n' 'LA-QUE-HAYAS-DECIDIDO' | sudo tee /opt/herreria/.env
sudo chmod 600 /opt/herreria/.env
sudo chown root:root /opt/herreria/.env
```

Ahora la configuración de la aplicación:

```bash
sudo mv /opt/herreria/application-local.yml.ejemplo /opt/herreria/application-local.yml
sudo nano /opt/herreria/application-local.yml
```

Rellena **dos cosas**:

- `password:` → **la misma contraseña** que acabas de poner en el `.env`.
- `taller.documento` → **los datos fiscales reales del taller**. Encabezan los
  albaranes que se entregan al cliente.

```bash
sudo chown herreria:herreria /opt/herreria/application-local.yml
sudo chmod 600 /opt/herreria/application-local.yml
```

## 10. Arrancar

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now herreria-bd.service
sudo systemctl enable --now herreria.service
```

La primera vez tarda: tiene que descargar la imagen de PostgreSQL y aplicar las
migraciones de Flyway. Un par de minutos es normal.

## 11. Comprobar que funciona

```bash
systemctl status herreria-bd.service herreria.service
```

Los dos en verde (`active`). Y después:

```bash
curl -si http://localhost:8080/api/pedidos | head -1
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/
```

- El primero debe devolver **401**. Es la respuesta **correcta**: la API está viva
  y exige identificarse.
- El segundo debe devolver **200**: la aplicación web sirviéndose desde el jar.

Si algo falla, mira `journalctl -u herreria -n 50`.

## 12. Cambiar las contraseñas de las dos cuentas

Las que trae el sistema (`jefe123` y `tablet123`) **están en un repositorio
público**. Desde cualquier navegador de la red, en `http://192.168.1.50:8080`:

1. Entra como `jefe` / `jefe123` → **Ajustes** → cambiar contraseña. Al guardar te
   echa al login: cambiar la contraseña cierra todas las sesiones de ese usuario,
   y es a propósito.
2. Vuelve a entrar con la nueva y repite entrando como `tablet` / `tablet123`.

**Comprobar:** las contraseñas viejas ya no entran.

## 13. Cortafuegos (opcional pero recomendable)

Ahora que la máquina tiene internet, cuesta un minuto dejar abierto solo lo justo:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 8080/tcp
sudo ufw --force enable
sudo ufw status
```

> Asegúrate de que el `allow 22` está **antes** del `enable`, o te quedas fuera
> por SSH y tendrás que volver a conectar el monitor.

## 14. Acceso remoto con Tailscale (recomendable)

Para poder entrar al servidor de Zaragoza desde Madrid el día que algo falle, sin
tener que coger el coche.

**Por qué Tailscale y no abrir el puerto 22 en el router:** no hace falta IP
pública fija ni tocar el router, funciona aunque la línea esté detrás de CGNAT
(donde abrir puertos es imposible), y **no expone nada a internet** — un SSH
abierto en una IP pública empieza a recibir ataques de fuerza bruta a las pocas
horas. Es gratis para este uso: el plan personal cubre hasta 100 dispositivos.

Esto **no cambia** que la aplicación no dependa de internet: si se cae la línea
del taller, allí siguen trabajando igual; lo único que se pierde es tu acceso
desde fuera.

### En el mini-PC (Zaragoza)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Imprime una URL para autenticarte. Ábrela en el móvil o en el portátil y entra
con la cuenta que vayas a usar siempre (Google, GitHub o Microsoft). Después:

```bash
tailscale ip -4          # apunta la dirección, algo como 100.x.y.z
tailscale status
```

Y deja el cortafuegos limpio para el tráfico de la red privada:

```bash
sudo ufw allow in on tailscale0
```

### ⚠️ Desactiva la caducidad de la clave

**Este es el paso que no puedes saltarte.** Por defecto la clave del nodo caduca a
los **180 días**: el mini-PC se caería de la red y, como está en Zaragoza, sin
pantalla y a 300 km, no habría forma de volver a autenticarlo sin ir en persona.

En [login.tailscale.com](https://login.tailscale.com) → **Machines** → el equipo
`servidor-taller` → menú de los tres puntos → **Disable key expiry**.

Compruébalo: en la lista de máquinas, junto al nombre, debe poner
*Expiry disabled*.

### En el ordenador de Madrid (Windows)

Instala Tailscale desde [tailscale.com/download/windows](https://tailscale.com/download/windows),
o con winget desde PowerShell:

```powershell
winget install tailscale.tailscale
```

Ábrelo e **inicia sesión con la misma cuenta** que usaste en el mini-PC. En la
bandeja del sistema aparecerá el icono y, dentro, el servidor del taller.

Comprueba desde PowerShell que se ven:

```powershell
tailscale status
ping 100.x.y.z
```

Y entra:

```powershell
ssh tu-usuario@100.x.y.z
```

Windows 10 y 11 ya traen el cliente de SSH, no hay que instalar nada más. La
primera vez te pedirá aceptar la huella del servidor: escribe `yes`.

### MagicDNS, para no memorizar la IP

En el panel de Tailscale → **DNS** → activa **MagicDNS**. A partir de ahí:

```powershell
ssh tu-usuario@servidor-taller
```

### Entrar sin teclear la contraseña (opcional)

Desde PowerShell en Madrid:

```powershell
ssh-keygen -t ed25519
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh tu-usuario@servidor-taller "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### De regalo: la aplicación desde Madrid

Con Tailscale conectado también puedes abrir `http://100.x.y.z:8080` (o
`http://servidor-taller:8080` con MagicDNS) y usar la aplicación entera, no solo
SSH. Y si algún día el jefe quiere consultar albaranes desde casa, basta con
instalarle Tailscale y añadir su equipo a la red. Solo lo ven los dispositivos que
tú autorices.

**Ten presente que el mini-PC se apaga cada tarde**, así que el acceso remoto
funciona en horario de taller, no de madrugada.

## 15. La tablet y el ordenador del jefe

Conecta la tablet al **mismo wifi** que el router y abre
`http://192.168.1.50:8080`.

> **Si no carga pero desde otro equipo sí**, mira dos cosas en el router: que la
> tablet no esté en la **red de invitados** (está aislada a propósito) y que no
> tenga activado el **aislamiento de clientes** (*AP isolation*), que impide que
> los aparatos del wifi se hablen entre ellos ni con los del cable.

En la tablet, además:

- Ponle la **hora y la zona horaria** correctas.
- Quita el **ahorro de batería agresivo** para Chrome, o Android le cortará el
  wifi con la pantalla apagada.
- Sube el **tiempo de apagado de pantalla** a un par de minutos.
- **Menú de Chrome → Añadir a pantalla de inicio.**

Y prueba lo que solo se ve con la tablet en la mano:

- Los botones se pulsan bien **con guantes** (están pensados de 48-64 px).
- La navegación de abajo se alcanza con el pulgar sujetando la tablet.
- **Hacer una foto de verdad** desde el alta de un pedido: que se vea derecha y
  no tumbada, y que suba en un tiempo razonable.
- La **firma del cliente** se dibuja con el dedo sin que la página haga scroll.

En el ordenador del jefe, abre la misma dirección y **descarga el PDF de un
albarán**: comprueba que los datos del taller salen bien en la cabecera.

### Sobre "instalar" la aplicación en la tablet

Para que Chrome ofrezca *Instalar aplicación* de verdad, el sitio tendría que
servirse por **HTTPS**; `http://192.168.1.50:8080` no cuenta como origen seguro.
Con el acceso directo en la pantalla de inicio **funciona todo**: pedidos,
trabajos, albaranes, fotos, firma y PDFs. Es lo recomendable.

## 16. El arranque en frío

La prueba que reproduce lo que pasa cada mañana, y **la que valida todo lo
anterior**:

1. `sudo poweroff`
2. **Baja los plomos** del cuadro, como al cerrar el taller.
3. Espera unos segundos y vuelve a subirlos.
4. Sin tocar nada más, espera dos minutos y abre la aplicación en la tablet.

Si entra, el taller puede empezar la jornada sin que nadie toque el servidor.

## 17. Recoger

- Desconecta monitor y teclado.
- Etiqueta el enchufe: **NO DESENCHUFAR — SERVIDOR**.
- Limpia lo que sobra: `rm -rf /tmp/Taller` y `sudo umount /mnt/usb`.
- Deja pegada dentro del armario una hoja con la dirección
  `http://192.168.1.50:8080`, **cómo se apaga** (ver abajo) y un teléfono al que
  llamar. Las contraseñas **no** van en esa hoja.

---

## La rutina diaria del taller

Como no hay SAI, esto importa. **Antes de bajar los plomos por la tarde:**

> **Pulsar una vez el botón de encendido del mini-PC y esperar a que se apague la
> luz** (unos 20 segundos). Después, bajar los plomos.

Una pulsación corta hace un **apagado limpio**: Linux cierra la base de datos
ordenadamente antes de irse. Son cinco segundos, y evitan el desgaste de cortar en
seco con la base de datos abierta unas 250 veces al año.

Por la mañana no hay que hacer nada: al subir los plomos el equipo arranca solo.

**Y una vez al mes**, que el jefe se descargue en PDF los albaranes del mes y los
guarde donde guarde los papeles del taller. Cada PDF es el documento completo, con
firma y fotos incluidas.

---

## Comprobación final

- [ ] El mini-PC arranca solo al subir los plomos y responde en su IP fija (16).
- [ ] `systemctl status herreria-bd herreria` en verde después de reiniciar.
- [ ] `timedatectl` dice `System clock synchronized: yes`.
- [ ] Las contraseñas `jefe123`, `tablet123` y `cambiame` ya no valen (9, 12).
- [ ] `/opt/herreria/.env` y `application-local.yml` con permisos 600.
- [ ] Desde la tablet: alta de pedido con foto, trabajo enviado, albarán generado,
      firmado y **descargado en PDF**.
- [ ] Los **datos fiscales del taller** salen bien en la cabecera de ese PDF.
- [ ] El jefe sabe **apagar con el botón** antes de bajar los plomos.
- [ ] La hoja del paso 17 está pegada en el armario.

---

## Mantenimiento

**Entrar al servidor** desde cualquier equipo de la red:

```bash
ssh tu-usuario@192.168.1.50        # o servidor-taller.local
```

**Actualizar la aplicación** con una versión nueva compilada en tu equipo:

```bash
scp taller-herreria/target/herreria-0.0.1-SNAPSHOT.jar tu-usuario@192.168.1.50:/tmp/herreria.jar
```

Y en el servidor:

```bash
sudo systemctl stop herreria.service
sudo cp /opt/herreria/herreria.jar /opt/herreria/herreria.jar.anterior   # por si acaso
sudo mv /tmp/herreria.jar /opt/herreria/herreria.jar
sudo chown herreria:herreria /opt/herreria/herreria.jar
sudo systemctl start herreria.service
```

Si algo va mal: `sudo systemctl stop herreria` y restaurar `herreria.jar.anterior`.

**Actualizaciones del sistema.** Con internet, Ubuntu instala sola las de
seguridad y **no reinicia por su cuenta**. Cada varios meses, con el taller
cerrado:

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

Y comprueba después que la aplicación ha vuelto sola.

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
(`ping 192.168.1.50`)? ¿Sigue teniendo la IP fija (`ip -brief addr`)? ¿Está la
tablet en la red de invitados, o el router tiene el aislamiento de clientes
activado (paso 15)? ¿Activaste el cortafuegos sin abrir el 8080 (paso 13)?

**No arranca solo al subir los plomos.** La BIOS ha perdido el ajuste, casi
siempre porque se agotó la pila de botón de la placa. Cámbiala y vuelve a poner
*Restore on AC Power Loss = Power On* (paso 2).

**Te dejaste el jar en casa.** Con internet se puede compilar allí mismo, aunque
tarda unos minutos:

```bash
sudo apt install -y openjdk-21-jdk
cd /tmp/Taller/taller-herreria
./mvnw package
sudo cp target/herreria-0.0.1-SNAPSHOT.jar /opt/herreria/herreria.jar
sudo chown herreria:herreria /opt/herreria/herreria.jar
```

El wrapper de Maven se descarga solo Node y las dependencias, así que no hay que
instalar nada más.
