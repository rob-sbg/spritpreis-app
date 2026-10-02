import { sendPushNotification, WebPushError } from '@mmmike/web-push/send';
import { generateVapidKeys } from '@mmmike/web-push/vapid';

const ECONTROL = 'https://api.e-control.at/sprit/1.0/search/gas-stations/by-address';
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

function cors(response) {
  const h = new Headers(response.headers);
  h.set('access-control-allow-origin', '*');
  h.set('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
  h.set('access-control-allow-headers', 'content-type');
  return new Response(response.body, { status: response.status, headers: h });
}

async function econtrol(lat, lon, fuel, includeClosed = false) {
  const url = `${ECONTROL}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&fuelType=${encodeURIComponent(fuel)}&includeClosed=${includeClosed ? 'true' : 'false'}`;
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`E-Control HTTP ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

async function econtrolRegion(code, type, fuel, includeClosed = false) {
  const u = new URL('https://api.e-control.at/sprit/1.0/search/gas-stations/by-region');
  u.searchParams.set('code', String(code));
  u.searchParams.set('type', type);
  u.searchParams.set('fuelType', fuel);
  u.searchParams.set('includeClosed', includeClosed ? 'true' : 'false');
  const r = await fetch(u.toString(), { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`E-Control Regionsuche HTTP ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

async function getRegionUnits(env) {
  const key = 'system:econtrol-region-units:v1';
  try {
    const cached = await env.APP_KV.get(key, 'json');
    if (Array.isArray(cached) && cached.length) return cached;
  } catch {}
  const r = await fetch('https://api.e-control.at/sprit/1.0/regions/units', {
    headers: { accept: 'application/json' }
  });
  if (!r.ok) throw new Error(`E-Control Regionsdaten HTTP ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error('Ungültige E-Control Regionsdaten');
  await env.APP_KV.put(key, JSON.stringify(data), { expirationTtl: 86400 });
  return data;
}

function districtCandidates(units, lat, lon, radiusKm) {
  const districts = [];
  for (const state of units || []) {
    for (const district of state?.b || []) {
      const points = (district?.g || [])
        .map(g => [Number(g?.b), Number(g?.l)])
        .filter(([a,o]) => Number.isFinite(a) && Number.isFinite(o));
      if (!points.length) continue;
      let min = Infinity;
      for (const [a,o] of points) min = Math.min(min, haversineKm(lat, lon, a, o));
      districts.push({ code: district.c, name: district.n, minDistance: min });
    }
  }
  // Include all districts that have a municipality reasonably near the circle,
  // plus a few nearest districts to cover administrative boundaries.
  return districts
    .filter(d => d.minDistance <= radiusKm + 35)
    .sort((a,b) => a.minDistance - b.minDistance)
    .slice(0, 8);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function stationsWithinRadius(lat, lon, fuel, includeClosed = false, radiusKm = 10, env = null) {
  const radius = Math.max(1, Math.min(50, Number(radiusKm) || 10));

  // E-Control's address search returns only the ten nearest stations.
  // Combine several address points with nearby district searches, then
  // perform the final exact radius filter ourselves.
  const points = [];
  const cosLat = Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const stepKm = radius <= 10 ? Math.max(2.5, radius * 0.5) : radius * 0.55;
  const half = Math.ceil(radius / stepKm);
  const latStep = stepKm / 111.32;
  const lonStep = stepKm / (111.32 * cosLat);

  for (let y = -half; y <= half; y++) {
    for (let x = -half; x <= half; x++) {
      const pointLat = lat + y * latStep;
      const pointLon = lon + x * lonStep;
      if (haversineKm(lat, lon, pointLat, pointLon) <= radius * 1.05) {
        points.push([pointLat, pointLon]);
      }
    }
  }
  points.push([lat, lon]);

  const requests = points.map(([a,o]) => econtrol(a,o,fuel,includeClosed));
  if (env) {
    try {
      const units = await getRegionUnits(env);
      const districts = districtCandidates(units, lat, lon, radius);
      for (const d of districts) {
        requests.push(econtrolRegion(d.code, 'PB', fuel, includeClosed));
      }
    } catch {
      // Address-grid search remains the fallback if region data is unavailable.
    }
  }

  const batches = await Promise.all(requests);
  const byId = new Map();
  for (const list of batches) {
    for (const station of list) {
      const id = String(station?.id ?? station?.stationId ??
        `${station?.location?.latitude}:${station?.location?.longitude}:${station?.name || ''}`);
      if (!byId.has(id)) byId.set(id, station);
    }
  }

  const out = [];
  for (const station of byId.values()) {
    const c = coordsFor(station);
    if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) continue;
    const distance = haversineKm(lat, lon, c.latitude, c.longitude);
    if (distance <= radius + 0.05) out.push({ ...station, distance });
  }
  return out.sort((a,b) => (Number(a.distance)||Infinity) - (Number(b.distance)||Infinity));
}

function priceFor(station, fuel) {
  const prices = Array.isArray(station?.prices) ? station.prices : (Array.isArray(station?.fuelPrices) ? station.fuelPrices : []);
  const p = prices.find(x => x?.fuelType === fuel || x?.fuel === fuel);
  const value = Number(p?.amount ?? p?.price);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function coordsFor(station) {
  const lat = station?.latitude ?? station?.lat ?? station?.location?.latitude;
  const lon = station?.longitude ?? station?.lon ?? station?.location?.longitude;
  return { latitude: Number(lat), longitude: Number(lon) };
}

async function listByPrefix(env, prefix) {
  const out = [];
  let cursor;
  do {
    const page = await env.APP_KV.list({ prefix, cursor, limit: 100 });
    for (const k of page.keys) out.push(k.name);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}

async function saveJson(env, key, value) {
  await env.APP_KV.put(key, JSON.stringify(value));
}

async function getVapidConfig(env, requestUrl = null) {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT || (requestUrl ? new URL(requestUrl).origin : 'https://example.com')
    };
  }
  const stored = await env.APP_KV.get('system:vapid', 'json');
  if (stored?.publicKey && stored?.privateKey) return stored;
  const keys = await generateVapidKeys();
  const subject = env.VAPID_SUBJECT || (requestUrl ? new URL(requestUrl).origin : 'https://example.com');
  const config = { publicKey: keys.publicKey, privateKey: keys.privateKey, subject };
  await env.APP_KV.put('system:vapid', JSON.stringify(config));
  return config;
}


async function recordHistory(env, stations, fuel) {
  const now = new Date().toISOString();
  const batch = (stations || []).slice(0, 10);
  for (const station of batch) {
    const p = priceFor(station, fuel);
    if (p == null) continue;
    const id = String(station.id ?? station.stationId ?? '');
    if (!id) continue;
    const key = `hist:${fuel}:${id}`;
    const old = await env.APP_KV.get(key, 'json').catch(() => null) || [];
    const last = old[old.length - 1];
    if (last && Date.now() - Date.parse(last.t) < 14 * 60 * 1000) continue;
    const next = [...old, { t: now, p: Number(p) }].slice(-168);
    await env.APP_KV.put(key, JSON.stringify(next), { expirationTtl: 60 * 60 * 24 * 14 });
  }
}

async function geocodeSearch(query) {
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('q', query);
  u.searchParams.set('format', 'jsonv2');
  u.searchParams.set('limit', '1');
  u.searchParams.set('countrycodes', 'at');
  const r = await fetch(u.toString(), {
    headers: {
      accept: 'application/json',
      'user-agent': 'Spritpreis-App/5.2 (E-Control price app)'
    }
  });
  if (!r.ok) throw new Error(`Geosuche HTTP ${r.status}`);
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  const lat = Number(rows[0].lat), lon = Number(rows[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, displayName: rows[0].display_name || query };
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

  if (url.pathname === '/api/config' && request.method === 'GET') {
    try {
      const vapid = await getVapidConfig(env, request.url);
      return cors(json({ pushEnabled: true, publicKey: vapid.publicKey }));
    } catch (e) {
      return cors(json({ pushEnabled: false, error: e.message }, 500));
    }
  }

  if (url.pathname === '/api/search' && request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim();
    const fuel = url.searchParams.get('fuel') || 'SUP';
    if (q.length < 2 || !['SUP', 'DIE', 'GAS'].includes(fuel)) {
      return cors(json({ error: 'Bitte mindestens 2 Zeichen eingeben.' }, 400));
    }
    try {
      const geo = await geocodeSearch(q);
      if (!geo) return cors(json({ stations: [], location: null, message: 'Ort oder Adresse nicht gefunden.' }));
      const includeClosed = url.searchParams.get('includeClosed') === 'true';
      const radius = Number(url.searchParams.get('radius')) || 10;
      const stations = await stationsWithinRadius(geo.lat, geo.lon, fuel, includeClosed, radius, env);
      await recordHistory(env, stations, fuel);
      return cors(json({ stations, location: geo }));
    } catch (e) {
      return cors(json({ error: 'Suche konnte nicht ausgeführt werden.', detail: e.message }, 502));
    }
  }

  if (url.pathname === '/api/stations' && request.method === 'GET') {
    const lat = Number(url.searchParams.get('latitude'));
    const lon = Number(url.searchParams.get('longitude'));
    const fuel = url.searchParams.get('fuel') || 'SUP';
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !['SUP', 'DIE', 'GAS'].includes(fuel)) {
      return cors(json({ error: 'Ungültige Koordinaten oder Kraftstoffart.' }, 400));
    }
    try {
      const includeClosed = url.searchParams.get('includeClosed') === 'true';
      const radius = Number(url.searchParams.get('radius')) || 10;
      const stations = await stationsWithinRadius(lat, lon, fuel, includeClosed, radius, env);
      await recordHistory(env, stations, fuel);
      return cors(json(stations));
    }
    catch (e) { return cors(json({ error: 'E-Control konnte nicht erreicht werden.', detail: e.message }, 502)); }
  }

  if (url.pathname === '/api/history' && request.method === 'GET') {
    const stationId = url.searchParams.get('stationId');
    const fuel = url.searchParams.get('fuel') || 'SUP';
    if (!stationId || !['SUP', 'DIE', 'GAS'].includes(fuel)) return cors(json({ error: 'Ungültige Historienabfrage.' }, 400));
    const history = await env.APP_KV.get(`hist:${fuel}:${stationId}`, 'json').catch(() => null) || [];
    return cors(json({ history }));
  }

  if (url.pathname === '/api/push/test' && request.method === 'POST') {
    try {
      const vapid = await getVapidConfig(env, request.url);
      const subKeys = await listByPrefix(env, 'sub:');
      let delivered = 0, gone = 0, failed = 0;
      const errors = [];
      for (const subKey of subKeys) {
        const sub = await env.APP_KV.get(subKey, 'json');
        if (!sub) continue;
        try {
          const ok = await sendPushNotification(sub.subscription || sub, {
            title: '⛽ Spritpreis-App',
            body: 'Push-Benachrichtigungen funktionieren.',
            url: '/',
            tag: 'spritpreis-test'
          }, { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey }, { ttl: 300, urgency: 'high' });
          if (ok) delivered++; else { gone++; await env.APP_KV.delete(subKey); }
        } catch (err) {
          failed++;
          if (err instanceof WebPushError) {
            errors.push({ status: err.statusCode, message: err.message });
            if (err.statusCode === 404 || err.statusCode === 410) { gone++; await env.APP_KV.delete(subKey); }
          } else errors.push({ status: null, message: err?.message || String(err) });
        }
      }
      return cors(json({ ok: delivered > 0, total: subKeys.length, delivered, gone, failed, errors: errors.slice(0, 5) }));
    } catch (e) {
      return cors(json({ ok: false, error: e.message }, 500));
    }
  }

  if (url.pathname === '/api/push/status' && request.method === 'GET') {
    try {
      const vapid = await getVapidConfig(env, request.url);
      const keys = await listByPrefix(env, 'sub:');
      let valid = 0, stale = 0;
      for (const key of keys) {
        const saved = await env.APP_KV.get(key, 'json');
        if (!saved) continue;
        const sub = saved.subscription || saved;
        if (!sub?.endpoint) { stale++; continue; }
        if (saved.vapidPublicKey && saved.vapidPublicKey !== vapid.publicKey) stale++; else valid++;
      }
      return cors(json({ ok: true, subscriptions: keys.length, valid, stale, publicKey: vapid.publicKey }));
    } catch (e) { return cors(json({ ok: false, error: e.message }, 500)); }
  }

  if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const sub = body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return cors(json({ error: 'Ungültige Push-Anmeldung.' }, 400));
    const vapid = await getVapidConfig(env, request.url);
    const key = `sub:${await digest(sub.endpoint)}`;
    await saveJson(env, key, { subscription: sub, vapidPublicKey: vapid.publicKey, updatedAt: new Date().toISOString() });
    return cors(json({ ok: true, endpoint: sub.endpoint, publicKey: vapid.publicKey }));
  }

  if (url.pathname === '/api/push/subscribe' && request.method === 'DELETE') {
    const body = await request.json().catch(() => null);
    if (body?.endpoint) await env.APP_KV.delete(`sub:${await digest(body.endpoint)}`);
    return cors(json({ ok: true }));
  }

  if (url.pathname === '/api/alarms' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const { id, stationId, stationName, fuel = 'SUP', maxPrice = null, latitude, longitude } = body || {};
    if (!id || !stationId || !['SUP', 'DIE', 'GAS'].includes(fuel) || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return cors(json({ error: 'Ungültiger Preisänderungsalarm.' }, 400));
    }
    await saveJson(env, `alarm:${id}`, {
      id: String(id), stationId: String(stationId), stationName: String(stationName || 'Tankstelle'),
      fuel, maxPrice: Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : null,
      latitude, longitude, lastPrice: null
    });
    return cors(json({ ok: true }));
  }

  if (url.pathname.startsWith('/api/alarms/') && request.method === 'DELETE') {
    const id = url.pathname.split('/').pop();
    await env.APP_KV.delete(`alarm:${id}`);
    return cors(json({ ok: true }));
  }

  if (url.pathname === '/api/alarms/check' && request.method === 'POST') {
    const result = await checkAlarms(env);
    return cors(json(result));
  }

  return cors(json({ error: 'Nicht gefunden.' }, 404));
}

async function digest(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkAlarms(env) {
  let vapid;
  try { vapid = await getVapidConfig(env); } catch (e) { return { ok: false, reason: `VAPID konnte nicht initialisiert werden: ${e.message}` }; }
  const alarmKeys = await listByPrefix(env, 'alarm:');
  let checked = 0, changed = 0, notified = 0, removed = 0, noPrice = 0;
  const subKeys = await listByPrefix(env, 'sub:');

  for (const key of alarmKeys) {
    const alarm = await env.APP_KV.get(key, 'json');
    if (!alarm) continue;
    checked++;
    try {
      const stations = await econtrol(alarm.latitude, alarm.longitude, alarm.fuel, false);
      const station = (stations || []).find(s => String(s?.id ?? s?.stationId) === String(alarm.stationId));
      const price = priceFor(station, alarm.fuel);
      if (price == null) {
        noPrice++;
        continue;
      }

      const current = Number(price);
      const previous = Number(alarm.lastPrice);
      const hasPrevious = Number.isFinite(previous) && previous > 0;
      const isChanged = hasPrevious && Math.abs(current - previous) >= 0.0005;

      // The first successful check only establishes a baseline. Every later
      // detected price change generates a push notification.
      if (isChanged) {
        changed++;
        const direction = current < previous ? 'gesunken' : 'gestiegen';
        for (const subKey of subKeys) {
          const sub = await env.APP_KV.get(subKey, 'json');
          if (!sub) continue;
          try {
            const delivered = await sendPushNotification(sub, {
              title: '⛽ Preisänderung',
              body: `${alarm.stationName}: ${previous.toFixed(3).replace('.', ',')} → ${current.toFixed(3).replace('.', ',')} €/L (${direction})`,
              url: '/',
              tag: `price-${alarm.id}-${Date.now()}`
            }, {
              subject: vapid.subject,
              publicKey: vapid.publicKey,
              privateKey: vapid.privateKey
            }, { ttl: 3600 });
            if (!delivered) await env.APP_KV.delete(subKey);
            else notified++;
          } catch (err) {
            if (err?.statusCode === 404 || err?.statusCode === 410) await env.APP_KV.delete(subKey);
          }
        }
      }

      alarm.lastPrice = current;
      alarm.lastCheckedAt = new Date().toISOString();
      await saveJson(env, key, alarm);
    } catch (err) {
      console.log('Preisänderungsprüfung fehlgeschlagen', err?.message || err);
    }
  }
  return { ok: true, checked, changed, notified, noPrice, removed };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(checkAlarms(env));
  }
};
