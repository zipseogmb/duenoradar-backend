# Duenoradar Backend v2

Backend en Node.js para la nueva versión de **Duenoradar**, con filtro estricto de dueño directo
y feedback para aprender qué dominios son inmobiliarias y cuáles son particulares.

## Requisitos

- Node.js 18+
- Una API Key válida de [SerpApi](https://serpapi.com/) para hacer búsquedas en Google.

## Configuración local

1. Instalá dependencias:

   ```bash
   npm install
   ```

2. Copiá el archivo `.env.example` a `.env` y completá tu API Key de SerpApi:

   ```bash
   cp .env.example .env
   # luego editá .env y poné tu SERPAPI_KEY
   ```

3. Iniciá el servidor:

   ```bash
   npm start
   ```

El backend se levantará en `http://localhost:3000`

## Endpoints principales

### GET /api/search

Parámetros:

- `q`: texto de búsqueda (ej: "departamento venta dueño directo Palermo CABA").

Respuesta:

```json
{
  "results": [
    {
      "title": "Título del resultado",
      "link": "https://...",
      "snippet": "Descripción corta",
      "domain": "ejemplo.com",
      "classification": {
        "ownerSignal": true,
        "portalOwner": false,
        "portalChecked": true
      }
    }
  ]
}
```

Solo se devuelven resultados que pasan por:
- Filtro de dominios de inmobiliarias conocidas.
- Señales de texto de "dueño directo" / "trato directo" / etc.
- (Si es portal) detección básica de "Particular" vs "Inmobiliaria".
- Feedback previo guardado en `feedback.json` (si existe).

### POST /api/feedback

Permite enviar feedback desde la extensión para que el backend aprenda.

Body JSON:

```json
{
  "url": "https://ejemplo.com/aviso-123",
  "classification": "inmobiliaria"
}
```

Donde `classification` puede ser:

- `"inmobiliaria"`
- `"dueno"`

El backend guarda el dominio en `feedback.json` para mejorar futuros filtros.

## Deploy en Render

1. Creá un nuevo servicio de **Web Service** en Render con este repositorio / carpeta.
2. Comando de build: `npm install`
3. Comando de start: `npm start`
4. Agregá la variable de entorno `SERPAPI_KEY` en el panel de Render.
5. Cuando el deploy finalice, deberías poder ver el mensaje "Duenoradar backend v2 is running." en la URL pública de Render.

Usá esa URL (por ejemplo `https://duenoradar-backend.onrender.com`) en la extensión Chrome.
