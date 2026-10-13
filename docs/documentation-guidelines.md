# Buenas prácticas de documentación

Cómo documentamos en este repo. Aplica a todo lo que viva bajo `docs/` (y a los `README.md` de packages).

## 1. Reglas de oro

1. **Documenta el "por qué", el código ya dice el "qué"**. Un doc explica decisiones, restricciones y el contexto que no cabe en el diff.
2. **Por tema, no por tarea**. Nada de `TSK-XX.md`/`HU-XX.md` sueltos. Una decisión de reservas va a `features/reservas.md`; una de correos, a `automation/…`. Los IDs de Jira solo aparecen como referencia histórica dentro del texto.
3. **Un doc = una fuente de verdad**. Si dos archivos dicen lo mismo, uno queda obsoleto sin avisar. Enlaza, no dupliques.
4. **Fecha las decisiones transitorias** (`**2026-10-12**: …`). Lo permanente (arquitectura) no necesita fecha.
5. **Perecedero con honestidad**: si un doc describe algo que ya se borró (ej. MinIO), márcalo con un banner de advertencia y/o remplázalo con la alternativa actual.

## 2. Estructura y convenciones

- Idioma: **español** (permite términos técnicos en inglés cuando no hay traducción natural: *webhook*, *workflow*...).
- Archivos: `kebab-case.md`. Títulos: `#` + título corto. Un solo `H1` por archivo.
- Todo doc referencia su posición en el índice: si lo agregas, registra el enlace en [`README.md`](./README.md).
- Diagramas: Mermaid en bloque ```` ```mermaid ````, nunca screenshots de excalidraw/drawio (no se versionan).
- Snippets de comandos: siempre ejecutables y con el directorio implícito claro (`cd ...` si aplica).

## 3. Dónde va cada cosa

| Escribo sobre... | Va en... |
|---|---|
| Versiones, estructura del repo, convenciones de código | `architecture/architecture.md` |
| Reglas de negocio implementadas | `features/<dominio>.md` |
| Cambios a workflows, correos, alertas n8n | `automation/` |
| Cualquier cosa del VPS, contenedores, dominios, CI/CD | `infra/` |
| Requisitos nuevos del cliente | `product/` primero, luego el `features/` al implementar |
| Cómo subirse al repo | `onboarding.md` (no docs de features) |

## 4. Ciclo de vida

- El doc se actualiza **en el mismo PR** que el código que lo cambia. Doc desactualizado = bug.
- Alquilarle un ojo a los docs al cerrar sprint: si una feature cambió, su `features/*.md` debe reflejarlo.
- Links: revisiones periódicas con `grep` para encontrar enlaces rotos (cualquier `./x.md` debe existir).

## 5. Plantilla para docs de feature

```markdown
# <Nombre del dominio>

> Estado: <vigente | parcial | obsoleto YYYY-MM-DD>

## Contexto
Por qué existe, qué problema resuelve, qué regla RN/RF aplica.

## Cómo funciona
Flujo principal, endpoints/archivos clave (con rutas del repo entre backticks).

## Decisiones y restricciones
Lo que NO es obvio leyendo el código.

## Testing
Cómo verificar que sigue funcionando (comando de test exacto).
```
