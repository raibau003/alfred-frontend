#!/usr/bin/env bash
# Quién está trabajando en este repo ahora mismo.
#
# Correrlo al empezar (para no crear una rama sobre un tema que ya tiene dueño) y antes
# de mergear (para saber si alguien está a mitad de camino en los mismos archivos). El
# conflicto se ve mejor acá que dentro del merge.
set -euo pipefail

comun=$(cd "$(git rev-parse --git-common-dir)" && pwd)   # <repo>/.git, viva donde viva
principal=$(dirname "$comun")

git -C "$principal" fetch origin --quiet 2>/dev/null || echo "(sin red: los atrasos son contra el último origin/main conocido)"
echo

git -C "$principal" worktree list --porcelain | awk '/^worktree /{print substr($0,10)}' | while read -r ruta; do
  rama=$(git -C "$ruta" branch --show-current 2>/dev/null || true)
  sucios=$(git -C "$ruta" status --porcelain --untracked-files=normal | grep -v '^?? \.claude/' || true)
  n=$(printf '%s' "$sucios" | grep -c . || true)

  atras=$(git -C "$ruta" rev-list --count "HEAD..origin/main" 2>/dev/null || echo "?")
  adelante=$(git -C "$ruta" rev-list --count "origin/main..HEAD" 2>/dev/null || echo "?")

  if [ "$ruta" = "$principal" ]; then
    quien="clon principal (solo merges)"
  else
    quien="worktree"
  fi

  echo "▸ ${ruta/#$HOME/~}"
  echo "    $quien · rama ${rama:-<detached>} · ${adelante} commit(s) sin mergear · ${atras} atrás de main"

  if [ "$n" -gt 0 ]; then
    echo "    $n archivo(s) sin commitear:"
    printf '%s\n' "$sucios" | sed 's/^/      /'
  fi
  echo
done

echo "Ramas propias sin respaldo en origin (si se pierde el disco, se pierden):"
git -C "$principal" for-each-ref --format='%(refname:short) %(upstream:short)' refs/heads \
  | awk '$1 != "main" && ($2 == "" || $2 == "origin/main") {print "  " $1}' \
  | grep . || echo "  (ninguna)"
