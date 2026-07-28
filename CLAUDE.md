# Alfred web — cómo trabajar en este repo

Next.js (App Router) + Tailwind, desplegado en Vercel. El backend son los agentes de
`~/alfred-railway`; ahí está el `CLAUDE.md` del otro lado.

## Trabajo en paralelo: una rama y una carpeta por sesión

Hay varias sesiones de Claude trabajando sobre este repo al mismo tiempo. La regla que
evita que se pisen:

```bash
git fetch origin
git worktree add .claude/worktrees/<tema> -b feat/<tema> origin/main
cd .claude/worktrees/<tema>
```

Tu carpeta, tu rama. Nadie más escribe ahí.

**Mientras trabajas**: commits chicos y `git push -u origin <rama>` cada vez que cierres
un cambio coherente. Pushear una rama **no despliega producción** —Vercel solo publica
`main`, las ramas generan preview— y es el único respaldo que existe.

**Antes de empezar y antes de mergear**, mira quién más está trabajando:

```bash
scripts/sesiones.sh
```

**Al terminar** (con `npm run build` en verde):

```bash
# 1) en TU worktree: traer lo que entró mientras trabajabas y re-probar
git fetch origin && git merge origin/main
npm run build

# 2) el merge va desde el clon principal, donde vive main
cd ~/alfred-frontend-vercel
git merge --no-ff feat/<tema> && git push origin main

# 3) limpiar
git worktree remove .claude/worktrees/<tema> && git branch -d feat/<tema>
```

### Reglas que no son negociables

1. **En el clon principal (`~/alfred-frontend-vercel`) solo se mergea.** Ni un commit,
   ni siquiera en una rama propia: de esa carpeta publican todas las sesiones. Un hook
   lo rechaza (`.githooks/pre-commit`, se activa con
   `git config core.hooksPath .githooks`); los merges pasan igual.
2. **Nunca `git commit -a` ni `git add -A`.** Se agregan los archivos propios, por ruta
   explícita. El 2026-07-27, en el repo hermano, una sesión barrió con `-a` en un
   worktree compartido y se llevó 145 líneas de otra dentro de un commit ajeno.
3. **Nunca trabajar en el worktree de otra sesión.** Si `git status` muestra cambios que
   no hiciste tú, estás en la carpeta equivocada.
4. **Nunca `git checkout .` / `git restore .` para "limpiar".** Si hay cambios ajenos,
   eso los borra sin vuelta.

## Deploy

Push a `main` → Vercel publica producción. Las ramas generan preview, no tocan prod.

**No publiques con `vercel --prod` desde tu rama.** El production branch del proyecto
siempre fue `main`, pero durante el 2026-07 se estuvo publicando a mano desde
`feat/cocina-inventario-lista`: `main` quedó 16 commits atrás y el repo se quedó sin
tronco — ramificar de `main` sacaba de lo que estaba en producción. Se cerró el
2026-07-28 mergeando esa rama a `main`. Si `main` vuelve a quedar atrás de lo que está
publicado, es la misma anomalía.
