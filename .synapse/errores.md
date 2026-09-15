# Errores y Soluciones

| ID | Síntoma | Root Cause | Solución |
|:---|:---|:---|:---|
| ERR-01 | Al sincronizar etiquetas, da error `FOREIGN KEY constraint failed` | El backend intentaba insertar en `label_members` antes de haber insertado el contacto en la tabla `contacts`. | Se invirtió el orden de inserción de las queries SQL. |
| ERR-02 | `window.require is not a function` o error `t` al generar código de 8 dígitos | 1) `requestPairingCode` invocaba evaluate prematuramente en `pupPage` antes de que WhatsApp Web termine de inyectar `window.require` y `AuthStore.PairingCodeLinkUtils`. 2) WhatsApp Web arroja `CompanionHelloError` (429 `IQErrorRateOverlimit`) si se pide código repetidamente para un mismo número. | 1) Polling activo de módulos (`window.AuthStore`, `window.require`). 2) Captura estructurada de `CompanionHelloError` 429 con mensaje claro al usuario y botón para usar QR. |

## ERR-02: Error window.require is not a function al vincular con teléfono (2026-09-15)
**Síntoma:** Al pulsar "GENERAR CÓDIGO DE 8 DÍGITOS", aparece `⚠️ window.require is not a function` o `⚠️ t`.
**Root Cause:**
1. El backend verificaba `!client.pupPage` y procedía inmediatamente, pero Puppeteer abre primero `about:blank` y WhatsApp Web tarda unos segundos en bootstrappear `window.require` y `window.AuthStore.PairingCodeLinkUtils`.
2. En llamadas repetidas, WhatsApp Web lanza `CompanionHelloError` (código 429 `rate-overlimit`) con `message: ""`, provocando que Express retorne error con nombre minificado `t`.
**Solución:**
1. Se añadió un polling que comprueba explícitamente `typeof window.require === 'function'` y `window.AuthStore.PairingCodeLinkUtils`.
2. Se implementó captura directa de `CompanionHelloError` / `IQErrorRateOverlimit` explicando el límite de WhatsApp y ofreciendo el botón para vincular vía QR.
**Estado:** ✅ FIXED

