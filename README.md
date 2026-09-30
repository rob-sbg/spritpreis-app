# Spritpreis-App V5 – Cloudflare

Neue Funktionen:
- Preisalarm bleibt aktiv und benachrichtigt nur beim Überschreiten/Unterschreiten des Preislimits (kein 15-Minuten-Spam).
- Preisverlauf je Tankstelle/Kraftstoff, gespeichert in Cloudflare KV.
- Günstigste Tankstelle wird hervorgehoben.
- Interaktive OpenStreetMap/Leaflet-Karte.
- PWA + Web Push für iPhone Home-Screen-App.

## Deployment
1. Inhalt dieses Ordners in das GitHub-Repository `spritpreis-app` übernehmen.
2. Cloudflare Workers Build: Build-Befehl leer, Deploy-Befehl `npx wrangler deploy`.
3. `wrangler.jsonc` enthält das KV-Binding `APP_KV`. Falls du eine andere KV-Namespace-ID verwendest, dort die ID ersetzen.
4. Nach dem Deployment App auf dem iPhone neu laden.

Hinweis: Der Preisverlauf wird bei Preisabfragen und Alarmprüfungen aufgebaut. Für eine vollständige Historie braucht die App daher einige Messzyklen.


## V5.8 – Suchradius
- Suchradius 2, 5, 10, 20, 30 oder 50 km
- Radius wird lokal gespeichert
- Suche und Standortabfrage berücksichtigen den Radius
- Favoriten werden nicht durch den Radius entfernt
- Für größere Radien werden mehrere E-Control-Standortabfragen zusammengeführt und anschließend exakt nach Luftlinie gefiltert


### Radius-Suche V5.8
Die Radius-Suche verwendet mehrere geografische Abfragepunkte, da E-Control pro Koordinate nur die nächstgelegenen Tankstellen liefert. Die Ergebnisse werden zusammengeführt und anschließend exakt nach Luftlinienentfernung gefiltert.
