#!/bin/bash
#
# Copia de seguridad diaria de la base de datos del taller al disco USB.
#
# Se lanza sola con herreria-copia.timer. Guarda 30 días de histórico en un
# único disco (se descartó rotar dos discos: con uno hay menos que explicar y
# menos que olvidar).
#
# Cómo probarla a mano:   sudo /opt/herreria/copia-nocturna.sh
# Comprobar que restaura: sudo /opt/herreria/probar-restauracion.sh
#
set -euo pipefail

DESTINO="${DESTINO:-/mnt/copias}"
CONTENEDOR="${CONTENEDOR:-herreria-db}"
USUARIO_BD="${USUARIO_BD:-herreria}"
BASE="${BASE:-herreria}"
DIAS_A_GUARDAR="${DIAS_A_GUARDAR:-30}"

FECHA="$(date +%Y-%m-%d)"
FICHERO="$DESTINO/herreria-$FECHA.dump"
REGISTRO="$DESTINO/copias.log"

decir() {
  local linea="$(date '+%Y-%m-%d %H:%M:%S')  $*"
  # A la salida estándar siempre: la recoge journalctl.
  echo "$linea"
  # Y al registro del propio disco, que es el que se puede leer desde otro
  # equipo si el mini-PC no arranca. Solo si está montado de verdad: si no,
  # el registro acabaría en el disco del sistema, dentro de la carpeta que
  # luego tapa el USB al montarse, y ahí no lo encuentra nadie.
  if mountpoint -q "$DESTINO" 2>/dev/null; then
    echo "$linea" >> "$REGISTRO" 2>/dev/null || true
  fi
}

fallar() {
  decir "ERROR: $*"
  exit 1
}

# 1. El disco tiene que estar MONTADO de verdad.
#
# Es la comprobación más importante de todo el script. Si el USB no está
# conectado, /mnt/copias sigue existiendo como carpeta normal del disco del
# sistema: las copias se escribirían ahí, nadie se enteraría, y el día que
# hiciera falta restaurar no habría copia en el disco que se lleva uno a casa.
# Además el disco del sistema se acabaría llenando en silencio.
mountpoint -q "$DESTINO" || fallar "el disco de copias no está montado en $DESTINO"

# 2. La base de datos tiene que estar arrancada.
docker exec "$CONTENEDOR" pg_isready -U "$USUARIO_BD" -q \
  || fallar "PostgreSQL no responde en el contenedor $CONTENEDOR"

# 3. El volcado.
#
# Formato "custom" (-Fc): va comprimido y permite restaurar con pg_restore
# tabla a tabla si algún día hace falta rescatar solo una cosa.
# Se escribe primero a un fichero temporal: si el volcado se corta a la mitad
# (se va la luz, se llena el disco), la copia de hoy no aparece a medias con
# nombre bueno, que es peor que no tenerla.
decir "empezando copia de $BASE"
TEMPORAL="$FICHERO.parcial"
rm -f "$TEMPORAL"

if ! docker exec "$CONTENEDOR" pg_dump -U "$USUARIO_BD" -Fc "$BASE" > "$TEMPORAL"; then
  rm -f "$TEMPORAL"
  fallar "pg_dump ha fallado"
fi

# 4. Comprobar que lo escrito es un volcado legible, no un fichero cualquiera.
#
# Un pg_dump que falla a medias deja un fichero con tamaño, y sin esto pasaría
# por copia buena. Listar su contenido obliga a leer el archivo entero.
if ! docker exec -i "$CONTENEDOR" pg_restore --list < "$TEMPORAL" > /dev/null 2>&1; then
  rm -f "$TEMPORAL"
  fallar "el volcado no es legible (pg_restore --list lo rechaza)"
fi

mv "$TEMPORAL" "$FICHERO"
sync
decir "copia correcta: $FICHERO ($(du -h "$FICHERO" | cut -f1))"

# 5. Tirar lo que pase de 30 días.
BORRADAS="$(find "$DESTINO" -maxdepth 1 -name 'herreria-*.dump' -type f -mtime "+$DIAS_A_GUARDAR" -print -delete | wc -l)"
if [ "$BORRADAS" -gt 0 ]; then
  decir "borradas $BORRADAS copias de más de $DIAS_A_GUARDAR días"
fi

QUEDAN="$(find "$DESTINO" -maxdepth 1 -name 'herreria-*.dump' -type f | wc -l)"
LIBRE="$(df -h "$DESTINO" | awk 'NR==2 {print $4}')"
decir "hay $QUEDAN copias guardadas, quedan $LIBRE libres en el disco"
