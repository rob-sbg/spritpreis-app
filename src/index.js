import { sendPushNotification } from '@mmmike/web-push/send';
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

async function econtrol(lat, lon, fuel) {
  const url = `${ECONTROL}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&fuelType=${encodeURIComponent(fuel)}&includeClosed=false`;
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`E-Control HTTP ${r.status}`);
  return r.json();
}

function priceFor(station, fuel) {
  const prices = station?.prices || station?.fuelPrices || [];
  const p = prices.find(x => x.fuelType === fuel || x.fuel === fuel);
  return p?.amount ?? p?.price ?? null;
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

  if (url.pathname === '/api/stations' && request.method === 'GET') {
    const lat = Number(url.searchParams.get('latitude'));
    const lon = Number(url.searchParams.get('longitude'));
    const fuel = url.searchParams.get('fuel') || 'SUP';
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !['SUP', 'DIE'].includes(fuel)) {
      return cors(json({ error: 'Ungültige Koordinaten oder Kraftstoffart.' }, 400));
    }
    try { return cors(json(await econtrol(lat, lon, fuel))); }
    catch (e) { return cors(json({ error: 'E-Control konnte nicht erreicht werden.', detail: e.message }, 502)); }
  }

  if (url.pathname === '/api/push/test' && request.method === 'POST') {
    try {
      const vapid = await getVapidConfig(env, request.url);
      const subKeys = await listByPrefix(env, 'sub:');
      let delivered = 0;
      for (const subKey of subKeys) {
        const sub = await env.APP_KV.get(subKey, 'json');
        if (!sub) continue;
        try {
          const ok = await sendPushNotification(sub, {
            title: '⛽ Spritpreis-App',
            body: 'Push-Benachrichtigungen funktionieren.',
            url: '/',
            tag: 'spritpreis-test'
          }, { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey }, { ttl: 300 });
          if (ok) delivered++; else await env.APP_KV.delete(subKey);
        } catch (err) {
          if (err?.statusCode === 404 || err?.statusCode === 410) await env.APP_KV.delete(subKey);
        }
      }
      return cors(json({ ok: delivered > 0, delivered }));
    } catch (e) {
      return cors(json({ ok: false, error: e.message }, 500));
    }
  }

  if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const sub = body?.subscription;
    if (!sub?.endpoint) return cors(json({ error: 'Ungültige Push-Anmeldung.' }, 400));
    const key = `sub:${await digest(sub.endpoint)}`;
    await saveJson(env, key, sub);
    return cors(json({ ok: true }));
  }

  if (url.pathname === '/api/push/subscribe' && request.method === 'DELETE') {
    const body = await request.json().catch(() => null);
    if (body?.endpoint) await env.APP_KV.delete(`sub:${await digest(body.endpoint)}`);
    return cors(json({ ok: true }));
  }

  if (url.pathname === '/api/alarms' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const { id, stationId, stationName, fuel = 'SUP', maxPrice, latitude, longitude } = body || {};
    if (!id || !stationId || !['SUP', 'DIE'].includes(fuel) || !Number.isFinite(Number(maxPrice)) || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return cors(json({ error: 'Ungültiger Alarm.' }, 400));
    }
    await saveJson(env, `alarm:${id}`, {
      id: String(id), stationId: String(stationId), stationName: String(stationName || 'Tankstelle'),
      fuel, maxPrice: Number(maxPrice), latitude: Number(latitude), longitude: Number(longitude)
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
  let checked = 0, notified = 0, removed = 0;
  for (const key of alarmKeys) {
    const alarm = await env.APP_KV.get(key, 'json');
    if (!alarm) continue;
    checked++;
    try {
      const stations = await econtrol(alarm.latitude, alarm.longitude, alarm.fuel);
      const station = (stations || []).find(s => String(s.id) === String(alarm.stationId));
      const price = priceFor(station, alarm.fuel);
      if (price == null || Number(price) > Number(alarm.maxPrice)) continue;

      const subKeys = await listByPrefix(env, 'sub:');
      for (const subKey of subKeys) {
        const sub = await env.APP_KV.get(subKey, 'json');
        if (!sub) continue;
        try {
          const delivered = await sendPushNotification(sub, {
            title: '⛽ Preisalarm',
            body: `${alarm.stationName}: ${Number(price).toFixed(3).replace('.', ',')} €/L`,
            url: '/',
            tag: `alarm-${alarm.id}`
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
      await env.APP_KV.delete(key);
      removed++;
    } catch (err) {
      console.log('Alarmprüfung fehlgeschlagen', err?.message || err);
    }
  }
  return { ok: true, checked, notified, removed };
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
