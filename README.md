<div align="center">

# EVA

**Suscripciones compartidas y finanzas personales, con el dinero calculado por el servidor.**

</div>

---

EVA es una app Android hecha con **Expo** y **React Native**. Sirve para llevar las cuentas de los servicios que compartes (Netflix, Spotify y similares) y tus finanzas personales: cuentas, tarjetas, préstamos, presupuestos y metas, más captura de comprobantes y análisis con IA.

**Regla de oro:** la app nunca calcula dinero. Solo muestra y envía; todas las cuentas las hace la API (`EVA-Backend`), y la app les da formato.

## Cómo está armado

| Pieza | Dónde vive |
|---|---|
| App (este repositorio) | Expo SDK 54 · React Native 0.81 · expo-router · NativeWind |
| API | `EVA-Backend` (Fastify + PostgreSQL) en Render, `https://api.eva-app.lat` |
| Cuentas y base de datos | Supabase (login, Postgres, archivos) |
| Sitio web | `EVA-Web` en Vercel, `https://www.eva-app.lat` |

El mapa completo (piezas, flujos, variables y cómo se publican los cambios) está en `docs/mapa-eva.html` de la carpeta de documentación del proyecto. Las decisiones de producto y de diseño viven en la carpeta `docs/especificacion` de esa misma carpeta.

## Estructura

```
app/                 Rutas (expo-router): una carpeta o archivo por pantalla
src/
  api/               Cliente de la API, sesión, caché sin conexión, login con Supabase y Google
  components/        Componentes reutilizables (kit v1, hojas, diálogos)
  constants/         Paletas de color, entidades bancarias
  context/           Sesión, tema y diálogos
  hooks/             Utilidades de pantallas (useAsync, useSubmit…)
  logic/             Lógica de pantallas sin interfaz (servicios, contactos, auth)
  screens/           Pantallas por módulo
  security/          Bloqueo con PIN y huella
  updates/           Aviso de actualizaciones por internet
assets/              Ícono, pantalla de carga, logos y fuentes
docs/                Manual de colores y estrategia de la versión 1
```

## Empezar

Requisitos: Node 22 y, para probar en el teléfono, Expo Go (o el APK de EVA).

```bash
npm install
cp .env.example .env     # rellena solo valores públicos
npx expo start
```

| Comando | Qué hace |
|---|---|
| `npx expo start` | Servidor de desarrollo |
| `npm test` | Pruebas (Jest) |
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `npm run publicar -- "qué cambió"` | Publica una actualización por internet para el APK (canal `preview`) |

## Variables de entorno

Todo lo que empieza con `EXPO_PUBLIC_` queda dentro del paquete de la app y cualquiera puede extraerlo. Por eso **aquí solo van valores públicos**; las claves de servicio, las contraseñas y la clave de Gemini viven únicamente en el servidor.

| Variable | Para qué |
|---|---|
| `EXPO_PUBLIC_API_URL` | Dirección de la API (`https://api.eva-app.lat/v1`) |
| `EXPO_PUBLIC_SUPABASE_URL` | Proyecto de Supabase (inicio de sesión) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave «publishable» de Supabase (pública por diseño) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | ID de cliente web de Google, para la hoja de cuentas del APK |

Para el APK, estos valores se declaran en `eas.json` (el `.env` no viaja a la compilación).

## Probar con el APK

- **Compilar:** `npx eas-cli build --platform android --profile preview` (perfil `production` para Google Play).
- **Actualizar sin reinstalar:** `npm run publicar -- "mensaje"`. Sirve para código y pantallas; las librerías nativas, los permisos o subir de SDK piden un APK nuevo (y subir `version` en `app.json`).
- Entrar con Google, las notificaciones y la huella solo funcionan en el APK, no en Expo Go.

## Documentación

| Documento | Contenido |
|---|---|
| [Manual de colores](docs/EVA-manual-colores.md) | Paletas, tokens y reglas de accesibilidad. La identidad de EVA es la Paleta 1 · Pizarra. |
| [Estrategia SQL y versión 1](docs/08-estrategia-sql-backend-y-v1.md) | Cómo se pasó al backend propio con PostgreSQL. |

## Licencia

Proyecto privado. Todos los derechos reservados © EVA.
