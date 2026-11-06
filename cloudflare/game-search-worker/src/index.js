const tokenCache = new Map();
const resultLimit = 8;
const requestTimeoutMs = 8000;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin');
        const corsHeaders = getCorsHeaders(origin, env);

        if (origin && !corsHeaders['Access-Control-Allow-Origin']) {
            return jsonResponse({ error: 'Origin not allowed.' }, 403, {});
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }
        if (request.method !== 'GET') {
            return jsonResponse({ error: 'Method not allowed.' }, 405, corsHeaders);
        }

        if (url.pathname === '/games/search') {
            const query = (url.searchParams.get('q') || '').trim();
            if (!query || query.length > 120) {
                return jsonResponse({ error: 'Search query must contain 1 to 120 characters.' }, 400, corsHeaders);
            }

            const cacheKeyUrl = new URL(request.url);
            cacheKeyUrl.searchParams.set('_origin', origin || 'no-origin');
            const cacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });
            const cached = await caches.default.match(cacheKey);
            if (cached) return cached;

            try {
                const results = await searchProviders(query, env);
                const response = jsonResponse({ results }, 200, corsHeaders);
                response.headers.set('Cache-Control', 'public, max-age=300');
                ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
                return response;
            } catch (error) {
                const status = error.message === 'No game search providers are configured.' ? 503 : 502;
                return jsonResponse({ error: error.message }, status, corsHeaders);
            }
        }

        if (url.pathname === '/games/details') {
            const provider = url.searchParams.get('provider');
            const id = url.searchParams.get('id') || '';
            if (provider !== 'rawg' || !/^\d+$/.test(id)) {
                return jsonResponse({ error: 'Unsupported provider or game ID.' }, 400, corsHeaders);
            }
            if (!env.RAWG_API_KEY) {
                return jsonResponse({ error: 'RAWG fallback is not configured.' }, 503, corsHeaders);
            }

            try {
                const details = await fetchRawgDetails(id, env);
                return jsonResponse({ details }, 200, corsHeaders);
            } catch (error) {
                return jsonResponse({ error: 'RAWG game details are unavailable.' }, 502, corsHeaders);
            }
        }

        return jsonResponse({ error: 'Not found.' }, 404, corsHeaders);
    }
};

async function searchProviders(query, env) {
    const providers = [
        {
            name: 'igdb',
            configured: !!(env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET),
            search: () => searchIgdb(query, env)
        },
        {
            name: 'gamebrain',
            configured: !!env.GAMEBRAIN_API_KEY,
            search: () => searchGameBrain(query, env)
        },
        {
            name: 'rawg',
            configured: !!env.RAWG_API_KEY,
            search: () => searchRawg(query, env)
        }
    ].filter(provider => provider.configured);

    if (providers.length === 0) {
        throw new Error('No game search providers are configured.');
    }

    const errors = [];
    for (const provider of providers) {
        try {
            const results = await provider.search();
            if (results.length > 0) return results;
        } catch (error) {
            errors.push(provider.name);
            console.warn(`${provider.name} search failed`, error.status || error.name || 'unknown');
        }
    }

    if (errors.length > 0) {
        throw new Error(`Game search providers unavailable: ${errors.join(', ')}.`);
    }
    return [];
}

async function searchIgdb(query, env) {
    const accessToken = await getIgdbAccessToken(env);
    const safeQuery = query.replace(/[\\\r\n;]/g, ' ').replace(/"/g, '\\"');
    const body = `search "${safeQuery}"; fields name,first_release_date,platforms.name,involved_companies.developer,involved_companies.company.name,cover.url,url; limit ${resultLimit};`;
    const response = await fetchWithTimeout('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
            'Client-ID': env.IGDB_CLIENT_ID,
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'text/plain'
        },
        body
    });
    const items = await readJson(response, 'igdb');

    return items.slice(0, resultLimit).map(item => {
        const year = item.first_release_date
            ? String(new Date(item.first_release_date * 1000).getUTCFullYear())
            : '';
        const platform = formatNames(item.platforms).split(', ').slice(0, 3).join(', ');
        const developer = (item.involved_companies || [])
            .filter(company => company.developer)
            .map(company => company.company?.name)
            .filter(Boolean)
            .join(', ');
        const imageUrl = normalizeIgdbImage(item.cover?.url);

        return {
            title: item.name || '',
            detail: [year, platform].filter(Boolean).join(' · '),
            image: imageUrl,
            meta: { provider: 'igdb', igdbId: item.id, year, platform, developer, imageUrl }
        };
    }).filter(item => item.title);
}

