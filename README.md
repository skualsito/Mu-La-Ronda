# Mu La Ronda

Servidor privado de **MU Online Season 6 Episodio 3** que se juega desde el navegador, sin instalar nada.

**Jugá en [mu.laronda.online](https://mu.laronda.online)** · [Discord](https://discord.gg/laronda) · [Kick](https://kick.com/inframe15/) · [YouTube](https://www.youtube.com/@inframe15)

Mu La Ronda está basado en el cliente web de **[Ignies](https://github.com/Ignies/OpenMu-Client-Babylon)** (OpenMU Client Babylon), un cliente de MU hecho en BabylonJS que usa los modelos, mapas e interfaz originales, y en el servidor **[OpenMU](https://github.com/MUnique/OpenMU)**. Sobre esa base le sumamos lo que hace falta para correr un servidor propio: configuración de juego, panel de administración, registro, mercado, VIP y muchos arreglos.

## Qué tiene

- **Todo en el navegador**: también se puede instalar como aplicación (PWA) desde Opciones.
- **Season 6 completo**: todas las clases, árbol de maestría, Blood Castle, Devil Square, Chaos Castle, Kanturu, invasiones doradas, Kalima y Kundun.
- **Rates altos y resets**: con `/reset`, `/autoreset` y ranking de resets, PK y guilds.
- **VIP bronce, plata y oro**: bonus de experiencia y zen, baúles extra (`/baul N`) y Stadium VIP.
- **Mercado entre jugadores** con zen en garantía.
- **Helper (MU Helper)** con filtros de items (`+Luck`, `+Opt 12`, `+Exc`...).
- **Comandos propios**: `/add` para repartir stats, `/resetarbol` para reiniciar el árbol de maestría y `/comandos` para verlos todos.
- **15 idiomas**, con español como idioma principal.
- **Rendimiento**: recorte automático de efectos de otros jugadores cuando bajan los FPS.

## Cómo está armado este repo

| Carpeta | Qué es |
|---|---|
| `src/` | El cliente del juego (BabylonJS + React). |
| `proxy/` | Puente WebSocket ↔ TCP entre el navegador y OpenMU. |
| `admin/` | Panel de administración (Bun): personajes, cuentas, inventarios, noticias, configuración. |
| `register/` | Registro de cuentas y API de rankings. |
| `marketplace/` | Servicio del mercado y el overlay de OpenMU (`marketplace/openmu`) con los cambios del servidor. |
| `deploy/` | Docker Compose, nginx, scripts de deploy y la configuración del juego en SQL (`deploy/config/*.sql`). |

El servidor es OpenMU compilado desde el código con nuestro overlay encima. La configuración del juego (rates, drops, eventos, VIP...) vive en `deploy/config/*.sql` y se aplica sola en cada deploy.

## Desarrollo local

Hace falta [Bun](https://bun.sh) ≥ 1.0 y un OpenMU corriendo (por ejemplo con Docker: `docker compose up -d` en `OpenMU/deploy/all-in-one`).

```bash
bun install
bun run dev        # el cliente en http://localhost:5173
bun run proxy      # el puente ws <-> tcp, en otra terminal
```

El proxy es obligatorio: el navegador no puede abrir sockets TCP, así que todo el tráfico a OpenMU pasa por ahí.

Para apuntar el cliente a un servidor local: `http://localhost:5173/?cs=127.0.0.1:44405&ws=ws://localhost:3000`.

Tests y tipos:

```bash
npx vitest run
npx tsc --noEmit -p .
```

## Créditos

- **[Ignies/OpenMu-Client-Babylon](https://github.com/Ignies/OpenMu-Client-Babylon)**: el cliente sobre el que está hecho Mu La Ronda.
- **[afrokick/muonlinejs](https://github.com/afrokick/muonlinejs)** (MIT): el JSClient original del que parte el cliente de Ignies.
- **[MUnique/OpenMU](https://github.com/MUnique/OpenMU)**: el servidor.
- **[Munormae/MuOnlineClient](https://github.com/Munormae/MuOnlineClient)** y **[xulek/muonline-bmd-viewer](https://github.com/xulek/muonline-bmd-viewer)**: referencias del comportamiento original y del formato BMD.

MU Online es una marca de Webzen. Este es un proyecto de fans sin fines comerciales.
