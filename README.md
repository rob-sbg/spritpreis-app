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

## 3. Push-Benachrichtigungen

Es ist keine manuelle VAPID-Konfiguration nötig. Beim ersten Aufruf von „Push aktivieren“ erzeugt der Worker automatisch ein VAPID-Schlüsselpaar und speichert es im privaten `APP_KV`-Namespace. Die App sendet anschließend eine Testbenachrichtigung.

Für iPhone muss die Web-App zuerst über Safari zum Home-Bildschirm hinzugefügt werden. Apple unterstützt Web Push für Home-Screen-Web-Apps ab iOS/iPadOS 16.4.

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
