#!/usr/bin/env bash
# Abre o painel de hábitos: sobe o servidor (se ainda não estiver rodando) e abre no Chrome.
#   abrir.sh          -> abre
#   abrir.sh --parar  -> para o servidor
# Variáveis opcionais: HABITOS_PORTA (padrão 3000), HABITOS_SEM_NAVEGADOR=1 (não abre o Chrome)
set -u

APP_DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
PORTA="${HABITOS_PORTA:-3000}"
URL="http://localhost:$PORTA"
LOG="$APP_DIR/data/servidor.log"

avisar() { command -v notify-send >/dev/null && notify-send -i "$APP_DIR/scripts/icone.svg" "Hábitos 16→18" "$1" 2>/dev/null; echo "$1"; }

# Atalhos da área de trabalho não carregam o nvm: carrega aqui para achar node/npm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

if [ "${1:-}" = "--parar" ]; then
  # Só para processos que são deste app (confere a pasta de cada processo na porta)
  # (ss em vez de lsof: o lsof não enxerga os processos do Next em alguns casos)
  parou=0
  for pid in $(ss -ltnpH "sport = :$PORTA" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do
    if [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" = "$APP_DIR" ]; then
      # Para o grupo inteiro (npm + next dev + next-server), senão o next dev pode reiniciar o servidor
      pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
      kill -- "-$pgid" 2>/dev/null || kill "$pid"
      parou=1
    fi
  done
  [ "$parou" = 1 ] && avisar "Servidor parado." || avisar "O servidor não estava rodando."
  exit 0
fi

if ! curl -s -o /dev/null "$URL"; then
  mkdir -p "$APP_DIR/data"
  cd "$APP_DIR" || exit 1
  avisar "Abrindo o painel…"
  # setsid + nohup: o servidor continua rodando depois que este script termina
  GITHUB_TOKEN="$(gh auth token 2>/dev/null)" setsid nohup npm run dev -- -p "$PORTA" >"$LOG" 2>&1 < /dev/null &
  for _ in $(seq 1 90); do
    curl -s -o /dev/null "$URL" && break
    sleep 1
  done
  if ! curl -s -o /dev/null "$URL"; then
    avisar "O servidor não subiu. Veja o log em $LOG"
    exit 1
  fi
fi

[ "${HABITOS_SEM_NAVEGADOR:-}" = 1 ] || setsid google-chrome "$URL" >/dev/null 2>&1 &
exit 0
