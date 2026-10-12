# Spritpreis-App V5.48 – ohne RMC

Diese Version entfernt die RMC-Kennzeichnung vollständig. In `public/index.html` und `src/index.js` befinden sich keine RMC-Badges, Hinweise oder Zuordnungslogik mehr.

## Wichtig beim Deploy
ZIP-Inhalt direkt in das Repository `rob-sbg/spritpreis-app` entpacken/hochladen – nicht den Ordner `v548` als zusätzliche Ebene deployen. `wrangler.jsonc` erwartet `src/index.js` und `public` im Projektstamm.

Service-Worker-Version: 548. Nach dem Deploy die App einmal vollständig schließen und neu öffnen. Falls die alte Anzeige bleibt, auf dem iPhone die Home-Screen-App schließen, Safari-Website-Daten für die Worker-Domain löschen und die PWA erneut öffnen.
