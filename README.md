# Spritpreis-App V5.49 – RMC vollständig entfernt

Dieses ZIP enthält die Projektdateien direkt im ZIP-Stammverzeichnis (kein zusätzlicher Projektordner).

1. Den gesamten ZIP-Inhalt ins Repository `rob-sbg/spritpreis-app` kopieren und bestehende Dateien überschreiben.
2. Commit/Push durchführen und den Cloudflare-Deploy abwarten.
3. In der App unten prüfen, ob `App-Version 5.49` angezeigt wird.

Die ausgelieferte `public/index.html` enthält keine RMC-Badges oder RMC-Hinweise; `src/index.js` enthält keine RMC-Zuordnungslogik. Der Service Worker wird über `/sw.js?v=549` neu registriert und löscht alte Cache-Einträge beim Aktivieren.
