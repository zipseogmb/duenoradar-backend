require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const SERPAPI_KEY = process.env.SERPAPI_API_KEY;

// Lista de portales por país (igual que en la extensión)
const PORTALS_BY_COUNTRY = {
  ar: [
    "zonaprop.com.ar",
    "argenprop.com",
    "properati.com.ar",
    "mercadolibre.com.ar"
  ],
  es: [
    "idealista.com",
    "fotocasa.es",
    "pisos.com",
    "habitaclia.com"
  ],
  mx: [
    "inmuebles24.com",
    "vivanuncios.com.mx",
    "propiedades.com"
  ],
  us: [
    "zillow.com",
    "realtor.com",
    "redfin.com"
  ],
  other: [
    "idealista.com",
    "pisos.com",
    "zonaprop.com.ar"
  ]
};

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, status: "DueñoRadar backend running" });
});

/**
 * /search
 * Unifica resultados por portal usando Google via SerpApi.
 *
 * Query params:
 *  - country: ar, es, mx, us, other
 *  - location: texto libre de zona / barrio / ciudad
 *  - keywords: texto libre (ej: "casa 3 ambientes")
 *  - includeOwner: "1" o "0", para añadir "dueño directo" al texto
 *
 * Respuesta:
 * {
 *   search: { country, location, keywords, includeOwner },
 *   portals: [ { domain, url, results: [ ... ] } ],
 *   listings: [ ... resultados unificados ... ]
 * }
 */
app.get("/search", async (req, res) => {
  try {
    if (!SERPAPI_KEY) {
      return res.status(500).json({
        error: "Falta configurar SERPAPI_API_KEY en las variables de entorno."
      });
    }

    const country = (req.query.country || "ar").toLowerCase();
    const rawLocation = (req.query.location || "").trim();
    const rawKeywords = (req.query.keywords || "").trim();
    const includeOwner = req.query.includeOwner === "1";

    if (!rawLocation && !rawKeywords) {
      return res.status(400).json({
        error: "Debes indicar al menos una ciudad/zona o palabras clave."
      });
    }

    const portals = PORTALS_BY_COUNTRY[country] || PORTALS_BY_COUNTRY["other"];

    let keywords = rawKeywords;
    if (includeOwner && !/dueñ[oa]/i.test(keywords)) {
      keywords += (keywords ? " " : "") + "dueño directo";
    }

    const queryParts = [];
    if (rawLocation) queryParts.push(rawLocation);
    if (keywords) queryParts.push(keywords);

    const qBase = queryParts.join(" ").trim();

    const serpBaseUrl = "https://serpapi.com/search.json";

    // Para cada portal, hacemos una llamada a SerpApi (Google)
    // y tomamos los primeros N resultados.
    const MAX_RESULTS_PER_PORTAL = 5;

    const portalPromises = portals.map(async (domain) => {
      const sitePart = `site:${domain}`;
      const fullQuery = [sitePart, qBase].filter(Boolean).join(" ");

      const params = {
        api_key: SERPAPI_KEY,
        engine: "google",
        q: fullQuery,
        num: MAX_RESULTS_PER_PORTAL
      };

      try {
        const response = await axios.get(serpBaseUrl, { params });
        const data = response.data || {};
        const organic = data.organic_results || [];

        const results = organic.slice(0, MAX_RESULTS_PER_PORTAL).map((item, index) => {
          const url = item.link || "";
          const title = item.title || "";
          const snippet = item.snippet || item.snippet_highlighted_words?.join(" ") || "";
          const position = item.position || index + 1;

          return {
            id: `${domain}-${position}-${Date.now()}`,
            title,
            url,
            snippet,
            position,
            source_domain: domain,
            portal: domain,
            country,
            location: rawLocation,
            keywords: rawKeywords,
            includeOwner
          };
        });

        return {
          domain,
          query: fullQuery,
          url: data.search_metadata?.google_url || null,
          results
        };
      } catch (error) {
        console.error("Error consultando SerpApi para", domain, error.message);
        return {
          domain,
          query: fullQuery,
          url: null,
          error: "Error consultando SerpApi",
          results: []
        };
      }
    });

    const portalsData = await Promise.all(portalPromises);

    // Unificar todos los resultados en un solo array
    const allListings = portalsData.flatMap((p) => p.results || []);

    res.json({
      search: {
        country,
        location: rawLocation,
        keywords: rawKeywords,
        includeOwner
      },
      portals: portalsData,
      listings: allListings
    });
  } catch (err) {
    console.error("Error en /search:", err);
    res.status(500).json({
      error: "Error interno en el servidor"
    });
  }
});

app.listen(PORT, () => {
  console.log(`DueñoRadar backend listening on port ${PORT}`);
});