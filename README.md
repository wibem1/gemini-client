# KI Workspace 1.1.0

Stand: 03.10.2026. Installierbarer Chat mit den über OpenRouter verfügbaren Text-/Chatmodellen. Kein Build und kein eigener API-Proxy erforderlich. Markdown wird mit lokal mitgeliefertem Marked und DOMPurify dargestellt.

## Start

Die Dateien über HTTPS bereitstellen. In den Einstellungen einen **OpenRouter API-Schlüssel** eintragen, „Verbindung prüfen“ drücken und speichern. Ein Schlüssel von Google, Anthropic oder OpenAI direkt funktioniert hier nicht. Die Prüfung fragt nur die OpenRouter-Schlüsselmetadaten ab und fordert keine kostenpflichtige Modellantwort an.

Anbieter und Modell wählen und eine Nachricht senden. Die Liste wird bei jedem Start von OpenRouter aktualisiert. Für einen neuen Chat das Menü öffnen. Die bisherigen Chats bleiben auf dem jeweiligen Gerät gespeichert. Das Feld „Zusätzliche Angaben an die KI“ wird bei jeder Modellanfrage als Systemnachricht mitgesendet.

Android/Computer: Im Browsermenü „App installieren“. iPad/iPhone: In Safari „Teilen“ → „Zum Home-Bildschirm“. Die installierte App öffnet ohne Browserleiste. Der Offline-Cache stellt die Oberfläche bereit; neue KI-Antworten benötigen Internet.

Die Oberfläche und die Chats enthalten Bilder und Textdateien als Anhänge. PDF, Audio, Video und Office-Dateien werden nicht als Text eingelesen. Bildanhänge erfordern ein Modell mit Bildunterstützung. Modellwechsel innerhalb eines Chats übernimmt dessen Verlauf.

## Speicherung und Export

Schlüssel, zusätzliche Angaben, Modellauswahl und Chats liegen im lokalen Browserspeicher dieses Geräts. Es gibt keine automatische Synchronisation zwischen Geräten. Das Löschen der Website-Daten löscht auch diese Angaben. Markdown exportiert den aktuellen Chat; JSON exportiert alle Chats ohne API-Schlüssel. Sehr große Anhänge können die Speichergrenze überschreiten; die App meldet das.

Der API-Schlüssel geht ausschließlich direkt an `https://openrouter.ai/api/v1/`. Er ist weder im Repository eingebaut noch Bestandteil des Exports. Der Service Worker verarbeitet nur die eigenen statischen App-Dateien, keine OpenRouter-Anfragen.

## Behobene Fehler

- Manifest in HTML eingebunden; Service Worker registriert; tatsächlich vorhandene PNG-Icons in 192 und 512 Pixeln verlinkt.
- Veraltete fest verdrahtete Modellliste durch automatisch aktualisierten Katalog ersetzt. Eine vom 03.10.2026 abgerufene Liste dient als Offline-Fallback.
- Gespeicherte Modellauswahl wird beim Start und Aktualisieren berücksichtigt.
- Chatverlauf und mehrere Chats werden gespeichert und nach Neustart wieder angezeigt.
- Textantworten erscheinen während der Generierung. Abbruch und manuelles Wiederholen sind möglich. Keine automatische kostenpflichtige Wiederholung.
- HTTP-Fehler sowie Fehler innerhalb einer erfolgreichen HTTP-Antwort werden angezeigt. Zugangs-, Guthaben- und Limitfehler werden erklärt. Unvollständige Antworten sind markiert und werden nicht als vollständige KI-Antworten weitergesendet.
- UI-Fehlermeldungen werden nicht in den nächsten KI-Auftrag übernommen.
- Bilddaten werden als Bilder statt als roher JSON-Text dargestellt; ungeeignete Dateiformate und Modelle werden vor dem Senden abgefangen.
- Eingabefelder haben mindestens 16 Pixel Schriftgröße; die Viewport-Einstellung erlaubt Vergrößerung. Die Kopfzeile bricht auf kleinen Bildschirmen um.

