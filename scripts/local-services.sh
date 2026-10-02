#!/usr/bin/env bash
# Starts PostgreSQL and Redis from locally installed binaries — for machines without Docker
# (e.g. cloud development sandboxes). Docker users should prefer `docker compose up -d`.
#
#   bash scripts/local-services.sh start|stop|status
#
# Data lives in .local/ (git-ignored). Connection strings match .env.example:
#   DATABASE_URL=postgres://gamepulse:gamepulse@localhost:5432/gamepulse
#   REDIS_URL=redis://localhost:6379
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE="$ROOT/.local"
PGDATA="$STATE/postgres"
PGPORT="${PGPORT:-5432}"
REDIS_PORT="${REDIS_PORT:-6379}"

find_pg_bin() {
  if command -v pg_ctl >/dev/null 2>&1; then dirname "$(command -v pg_ctl)"; return; fi
  local candidate
  candidate="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "$candidate" ]]; then echo "$candidate"; return; fi
  echo "PostgreSQL server binaries not found (install postgresql or use docker compose)" >&2
  exit 1
}

# PostgreSQL refuses to run as root; use the postgres system user when invoked as root.
as_pg() {
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}

start_postgres() {
  local bin; bin="$(find_pg_bin)"
  mkdir -p "$STATE"
  if [[ ! -s "$PGDATA/PG_VERSION" ]]; then
    mkdir -p "$PGDATA"
    [[ "$(id -u)" == "0" ]] && chown -R postgres:postgres "$PGDATA"
    as_pg "$bin/initdb" -D "$PGDATA" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
  fi
  if as_pg "$bin/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    echo "postgres: already running"
  else
    as_pg "$bin/pg_ctl" -D "$PGDATA" -l "$PGDATA/server.log" -o "-p $PGPORT -k /tmp" -w start >/dev/null
    echo "postgres: started on port $PGPORT"
  fi
  as_pg "$bin/psql" -h /tmp -p "$PGPORT" -U postgres -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname='gamepulse'" | grep -q 1 ||
    as_pg "$bin/psql" -h /tmp -p "$PGPORT" -U postgres -qc \
      "CREATE ROLE gamepulse LOGIN SUPERUSER PASSWORD 'gamepulse'"
  as_pg "$bin/psql" -h /tmp -p "$PGPORT" -U postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='gamepulse'" | grep -q 1 ||
    as_pg "$bin/createdb" -h /tmp -p "$PGPORT" -U postgres -O gamepulse gamepulse
}

stop_postgres() {
  local bin; bin="$(find_pg_bin)"
  if [[ -s "$PGDATA/PG_VERSION" ]] && as_pg "$bin/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    as_pg "$bin/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null
    echo "postgres: stopped"
  else
    echo "postgres: not running"
  fi
}

start_redis() {
  if ! command -v redis-server >/dev/null 2>&1; then
    echo "redis-server not found (install redis or use docker compose)" >&2
    exit 1
  fi
  if redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    echo "redis: already running"
    return
  fi
  mkdir -p "$STATE/redis"
  redis-server --port "$REDIS_PORT" --dir "$STATE/redis" --daemonize yes \
    --logfile "$STATE/redis/redis.log" --save "" --appendonly no >/dev/null
  echo "redis: started on port $REDIS_PORT"
}

stop_redis() {
  if redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
    echo "redis: stopped"
  else
    echo "redis: not running"
  fi
}

case "${1:-}" in
  start) start_postgres; start_redis ;;
  stop) stop_redis; stop_postgres ;;
  status)
    bin="$(find_pg_bin)"
    as_pg "$bin/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1 && echo "postgres: running" || echo "postgres: stopped"
    redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1 && echo "redis: running" || echo "redis: stopped"
    ;;
  *) echo "usage: $0 start|stop|status" >&2; exit 2 ;;
esac
