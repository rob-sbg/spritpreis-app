# Spritpreis-App V5.50 – vollständiges Cloudflare-Worker-Projekt

## Inhalt
- `src/index.js` – Worker, E-Control-Abfragen, Favoriten-Preisalarme und Push-Diagnose
- `public/index.html` – vollständige Web-App ohne RMC-Kennzeichnung
- `public/sw.js` – Push-Handler und Cache-Verhalten (Release 550 wird über index.html registriert)
- `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`
- `wrangler.jsonc`, `package.json`, `scripts/generate-vapid.js`

## Deploy
1. ZIP entpacken. Die Dateien `public`, `src`, `scripts`, `wrangler.jsonc`, `package.json`, `.gitignore` und `README.md` müssen direkt im Projekt-Hauptverzeichnis liegen. Keinen zusätzlichen Unterordner hochladen.
2. Im GitHub-Repository `rob-sbg/spritpreis-app` diese Dateien/Ordner vollständig ersetzen und committen.
3. Cloudflare-Deploy abwarten. Der Workername ist `spritpreis-app`; das KV-Binding heißt `APP_KV`.
4. Danach `https://spritpreis-app.robert-schiefer.workers.dev/` öffnen und unten prüfen, dass **App-Version 5.50** angezeigt wird.

## RMC
Die Tankstellenkarten in `public/index.html` rendern keine RMC-Badges. `src/index.js` enthält keine RMC-Zuordnungslogik. Die App-Version wurde auf 5.50 gesetzt und der Service-Worker-Registrierungsparameter auf `v=550` erhöht.

## Hinweis
`wrangler.jsonc` verwendet das vorhandene KV-Namespace-ID des Projekts. Vor dem Deploy nicht versehentlich durch ein anderes Namespace ersetzen.
