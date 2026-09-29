# Spritpreis-App V4 – GitHub + Cloudflare Workers

Eine installierbare PWA für iPhone/Android mit E-Control-Tankstellenpreisen, Favoriten und Preisalarmen. Die App nutzt Cloudflare Workers + Workers Static Assets + Workers KV. Cloudflare Cron Trigger prüft aktive Alarme automatisch.

## Voraussetzungen
- kostenloses Cloudflare-Konto
- kostenloses GitHub-Konto
- Node.js 20+

## 1. Projekt zu GitHub
Den Inhalt dieses Ordners in ein neues GitHub-Repository hochladen, z. B. `spritpreis-app`.

## 2. Cloudflare KV anlegen
Im Projektordner:

```bash
npm install
npx wrangler login
npx wrangler kv namespace create APP_KV
```

Der Befehl gibt eine Namespace-ID aus. Diese ID in `wrangler.jsonc` bei
`DEINE_KV_NAMESPACE_ID_HIER` eintragen.

## 3. VAPID-Schlüssel erzeugen

```bash
npm run vapid
```

Die drei ausgegebenen Werte als Cloudflare Secrets setzen:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
```

Bei `VAPID_SUBJECT` z. B. `mailto:deine-email@example.com` verwenden.

## 4. Lokal testen

```bash
npm run dev
```

## 5. Deployen

```bash
npm run deploy
```

Danach bekommst du eine `*.workers.dev`-Adresse.

## 6. iPhone installieren
Die URL in Safari öffnen → Teilen → „Zum Home-Bildschirm“ → Hinzufügen.

Push-Benachrichtigungen auf iOS funktionieren für installierte Web-Apps; im normalen Safari-Tab nicht. Nach der Installation in der App „Push aktivieren“ wählen.

## 7. GitHub-Deployment
Für automatisches Deployment kann das GitHub-Repository in Cloudflare Workers mit GitHub verbunden werden. Alternativ reicht zunächst `npx wrangler deploy`.

## Preisalarme
Ein Alarm wird in Workers KV gespeichert. Der Cron Trigger läuft standardmäßig alle 15 Minuten, fragt E-Control ab und sendet bei Erreichen des Preislimits eine Web-Push-Nachricht. Nach erfolgreicher Benachrichtigung wird der einmalige Alarm entfernt.

## Hinweis zur kostenlosen Nutzung
Cloudflare Workers hat einen kostenlosen Tarif mit begrenzten Tages-/CPU-Kontingenten. Diese App ist für einen privaten, kleinen Nutzerkreis ausgelegt. Die E-Control-Preisdaten stammen aus der offiziellen Preistransparenzdatenbank/Spritpreisrechner-Schnittstelle.
