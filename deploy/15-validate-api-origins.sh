#!/bin/sh
set -eu

validate_origin() {
    name=$1
    origin=$2
    if [ "$(printf '%s' "$origin" | tr -d '[:space:]')" != "$origin" ] ||
        ! printf '%s\n' "$origin" | grep -Eq '^https?://([A-Za-z0-9._-]+|\[[0-9A-Fa-f:]+\])(:[0-9]+)?$'; then
        echo "Configurar $name como un origen HTTP/HTTPS sin credenciales, ruta ni barra final." >&2
        exit 1
    fi
}

validate_origin SECURITY_API_ORIGIN "${SECURITY_API_ORIGIN:-}"
validate_origin LIQUIDAR_API_ORIGIN "${LIQUIDAR_API_ORIGIN:-}"
