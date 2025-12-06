// Duenoradar backend v2
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SERPAPI_KEY = process.env.SERPAPI_KEY;

if (!SERPAPI_KEY) {
  console.warn('WARN: SERPAPI_KEY not set. /api/search will not work until you configure it.');
}

app.use(cors());
app.use(express.json());

const feedbackPath = path.join(__dirname, 'feedback.json');

let feedbackData = { badDomains: [], goodDomains: [] };

function loadFeedback() {
  if (fs.existsSync(feedbackPath)) {
    try {
      const raw = fs.readFileSync(feedbackPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        feedbackData = {
          badDomains: Array.isArray(parsed.badDomains) ? parsed.badDomains : [],
          goodDomains: Array.isArray(parsed.goodDomains) ? parsed.goodDomains : [],
        };
      }
    } catch (err) {
      console.error('Error reading feedback.json', err);
    }
  }
}

function saveFeedback() {
  try {
    fs.writeFileSync(feedbackPath, JSON.stringify(feedbackData, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing feedback.json', err);
  }
}

loadFeedback();

const BLACKLIST_KEYWORDS = [
  'remax',
  'century21',
  'coldwell',
  'propiedades',
  'inmobiliaria',
  'realestate',
  'realty',
  'kwargentina',
  'kwarg',
  'sothebysrealty',
  'engelvoelkers',
  'tuvivienda',
  'studioinmobiliario',
];

const WHITELIST_PORTALS = [
  'zonaprop.com',
  'zonaprop.com.ar',
  'argenprop.com',
  'mercadolibre.com',
  'mercadolibre.com.ar',
  'idealista.com',
  'fotocasa.es',
];

function getHostnameFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch (e) {
    return '';
  }
}

function isPortal(hostname) {
  return WHITELIST_PORTALS.some((portal) => hostname.endsWith(portal));
}

function isDomainBlacklisted(hostname) {
  const host = hostname.toLowerCase();
  if (!host) return true;
  if (feedbackData.badDomains.includes(host)) return true;
  if (feedbackData.goodDomains.includes(host)) return false;
  return BLACKLIST_KEYWORDS.some((kw) => host.includes(kw));
}

function classifyByText(title, snippet) {
  const text = `${title || ''} ${snippet || ''}`.toLowerCase();
  const ownerKeywords = [
    'dueño directo',
    'dueno directo',
    'trato directo',
    'no inmobiliaria',
    'sin inmobiliaria',
    'sin comisión',
    'sin comision',
    'no acepto inmobiliarias',
    'particular vende',
    'particular alquila',
  ];
  const agencyKeywords = [
    'somos una inmobiliaria',
    'nuestra inmobiliaria',
    'equipo de profesionales',
    'tasaciones sin cargo',
    'servicio inmobiliario',
    'estudio inmobiliario',
  ];

  const ownerSignal = ownerKeywords.some((kw) => text.includes(kw));
  const agencySignal = agencyKeywords.some((kw) => text.includes(kw));

  return { ownerSignal, agencySignal };
}

async function analyzePortalPage(url) {
  const result = {
    portalOwner: false,
    portalAgency: false,
  };

  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DuenoradarBot/1.0; +https://example.com)',
      },
    });
    const html = response.data;
    if (typeof html !== 'string') return result;
    const lower = html.toLowerCase();

    const hasParticular = lower.includes('particular');
    const hasInmobiliaria = lower.includes('inmobiliaria') || lower.includes('profesional');

    if (hasParticular && !hasInmobiliaria) {
      result.portalOwner = true;
    } else if (hasInmobiliaria) {
      result.portalAgency = true;
    }
  } catch (err) {
    console.warn('Error fetching portal page', url, err.message);
  }

  return result;
}

app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) {
      return res.status(400).json({ error: 'Missing q query parameter' });
    }
    if (!SERPAPI_KEY) {
      return res.status(500).json({ error: 'SERPAPI_KEY is not configured on the server' });
    }

    const params = {
      engine: 'google',
      api_key: SERPAPI_KEY,
      q,
      hl: req.query.hl || 'es',
      gl: req.query.gl || 'ar',
      num: 20,
    };

    const serpResponse = await axios.get('https://serpapi.com/search.json', { params });
    const organic = serpResponse.data.organic_results || [];

    const filteredResults = [];

    for (const item of organic) {
      const link = item.link;
      const title = item.title || '';
      const snippet = item.snippet || '';
      const hostname = getHostnameFromUrl(link);

      if (!hostname) continue;

      if (isDomainBlacklisted(hostname)) {
        continue;
      }

      const { ownerSignal, agencySignal } = classifyByText(title, snippet);
      if (agencySignal) {
        continue;
      }

      let portalOwner = false;
      let portalAgency = false;
      let portalChecked = false;

      if (isPortal(hostname)) {
        portalChecked = true;
        const portalInfo = await analyzePortalPage(link);
        portalOwner = portalInfo.portalOwner;
        portalAgency = portalInfo.portalAgency;

        if (portalAgency) {
          continue;
        }
      }

      const hasOwnerEvidence =
        ownerSignal || portalOwner || feedbackData.goodDomains.includes(hostname);
      if (!hasOwnerEvidence) {
        continue;
      }

      const result = {
        title,
        link,
        snippet,
        domain: hostname,
        classification: {
          ownerSignal,
          portalOwner,
          portalChecked,
        },
      };

      filteredResults.push(result);
    }

    res.json({ results: filteredResults });
  } catch (err) {
    console.error('Error in /api/search', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/feedback', (req, res) => {
  try {
    const { url, classification } = req.body || {};
    if (!url || !classification) {
      return res.status(400).json({ error: 'url and classification are required' });
    }
    const hostname = getHostnameFromUrl(url);
    if (!hostname) {
      return res.status(400).json({ error: 'Invalid url' });
    }

    if (classification === 'inmobiliaria') {
      if (!feedbackData.badDomains.includes(hostname)) {
        feedbackData.badDomains.push(hostname);
        feedbackData.goodDomains = feedbackData.goodDomains.filter((d) => d !== hostname);
      }
    } else if (classification === 'dueno') {
      if (!feedbackData.goodDomains.includes(hostname)) {
        feedbackData.goodDomains.push(hostname);
        feedbackData.badDomains = feedbackData.badDomains.filter((d) => d !== hostname);
      }
    } else {
      return res.status(400).json({ error: 'classification must be "inmobiliaria" or "dueno"' });
    }

    saveFeedback();
    res.json({ ok: true, hostname, classification });
  } catch (err) {
    console.error('Error in /api/feedback', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (_req, res) => {
  res.send('Duenoradar backend v2 is running.');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
