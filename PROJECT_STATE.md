# Projektstand – gemini-client
Stand: 23.10.2026 · Einführung der gemeinsamen Entwicklungsmethode

## Dokumentierter Stand
KI Workspace / OpenRouter-Client; README beschreibt v2.4.0 mit Stand 03.10.2026. Praktischer aktueller Test nicht neu geprüft.

Globale Regeln: https://github.com/wibem1/AI-Development-Standards/blob/main/DEVELOPMENT_STANDARDS.md

## Status und nächste Aufgabe
Kein neuer Funktionsnachweis bei dieser Dokumentationsmigration. Vor dem nächsten Entwicklungsauftrag Quellstand, vorhandene Dokumentation, Tests und Blocker prüfen; nur eine kleine Aufgabe verfolgen. Umsetzung und bestätigte Tests hier nachtragen. Keine automatische Freigabe oder Builds.

## Entwicklungsschritt 03.11.2026 – Darstellungszoom (noch nicht freigegeben)
Branch: `feature/ui-zoom-20261103` (aus `main`). Die veröffentlichte App wurde nicht verändert.

Implementiert:
- Bedienelemente − / Prozentanzeige (Klick = 100 %) / + im Kopfbereich.
- 70–150 % in Schritten von 10 %, mittels CSS-Zoom am Wurzelelement für die gesamte Oberfläche.
- Lokale Speicherung des Zoomfaktors und Wiederherstellung beim Start; ungültige Werte werden begrenzt.
- Isolierter Logiktest `tests/zoom.test.cjs` und Einbindung in `npm test`.

Prüfstatus: Quellcode und Einbindung statisch geprüft; Testdatei erstellt, aber noch nicht ausgeführt. Keine echte Browserprüfung auf iOS/Safari oder Desktop, keine Veröffentlichung.

Nächster Schritt: `npm test` ausführen, danach Zoom und Scroll-/Dialogverhalten auf iOS und Desktop im realen Browser prüfen. Erst danach über Merge und Veröffentlichung entscheiden.
