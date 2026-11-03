# Projektstand – gemini-client
Stand: 23.10.2026 · Einführung der gemeinsamen Entwicklungsmethode

## Dokumentierter Stand
KI Workspace / OpenRouter-Client; README beschreibt v2.4.0 mit Stand 03.10.2026. Praktischer aktueller Test nicht neu geprüft.

Globale Regeln: https://github.com/wibem1/AI-Development-Standards/blob/main/DEVELOPMENT_STANDARDS.md

## Status und nächste Aufgabe
Kein neuer Funktionsnachweis bei dieser Dokumentationsmigration. Vor dem nächsten Entwicklungsauftrag Quellstand, vorhandene Dokumentation, Tests und Blocker prüfen; nur eine kleine Aufgabe verfolgen. Umsetzung und bestätigte Tests hier nachtragen. Keine automatische Freigabe oder Builds.

## Entwicklungsschritt 03.11.2026 – Darstellungszoom (Update 2.4.1)
Branch: `feature/ui-zoom-20261103` (aus `main`). Änderung für die Übernahme in main vorbereitet.

Implementiert:
- Bedienelemente − / Prozentanzeige (Klick = 100 %) / + im Kopfbereich.
- 70–150 % in Schritten von 10 %, mittels CSS-Zoom am Wurzelelement für die gesamte Oberfläche.
- Lokale Speicherung des Zoomfaktors und Wiederherstellung beim Start; ungültige Werte werden begrenzt.
- Isolierter Logiktest `tests/zoom.test.cjs` und Einbindung in `npm test`.

Prüfstatus: Isolierter Node.js-Zoomlogiktest am 03.11.2026 erfolgreich (gleiche Testlogik lokal ausgeführt); Einbindung und Offline-Cache statisch geprüft. Vollständiges `npm test` und Browserprüfung auf iOS/Safari oder Desktop noch offen.

Nächster Schritt: Veröffentlichung auf privater ChatGPT-Site gesondert prüfen; GitHub-Merge allein aktualisiert diese Site nicht nachweislich. Browserprüfung und vollständige Tests nachholen.

## Korrektur 03.11.2026 – Eingabezeile bei vergrößertem Zoom
Branch: `fix/zoom-composer-viewport-20261103` (noch nicht veröffentlicht).

Fehlerursache: CSS-Zoom auf dem Dokument vergrößerte die 100dvh-Arbeitsfläche über den sichtbaren Viewport hinaus; das Eingabefeld wurde unten abgeschnitten.

Implementiert: CSS-Variable `--ui-zoom` synchron zur Zoomstufe; Höhe von Dokument und Workspace wird durch den Zoomfaktor geteilt, Chat-Scrollbereich erhält `min-height: 0`. Regressionstest für die Zoomvariable und strukturelle CSS-Prüfungen ergänzt.

Prüfstatus: Code und CSS auf dem Entwicklungsbranch statisch gegengeprüft. Vollständiges npm test und tatsächlicher Browsertest bei 70–150 %, verschiedenen Fensterhöhen und eingeblendeter Bildschirmtastatur noch offen. Noch keine Freigabe / Veröffentlichung; bestehende Site unverändert.

Nächster Schritt: automatisierte Tests und tatsächlichen Browserlayouttest durchführen, dann Merge und Veröffentlichung auf bestehender privater Site gesondert prüfen.

## Zusätzliche Layoutprüfung 03.11.2026
Eine isolierte Nachbildung der relevanten HTML-/CSS-Struktur wurde im echten Chromium mittels Playwright mit 1280×800, 800×600, 390×844 und 390×480 Pixel sowie 70 %, 100 %, 130 % und 150 % CSS-Zoom geprüft (16 Kombinationen). Der untere Rand des Eingabefeld-Footers stimmte jeweils mit dem Viewportrand überein, während der Chatbereich schrumpfte. Der Browser akzeptierte `calc(100dvh / 1.5)`. **Prüfumfang:** Layoutsimulation; keine vollständige echte App mit allen Header-Elementen, keine mobile Safari-/Tastaturprüfung und kein kompletter npm-Testlauf. Die Veröffentlichung auf der privaten Site ist weiterhin unbestätigt.

## Integration 03.11.2026
Zoom-Eingabezeilenkorrektur aus PR #2 in `main` integriert, Merge-Commit `16c0ff00fb47f9d58356e510d797289218269081`. Die vorhandene Version 2.4.1 bleibt bestehen; keine neue Versionsnummer vergeben. Testbeleg: Chromium-Layoutsimulation 16/16 Kombinationen erfolgreich. Vollständige App-Browserprüfung und `npm test` bleiben ausstehend. **Die bestehende ChatGPT-Site wurde durch den GitHub-Merge nicht nachweislich aktualisiert**; Veröffentlichung und Bestätigung der Site-Version gesondert erforderlich. Keine Browserdaten oder Einstellungen migrieren oder löschen.