Die Ursache der ursprünglich gemeldeten Zugangsverweigerung ist ohne die damalige Fehlermeldung nicht gesichert. Die bisherige Chat-URL und das Bearer-Format waren korrekt. HTTP 401/402/403 lassen sich durch PWA-Dateien allein nicht beseitigen; die neue Verbindungsprüfung macht die tatsächliche Ablehnung sichtbar.

## Prüfung dieser Version

JavaScript-Syntax geprüft. Automatisierte DOM-Tests mit simulierten OpenRouter-Antworten bestanden: Modellabruf, Schlüsselprüfung, vollständiges Streaming einschließlich unterbrochener Datenblöcke, gespeicherte Auswahl und Chats, mehrere Chats, 403 und manuelles Wiederholen, abgebrochene Antworten, Fehler bei HTTP 200, Stop, Bildunterstützung, ungeeignete Datei, Netzwerkfehler und Löschen des Verlaufs. Manifest und Icon-Dateien geprüft. Der öffentliche OpenRouter-Modellabruf war erreichbar.

Eine bezahlte Modellanfrage mit dem persönlichen API-Schlüssel wurde nicht getestet. Eine visuelle Prüfung auf echten Geräten und die tatsächliche Installation sind noch offen; in der Arbeitsumgebung war kein Testbrowser verfügbar.

## Lokal entwickeln / GitHub Pages

Zum lokalen Start beispielsweise `python3 -m http.server 8000` aus diesem Verzeichnis ausführen und `http://localhost:8000` öffnen. `file://` aktiviert keinen Service Worker. Für GitHub Pages kann der Repository-Hauptzweig mit dem Wurzelverzeichnis als Quelle verwendet werden; alle Assetpfade sind relativ.

OpenRouter-Dokumentation: https://openrouter.ai/docs/quickstart

## Korrektur 1.0.1

Der Manifest-Link verwendet `crossorigin="use-credentials"`. Das ist bei der privaten, anmeldegeschützten Veröffentlichung erforderlich: Der normale Manifestabruf sendet sonst keine Anmeldung mit und erhält HTTP 401. Der Service-Worker-Cache ist für diese Version erneuert. Eine tatsächliche Android-Installation muss noch auf dem Gerät geprüft werden.

## Dateien und formatierte Antworten – 1.1.0

Markdown-Antworten werden mit Überschriften, Listen, Tabellen und Codeblöcken dargestellt. Marked und DOMPurify sind lokal im Verzeichnis `vendor` enthalten; Lizenztexte sind beigefügt. Generierter Code wird nicht ausgeführt.

Die App informiert das Modell bei jedem Auftrag über ihre Dateifunktionen. Geschlossene Codeblöcke mit einer unterstützten Sprache bekommen einen Speichern-Button. Für einen gewünschten MIDI-Download liefert das Modell einen `midi-json`-Block mit Tempo, Taktart, Spuren und vollständigen Notendaten. `files.js` erzeugt daraus lokal eine Standard-MIDI-Datei (Format 1, 480 Ticks pro Viertelnote). Akkorde und mehrere Spuren werden unterstützt. MIDI-Nummern und Instrumentprogramme werden ab 0 gezählt. Nicht plausible Daten führen zu einer Fehlermeldung statt einem falschen Download.

PDF, DOCX und Audio werden weiterhin nicht erzeugt. Bereits vorhandene Python-Antworten werden nicht automatisch zu MIDI; dafür muss der Auftrag erneut gesendet werden. Da Code und Notendaten im Chat gespeichert sind, erscheinen Speichern-Buttons nach dem Wiederöffnen erneut. Das Modell muss das vereinbarte Ausgabeformat einhalten; die App kontrolliert die Daten, nicht die musikalische Qualität.

Zusätzlich getestet mit einem unabhängigen MIDI-Parser: Format und Spurenzahl, Tempo, 6/8-Taktart, Akkorde, Note-on/off-Zahl, exakte Notenzeiten und Instrumentdaten. DOM-Tests prüfen Markdown, MIDI-Downloadbytes, Download-Buttons nach Wiederöffnen, unvollständige Antworten, fehlerhafte Daten und HTML-Filterung. Die bisherigen Chat-Tests bestehen weiterhin. Eine neue kostenpflichtige Modellantwort und reale Geräte wurden nicht getestet.