async function getIgdbAccessToken(env) {
    const cached = tokenCache.get(env.IGDB_CLIENT_ID);
    if (cached && cached.expiresAt > Date.now() + 60000) return cached.value;

    const tokenUrl = new URL('https://id.twitch.tv/oauth2/token');
    tokenUrl.searchParams.set('client_id', env.IGDB_CLIENT_ID);
    tokenUrl.searchParams.set('client_secret', env.IGDB_CLIENT_SECRET);
    tokenUrl.searchParams.set('grant_type', 'client_credentials');
    const response = await fetchWithTimeout(tokenUrl, { method: 'POST' });
    const data = await readJson(response, 'igdb-auth');
    if (!data.access_token) throw new Error('IGDB did not return an access token.');

    tokenCache.set(env.IGDB_CLIENT_ID, {
        value: data.access_token,
        expiresAt: Date.now() + Math.max((data.expires_in || 3600) - 60, 60) * 1000
    });
    return data.access_token;
}

async function searchGameBrain(query, env) {
    const url = new URL('https://api.gamebrain.co/v1/games');
    url.searchParams.set('query', query);
    url.searchParams.set('limit', String(resultLimit));
    const response = await fetchWithTimeout(url, {
        headers: { 'x-api-key': env.GAMEBRAIN_API_KEY }
    });
    const data = await readJson(response, 'gamebrain');

    return (data.results || []).slice(0, resultLimit).map(item => {
        const year = formatYear(item.year || item.release_date);
        const platform = formatNames(item.platforms).split(', ').slice(0, 3).join(', ');
        const developer = formatNames(item.developers || item.developer);
        const imageUrl = typeof item.image === 'string' ? item.image : '';
        return {
            title: item.name || '',
            detail: [year, platform].filter(Boolean).join(' · '),
            image: imageUrl,
            meta: { provider: 'gamebrain', gameBrainId: item.id, year, platform, developer, imageUrl }
        };
    }).filter(item => item.title);
}

async function searchRawg(query, env) {
    const url = new URL('https://api.rawg.io/api/games');
    url.searchParams.set('key', env.RAWG_API_KEY);
    url.searchParams.set('search', query);
    url.searchParams.set('page_size', String(resultLimit));
    const response = await fetchWithTimeout(url);
    const data = await readJson(response, 'rawg');

    return (data.results || []).slice(0, resultLimit).map(item => {
        const year = formatYear(item.released);
        const platform = (item.platforms || [])
            .map(entry => entry.platform?.name)
            .filter(Boolean)
            .slice(0, 3)
            .join(', ');
        const imageUrl = item.background_image || '';
        return {
            title: item.name || '',
            detail: [year, platform].filter(Boolean).join(' · '),
            image: imageUrl,
            meta: { provider: 'rawg', rawgId: item.id, rawgSlug: item.slug, year, platform, developer: '', imageUrl }
        };
    }).filter(item => item.title);
}

async function fetchRawgDetails(id, env) {
    const url = new URL(`https://api.rawg.io/api/games/${id}`);
    url.searchParams.set('key', env.RAWG_API_KEY);
    const response = await fetchWithTimeout(url);
    const item = await readJson(response, 'rawg');
    return {
        year: formatYear(item.released),
        platform: (item.platforms || []).map(entry => entry.platform?.name).filter(Boolean).slice(0, 3).join(', '),
        developer: (item.developers || []).map(entry => entry.name).filter(Boolean).join(', '),
        imageUrl: item.background_image || ''
    };
}

async function fetchWithTimeout(resource, options = {}) {
    return fetch(resource, { ...options, signal: AbortSignal.timeout(requestTimeoutMs) });
}

async function readJson(response, provider) {
    if (!response.ok) {
        const error = new Error(`${provider} returned HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

function getCorsHeaders(origin, env) {
    const allowedOrigins = (env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);
    const headers = {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
    if (origin && allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}

function jsonResponse(data, status, corsHeaders) {
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), { status, headers });
}

function formatYear(value) {
    const match = String(value || '').match(/\d{4}/);
    return match ? match[0] : '';
}

function formatNames(value) {
    if (typeof value === 'string') return value;
    if (!Array.isArray(value)) return '';
    return value.map(item => typeof item === 'string' ? item : item?.name || item?.value || '')
        .filter(Boolean)
        .join(', ');
}

function normalizeIgdbImage(value) {
    if (!value) return '';
    const url = value.startsWith('//') ? `https:${value}` : value;
    return url.replace('/t_thumb/', '/t_cover_big/');
}