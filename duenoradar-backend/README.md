# DueñoRadar Backend (demo)

Este backend está pensado como **primer paso** hacia la versión "pro" de DueñoRadar,
donde en lugar de solo armar búsquedas por portal, empezamos a **unificar anuncios**
en una sola API.

## ¿Qué hace este backend?

- Expone un endpoint `GET /search` que:
  - Recibe parámetros: `country`, `location`, `keywords`, `includeOwner`.
  - Para cada portal de ese país, arma una búsqueda en Google usando `site:portal.com`.
  - Llama a la API de SerpApi (Google) para obtener resultados de esa búsqueda.
  - Devuelve:
    - Una lista por portal con los resultados.
    - Una lista unificada `listings` con todos los anuncios mezclados.

> Nota: En esta versión demo **no hay base de datos**. Cada llamada a `/search`
> consulta en tiempo real a SerpApi. Es ideal para validar el concepto y construir
> luego una versión con almacenamiento, alertas y deduplicación.

## Endpoints

### `GET /health`

Comprueba que el backend está vivo.

```json
{ "ok": true, "status": "DueñoRadar backend running" }
```

### `GET /search`

Parámetros (query):

- `country`: `ar`, `es`, `mx`, `us` o `other`.
- `location`: texto libre (barrio/ciudad/zona).
- `keywords`: texto libre (ej. "casa 3 ambientes").
- `includeOwner`: `"1"` para añadir "dueño directo" a las keywords, `"0"` para no añadirlo.

Ejemplo de request:

```bash
GET /search?country=ar&location=Palermo&keywords=casa+3+ambientes&includeOwner=1
```

Respuesta (simplificada):

```json
{
  "search": {
    "country": "ar",
    "location": "Palermo",
    "keywords": "casa 3 ambientes",
    "includeOwner": true
  },
  "portals": [
    {
      "domain": "zonaprop.com.ar",
      "query": "site:zonaprop.com.ar Palermo casa 3 ambientes dueño directo",
      "url": "https://www.google.com/...",
      "results": [
        {
          "id": "zonaprop.com.ar-1-...",
          "title": "Casa 3 ambientes en Palermo ...",
          "url": "https://www.zonaprop.com.ar/...",
          "snippet": "Descripción corta...",
          "position": 1,
          "source_domain": "zonaprop.com.ar",
          "portal": "zonaprop.com.ar",
          "country": "ar",
          "location": "Palermo",
          "keywords": "casa 3 ambientes",
          "includeOwner": true
        }
      ]
    }
  ],
  "listings": [
    // todos los resultados de todos los portales mezclados
  ]
}
```

## Cómo usarlo en local

1. Asegurate de tener **Node.js** instalado.
2. Cloná o descomprimí este proyecto.
3. En la raíz, corré:

```bash
npm install
```

4. Copiá el archivo `.env.example` a `.env`:

```bash
cp .env.example .env
```

5. Editá `.env` y poné tu API Key real de SerpApi:

```env
SERPAPI_API_KEY=tu_api_key_real
```

6. Iniciá el servidor:

```bash
npm start
```

Por defecto se levantará en `http://localhost:3000`.

## Cómo subirlo a Render (resumen rápido)

1. Creá un nuevo repositorio en GitHub y subí estos archivos.
2. En Render, creá un nuevo servicio de tipo **Web Service** desde ese repo.
3. En configuración:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. En la sección de **Environment**:
   - Definí la variable `SERPAPI_API_KEY` con tu API Key real.
5. Deploy.

Render te va a dar una URL del estilo:

```text
https://duenoradar-backend.onrender.com
```

Con eso, más adelante, la extensión (o una webapp) podría llamar a:

```text
https://duenoradar-backend.onrender.com/search?country=ar&location=Palermo&keywords=casa%203%20ambientes&includeOwner=1
```

y mostrar la lista de anuncios unificada.

## Próximos pasos posibles

- Añadir una base de datos (por ejemplo, PostgreSQL o MongoDB) para:
  - Guardar resultados.
  - Evitar repetir llamadas innecesarias a SerpApi.
  - Implementar alertas automáticas.
- Implementar lógica de:
  - "dueño directo probable" más avanzada.
  - deduplicar anuncios repetidos entre portales.
- Proteger el backend con una API Key propia (para usarlo solo desde tu extensión/app).