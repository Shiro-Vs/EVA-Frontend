<div align="center">

# EVA

**Suscripciones compartidas y finanzas personales, con el dinero calculado por el servidor.**

![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Android](https://img.shields.io/badge/Android-APK-3DDC84?logo=android&logoColor=white)
![Pruebas](https://img.shields.io/badge/pruebas-220-2EA44F)

[Sitio web](https://www.eva-app.lat) · [Manual de colores](docs/EVA-manual-colores.md)

</div>

---

## Qué es

EVA es una app Android para llevar las cuentas de los servicios que compartes (Netflix, Spotify y similares) y tus finanzas personales: **cuentas, tarjetas, préstamos, presupuestos y metas**, con captura de comprobantes y análisis con IA.

Te dice quién te debe, cuánto y desde cuándo; reparte cada cuota con prorrateo exacto; y convierte una constancia de Yape o de tu banco en un movimiento listo para confirmar.

> **Regla de oro:** la app nunca calcula dinero. Solo muestra y envía; todas las cuentas las hace la API y la app les da formato (`S/ 20.00`).

## Lo que incluye

| | |
|---|---|
| **Servicios compartidos** | Plazas, cuotas por ciclo, cobros, cortesías, bajas y devoluciones |
| **Finanzas personales** | Cuentas, tarjetas de crédito, préstamos, presupuestos, metas y recurrentes |
| **Captura inteligente** | Foto, PDF o correo reenviado → propuesta que tú confirmas |
| **Análisis con IA** | Consejo del día y preguntas sobre tus propios números |
| **Seguridad** | Bloqueo con PIN y huella, respaldos cifrados, modo sin conexión de consulta |
| **Siempre al día** | Actualizaciones por internet, sin reinstalar |

## Cómo está armado

| Pieza | Tecnología |
|---|---|
| **App** (este repositorio) | Expo SDK 54 · React Native 0.81 · expo-router · NativeWind |
| **API** | Fastify + PostgreSQL en Render · `https://api.eva-app.lat` |
| **Cuentas y datos** | Supabase: inicio de sesión (correo y Google), base y archivos |
| **Sitio web** | Vercel · `https://www.eva-app.lat` |

La identidad visual es la **Paleta 1 · Pizarra** (azul de marca y acento ámbar), con modo claro y oscuro y tipografía Asap.

## Empezar

Necesitas **Node 22** y, para probar en el teléfono, Expo Go o el APK de EVA.

```bash
npm install
cp .env.example .env     # solo valores públicos
npx expo start
```

| Comando | Qué hace |
|---|---|
| `npx expo start` | Servidor de desarrollo |
| `npx expo start --web` | La app en el navegador (sirve para revisar diseño) |
| `npm test` | Pruebas (Jest) |
| `npm run typecheck` | Comprueba los tipos |
| `npm run publicar -- "qué cambió"` | Publica una actualización por internet (canal `preview`) |

**Expo Go o APK:** con Expo Go se ven pantallas y API. Entrar con la hoja de cuentas de Google, las notificaciones, el PIN y la huella y las actualizaciones por internet solo funcionan en el **APK**.

## Estructura

```
app/                 Rutas (expo-router): una carpeta o archivo por pantalla
src/
  api/               Cliente de la API, sesión, caché sin conexión, login
  components/        Componentes reutilizables (kit v1, hojas, diálogos)
  constants/         Paletas de color y entidades bancarias
  context/           Sesión, tema y diálogos
  hooks/             Utilidades de pantallas
  logic/             Lógica de pantallas sin interfaz
  screens/           Pantallas por módulo
  security/          Bloqueo con PIN y huella
  updates/           Aviso de «hay una versión nueva»
assets/              Ícono, pantalla de carga, logos y fuentes
docs/                Manual de colores
```

## Variables de entorno

Todo lo que empieza con `EXPO_PUBLIC_` queda dentro del paquete de la app y cualquiera puede extraerlo. Por eso **aquí solo van valores públicos**; las claves de servicio y de IA viven únicamente en el servidor.

| Variable | Para qué |
|---|---|
| `EXPO_PUBLIC_API_URL` | Dirección de la API (`https://api.eva-app.lat/v1`) |
| `EXPO_PUBLIC_SUPABASE_URL` | Proyecto de Supabase (inicio de sesión) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave «publishable» de Supabase (pública por diseño) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | ID de cliente web de Google, para la hoja de cuentas del APK |

Para el APK, estos valores se declaran en `eas.json`: el `.env` no viaja a la compilación.

## Publicar

| Quiero… | Hago… |
|---|---|
| Un APK instalable | `npx eas-cli build --platform android --profile preview` |
| Cambiar pantallas o lógica | `npm run publicar -- "mensaje"` (llega al abrir la app) |
| Usar una librería nativa, permisos o subir de SDK | Subir `version` en `app.json` y compilar un APK nuevo |

## Calidad

El CI (GitHub Actions) comprueba tipos, auditoría de dependencias, pruebas y compilación web en cada cambio. Los avisos conocidos de herramientas de Expo se documentan, con fecha de revisión, en `.github/audit-exceptions.json`.

## Documentación

- [Manual de colores](docs/EVA-manual-colores.md): paletas, tokens y reglas de accesibilidad.
- La especificación del producto, la guía de operación y el mapa interactivo del sistema viven en la documentación privada del proyecto, junto a la API.

---

<div align="center">
<sub>Todos los derechos reservados © EVA. El código es visible, pero no se concede licencia de uso, copia ni distribución.</sub>
</div>
