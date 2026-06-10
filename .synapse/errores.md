# Errores y Soluciones

| ID | Síntoma | Root Cause | Solución |
|:---|:---|:---|:---|
| ERR-01 | Al sincronizar etiquetas, da error `FOREIGN KEY constraint failed` | El backend intentaba insertar en `label_members` antes de haber insertado el contacto en la tabla `contacts`. | Se invirtió el orden de inserción de las queries SQL. |

