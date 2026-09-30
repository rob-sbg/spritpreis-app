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


## V5.11 – Suchradius
- Suchradius 2, 5, 10, 20, 30 oder 50 km
- Radius wird lokal gespeichert
- Suche und Standortabfrage berücksichtigen den Radius
- Favoriten werden nicht durch den Radius entfernt
- Für größere Radien werden mehrere E-Control-Standortabfragen zusammengeführt und anschließend exakt nach Luftlinie gefiltert


### Radius-Suche V5.11
Die Radius-Suche verwendet mehrere geografische Abfragepunkte, da E-Control pro Koordinate nur die nächstgelegenen Tankstellen liefert. Die Ergebnisse werden zusammengeführt und anschließend exakt nach Luftlinienentfernung gefiltert.


### V5.11: Vollständigere Radius-Suche
Zusätzlich zur Mehrpunkt-Adresssuche werden nahe politische Bezirke über die offizielle E-Control-Regionssuche abgefragt. Danach werden alle Treffer nach exakter Luftlinienentfernung zum Suchpunkt gefiltert. Damit werden in dicht besiedelten Gebieten deutlich mehr Tankstellen gefunden.


### V5.11: Ortssuche zeigt alle Treffer im Radius
Wenn eine Orts-/Adresssuche bereits Tankstellen für den gewählten Radius geladen hat, wird der Suchtext nicht nochmals als Namens-/Adressfilter angewendet. Dadurch werden z. B. bei „Hallein“ alle gefundenen Tankstellen im Radius angezeigt, nicht nur Stationen, deren Adresse selbst „Hallein“ enthält.


### V5.11: Anzeige-Diagnose und unbegrenztes Rendering
Die Liste rendert alle vom Worker gelieferten Ergebnisse ohne Pagination oder harte Obergrenze. Zusätzlich zeigt die App getrennt an, wie viele Tankstellen gefunden, intern ausgewählt und als Karten im DOM gerendert wurden. Das macht iOS-/PWA-Anzeigeprobleme unmittelbar sichtbar.
