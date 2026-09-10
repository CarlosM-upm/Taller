#!/bin/bash
#
# Comprueba que la copia RESTAURA, que es la parte que casi nadie prueba.
#
# Una copia que se genera todas las noches sin fallos no sirve de nada si el
# día que hace falta resulta que no se puede volcar. Este script coge la copia
# más reciente (o la que se le pase), la restaura en una base de datos aparte,
# cuenta las filas y borra esa base al terminar.
#
# NO TOCA LA BASE DE DATOS DEL TALLER. La restauración de verdad, el día que
# haga falta, está explicada paso a paso en DESPLIEGUE.md.
#
#   sudo /opt/herreria/probar-restauracion.sh
#   sudo /opt/herreria/probar-restauracion.sh /mnt/copias/herreria-2026-09-01.dump
#
set -euo pipefail

DESTINO="${DESTINO:-/mnt/copias}"
CONTENEDOR="${CONTENEDOR:-herreria-db}"
USUARIO_BD="${USUARIO_BD:-herreria}"
BASE_DE_PRUEBA="herreria_prueba_restauracion"

FICHERO="${1:-}"
if [ -z "$FICHERO" ]; then
  FICHERO="$(ls -1t "$DESTINO"/herreria-*.dump 2>/dev/null | head -1 || true)"
fi
[ -n "$FICHERO" ] || { echo "ERROR: no hay ninguna copia en $DESTINO"; exit 1; }
[ -f "$FICHERO" ] || { echo "ERROR: no existe $FICHERO"; exit 1; }

echo "Probando la copia: $FICHERO"
echo "Fecha del fichero: $(date -r "$FICHERO" '+%Y-%m-%d %H:%M')"
echo

psql_admin() {
  docker exec -i "$CONTENEDOR" psql -U "$USUARIO_BD" -d postgres -v ON_ERROR_STOP=1 "$@"
}

limpiar() {
  psql_admin -q -c "DROP DATABASE IF EXISTS $BASE_DE_PRUEBA;" > /dev/null 2>&1 || true
}
trap limpiar EXIT

limpiar
psql_admin -q -c "CREATE DATABASE $BASE_DE_PRUEBA;"

echo "Restaurando en $BASE_DE_PRUEBA..."
if ! docker exec -i "$CONTENEDOR" pg_restore -U "$USUARIO_BD" -d "$BASE_DE_PRUEBA" --no-owner < "$FICHERO"; then
  echo
  echo "ERROR: la copia NO restaura. Revísala antes de fiarte de ella."
  exit 1
fi

echo
echo "Restaurada. Esto es lo que hay dentro:"
docker exec -i "$CONTENEDOR" psql -U "$USUARIO_BD" -d "$BASE_DE_PRUEBA" -c "
  select
    (select count(*) from pedidos)    as pedidos,
    (select count(*) from trabajos)   as trabajos,
    (select count(*) from albaranes)  as albaranes,
    (select count(*) from fotos)      as fotos,
    (select count(*) from usuarios)   as usuarios,
    (select proximo_numero_albaran from configuracion) as proximo_albaran;"

# Las fotos son lo que más pesa y lo que más duele perder: se comprueba que los
# bytes están de verdad, no solo que existe la fila.
docker exec -i "$CONTENEDOR" psql -U "$USUARIO_BD" -d "$BASE_DE_PRUEBA" -c "
  select coalesce(pg_size_pretty(sum(length(datos))), '0 bytes') as bytes_de_fotos
  from fotos;"

echo "Copia verificada: se restaura y trae los datos."
