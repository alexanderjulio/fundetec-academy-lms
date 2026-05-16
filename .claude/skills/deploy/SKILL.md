---
description: Verifica el estado del deploy en GitHub Actions y muestra información del último despliegue al VPS de FUNDETEC (179.50.78.207).
---

Verifica o gestiona el deploy del proyecto FUNDETEC al VPS de producción.

## Argumentos esperados
`$ARGUMENTS` (opcional):
- vacío / `status` → Ver estado del último deploy
- `logs` → Ver logs del último workflow
- `force` → Advertir al usuario antes de hacer push manual

## VPS y configuración
- **IP**: `179.50.78.207`
- **OS**: Ubuntu 24.04
- **Proceso**: PM2 + Nginx
- **CI/CD**: GitHub Actions en rama `main` (con control de concurrencia)
- **Build**: Next.js output `standalone`

## Pasos a seguir

### Si `$ARGUMENTS` es vacío o `status`:

1. Verificar el estado del último workflow de deploy:
```bash
gh run list --workflow=deploy.yml --limit=5
```

2. Mostrar resultado formateado con:
   - Estado del último run (success/failure/in_progress)
   - Rama y commit del deploy
   - Hace cuánto tiempo fue
   - Duración del build

3. Si el último run falló, ejecutar:
```bash
gh run view <run-id> --log-failed
```
Y mostrar el error relevante al usuario.

---

### Si `$ARGUMENTS` es `logs`:

1. Obtener el ID del último run:
```bash
gh run list --workflow=deploy.yml --limit=1 --json databaseId --jq '.[0].databaseId'
```

2. Ver logs completos:
```bash
gh run view <run-id> --log
```

---

### Si `$ARGUMENTS` es `force`:

⚠️ **IMPORTANTE**: Antes de cualquier acción, advertir al usuario:

"Esto hará push a `main` y disparará el deploy automático al VPS de producción (179.50.78.207). ¿Confirmas que quieres proceder?"

Solo continuar si el usuario confirma explícitamente. Luego:

1. Verificar que no hay cambios sin commitear:
```bash
git status --short
```

2. Si hay cambios, detener y pedirle al usuario que los commitee primero.

3. Si está limpio, verificar la rama actual:
```bash
git branch --show-current
```

4. Solo hacer push si está en `main`:
```bash
git push origin main
```

5. Monitorear el deploy:
```bash
gh run list --workflow=deploy.yml --limit=1
```

---

## Notas importantes
- **Nunca** hacer `git push --force` a `main`
- El workflow tiene control de concurrencia: si hay un deploy en curso, el nuevo esperará
- El build puede tardar 3-5 minutos en un VPS con recursos limitados
- Si el deploy falla, revisar primero los logs de GitHub Actions antes de intentar arreglar manualmente
