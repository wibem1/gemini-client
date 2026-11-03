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

## Veröffentlichungsprüfung 03.11.2026
- Vollständiges `npm test` erfolgreich; fehlerhaft doppelt maskierte reguläre Ausdrücke im Zoomtest korrigiert (keine Änderung des App-Verhaltens).
- Vollständige App in Chromium geprüft: 150 % Zoom, Viewport 1363×936; Eingabefeld vollständig sichtbar (Unterkante 926 px), Senden-Button sichtbar. Zoom bleibt nach Neuladen bei 150 %.
- Veröffentlichung auf bestehender owner-privater Site `appgprj_6ac0ecbb1140819190dd30a72a2cddca` vorbereitet. Gleiche URL und Speicherschlüssel; keine Löschung oder Migration von localStorage/IndexedDB. Prüfung betrifft Desktop-Chromium, nicht mobile Safari/Bildschirmtastatur.

## Veröffentlichung abgeschlossen 03.11.2026
Sites bestätigt `succeeded`: https://gemini-client-chat.wibem1.chatgpt.site . Veröffentlichter Hosting-Commit `73c27ec60abe136d96ccec557adcaa2243a6a0f5`, App-Version 2.4.1 mit Zoomkorrektur. Bestehende Site und privater Zugriff beibehalten. Live-Aufruf zeigt erwartete Anmeldung; 150-%-Layoutprüfung erfolgte zuvor an denselben vollständigen App-Dateien in der lokalen Browservorschau. Kein Zugriff auf die Browserdaten des Benutzers und keine Datenlöschung.

## MIDI-Importkorrektur 03.11.2026
Ursache: 11.743 Bytes große Erlkönig-Datei mit 3.323 Ereignissen wurde zu 532.694 Zeichen formatiert und an der 200.000-Zeichen-Grenze abgewiesen. Kompakte verlustfreie Ereignistabelle mit gemeinsam beschriebenen Feldlayouts und ganzzahligen absoluten Ticks: 69.030 Zeichen. Alle Ereignisse, Felder, Spurzuordnungen und Tickpositionen gegen den Originalparser geprüft. Keine Noten-/Controllerfilterung, keine Änderung der Benutzerspeicherung. Vollständiges npm test vor Integration erfolgreich; neuer Regressionstest mit über 3.400 Ereignissen ebenfalls erfolgreich. Keine kostenpflichtige Modellanfrage. Version 2.4.1 bleibt bestehen; Hosting-Veröffentlichung folgt.

## Update 2.4.2 – eindeutiger Stand und erneutes Laden (03.11.2026)
Korrigiertes Dateimodul wird über `office.mjs?v=2.4.2` geladen; versionsgebundene Script-Adressen und neuer Offline-Cache verhindern Wiederverwendung des alten Importmoduls. Sichtbare Version 2.4.2 und eigener Button „App neu laden“. Der bisherige ↻-Button aktualisiert nur den Modellkatalog. Keine Änderung der Speicherkennungen oder Benutzerbestände. Vollständige automatisierte Tests und Original-Erlkönig-Import erfolgreich (69.030 Zeichen, alle Ereignisse und Ticks geprüft). Browservorschau zeigt 2.4.2; Upload in der HTTP-Vorschau scheitert bereits an fehlendem crypto.randomUUID (unsicherer Kontext), daher kein erfolgreicher Uploadnachweis in dieser Vorschau. Produktionsadresse ist HTTPS. Veröffentlichung folgt.

2.4.2 veröffentlicht: Sites-Deployment `appgdep_6aea24dfadfc819192fe79035117d65e` bestätigt succeeded, Hosting-Commit `4d2b720feed31019d27d64229d8d69229e883b49`, bestehende private URL https://gemini-client-chat.wibem1.chatgpt.site . Erfolgreicher Produktionsupload durch Benutzer noch unbestätigt.
