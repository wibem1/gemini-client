# KI Workspace 2.0.0

Stand: 03.10.2026. Installierbare Chat-App mit OpenRouter-Modellwahl, gespeicherten Chats, mehreren Anhängen und lokal erzeugten Ergebnisdateien.

## Benutzen

1. Die veröffentlichte App in Chrome oder Safari öffnen. Die private Veröffentlichung verlangt die Anmeldung mit dem zugehörigen ChatGPT-Konto.
2. In den Einstellungen den **OpenRouter API-Schlüssel** speichern. „Verbindung prüfen“ fragt nur Schlüsselmetadaten ab; dabei wird keine kostenpflichtige Modellantwort angefordert.
3. Anbieter und Modell wählen, eine Frage stellen und bei Bedarf Dateien über die Büroklammer anhängen.
4. Für ein Ergebnis als Datei den Dateityp im Auftrag nennen, beispielsweise „Bearbeite diesen Text und gib mir eine Word-Datei“ oder „Ändere B2 in der Excel-Datei und gib mir die bearbeitete Datei“.
5. Der Speichern-Button unter der Antwort erzeugt die fertige Datei auf dem Gerät. Die App führt vom Modell vorgeschlagene Python-/JavaScript-Programme nicht aus.

Android/Computer: Im Browsermenü „App installieren“. iPad/iPhone: Safari → „Teilen“ → „Zum Home-Bildschirm“. Der Manifest-Link sendet für die private Veröffentlichung die Anmeldung mit (`crossorigin="use-credentials"`).

## Dateiablauf

| Eingabe | Was das Modell erhält |
|---|---|
| PDF | Text nach Seiten; textarme/eingescannte Seiten zusätzlich als Bilder |
| Word DOCX | Dokumentinhalt als Text; das ursprüngliche Layout wird nicht übernommen |
| Excel XLSX | Blätter, Zelladressen, Werte, Formeln und vorhandene Ergebniswerte |
| MIDI MID/MIDI | Ereignisse mit Noten, Instrumenten, Tempo und Controllerdaten |
| PNG, JPEG, WebP, GIF | Das Bild; das Modell muss Bilder unterstützen |
| Text/Code/CSV/JSON/ABC/LilyPond/MusicXML | Vollständiger Text |

Bis zu acht Anhänge, je höchstens 16 MB. Pro Dokument höchstens 200.000 Zeichen; PDF höchstens 100 Seiten, davon höchstens zwölf eingescannte Seiten. Excel höchstens 30.000 belegte Zellen, MIDI höchstens 50.000 Ereignisse. Überschreitungen werden gemeldet; Inhalte werden nicht still gekürzt. Der Kontext des gewählten Modells begrenzt zusätzlich den gesamten Chat.

Erzeugt werden **PDF, DOCX, XLSX, MIDI und Text-/Codedateien**. PDF/Word sind neu gesetzte Dokumente mit Absätzen, Überschriften, Listen und Tabellen. XLSX kann neu erstellt oder als Kopie einer hochgeladenen Datei gezielt bearbeitet werden; dabei bleiben die übrigen Zellen und ihre Formatierungen erhalten. Excel berechnet Formeln beim Öffnen neu. MIDI-Dateien unterstützen mehrere Spuren und Akkorde.

Anhänge werden erst mit „Senden“ in den Modellauftrag aufgenommen. Ihre Originaldateien lassen sich über die Buttons am jeweiligen Benutzerbeitrag wieder speichern. Nachfolgende Nachrichten im selben Chat berücksichtigen die Anhänge weiter. Wenn ein Original fehlt, meldet die App das ausdrücklich.

Alte DOC/XLS-Dateien, Audio, Video und allgemeine ZIP-Dateien werden derzeit nicht als Modellanhang gelesen. Die PDF-Schrift deckt die üblichen lateinischen, griechischen und kyrillischen Zeichen ab; nicht alle Schriften weltweit. MIDI mit SMPTE-Zeitbasis wird abgewiesen.

## Weitere Funktionen

- Chatsuche, einzelne Chats löschen, neuer Chat und letzter geöffneter Chat.
- Persönliche Anweisungen in den Einstellungen; sie werden bei jedem Auftrag mitgesendet.
- Antworten mit formatierten Überschriften, Listen, Tabellen und Code.
- Antwortstrom, Stop und manuelles Wiederholen. Fehler und unvollständige Antworten werden nicht als vollständige KI-Antworten weitergesendet.
- Optionale Websuche über OpenRouter. Der Schalter zeigt Zusatzkosten an. Verfügbare Quellen erscheinen als Links; Antwortkosten und Tokenzahlen werden angezeigt, wenn OpenRouter sie liefert.
- Automatisch aktualisierter Modellkatalog mit Text-/Bildfähigkeiten, Kontextgröße und Preisangaben von OpenRouter.
- Entwurf im Eingabefeld und noch nicht gesendete Dateianhänge werden auf dem Gerät gemerkt.

## Speicherung und Backups

Chats, Einstellungen und der API-Schlüssel liegen im lokalen Browserspeicher. Originaldateien liegen in IndexedDB. Es gibt **keine automatische Synchronisation zwischen Geräten**. Das Löschen der Website-Daten löscht auch diese Daten.

„Backup mit Dateien speichern“ erzeugt eine ZIP-Datei mit allen Chats und deren Originalanhängen, ohne API-Schlüssel. „Backup laden“ importiert die Chats zusätzlich zu den vorhandenen Chats und legt die Originaldateien wieder an. Auch bisherige JSON-Chatbackups werden unterstützt. Bei einem reinen JSON-Backup ohne Originaldateien können fehlende Anhänge nicht wiederhergestellt werden. „Verlauf leeren“ löscht Chats und Anhangsdateien dieses Geräts.

Markdown exportiert den aktuellen Chat. Ergebnisdateien bleiben auch nach Wiederöffnen des Chats aus den gespeicherten Modellantworten erzeugbar; dafür ist kein weiterer Modellaufruf nötig.

Der Schlüssel wird ausschließlich direkt an OpenRouter gesendet. Der Service Worker verarbeitet nur eigene App-Dateien, niemals OpenRouter-Anfragen. Der Offline-Cache stellt die Oberfläche bereit; KI-Antworten und Websuche benötigen Internet. Die Dateiverarbeitung wird bei Bedarf lokal geladen.

## Was diese Version noch nicht leistet

Kein Sprachmodus, keine Bild-/Audio-/Videogenerierung, keine freie Python-Ausführung und keine geräteübergreifende Cloud-Synchronisation. Sie bietet den vollständigen Dateiablauf für die oben beschriebenen Formate, aber noch nicht jede Funktion der ChatGPT-App. Die Modelle müssen das vereinbarte Ausgabeformat für Ergebnisdateien einhalten. Die technische Dateiprüfung beurteilt nicht die inhaltliche oder musikalische Qualität.

## Entwickler

Die veröffentlichte Oberfläche ist statisch und benötigt kein eigenes API-Backend. `files.js` rendert Antworten und erzeugt MIDI-/Textdateien; `uploads.js` verwaltet Originaldateien, PDF-Import und Backups; `src/office.js` implementiert Office-/PDF-Dateien und deren Import. `office.mjs` ist das lokal mitgelieferte Browser-Bundle. Marked und DOMPurify sind unter `vendor` enthalten, PDF.js unter `vendor/pdfjs`, Schriftdateien unter `vendor/fonts`. Lizenztexte sind beigefügt.

```sh
npm ci
npm run build:files
npm test
python3 -m http.server 8000
```

Dateifunktionen werden über geschlossene Codeblöcke `file-json` beschrieben: `kind` ist `pdf`, `docx`, `xlsx`, `midi` oder `text`; die App führt die zugelassenen lokalen Dateifunktionen aus. Sie führt keine beliebigen Programme aus. Das Notenschema `midi-json` aus Version 1.1.0 bleibt kompatibel. Excel-Kopien verweisen per `sourceFileId` auf einen Originalanhang.

## Prüfung

- Automatisierter Dateiablauf: mehrere Originalanhänge, echte DOCX-/Text-Extraktion, Speicherung, Wiederöffnen, Folgeauftrag mit denselben Anhängen, Backup und Wiederherstellung mit Binärdateien, Ausschluss des API-Schlüssels aus dem Backup.
- Echte PDF-, DOCX- und XLSX-Erzeugung; DOCX/XLSX wieder eingelesen. PDF mit Umlauten, Listen und Tabelle gerendert und visuell geprüft. Das mitgelieferte PDF.js extrahiert Text und rendert die Seite.
- Unabhängiger MIDI-Parser prüft MIDI-Format, Noten, Akkorde, Spuren, Tempo und Zeitwerte.
- Chatprüfung mit simulierten OpenRouter-Antworten: Modellwahl, Systemanweisungen, Streaming, Quellen/Kosten, Websuch-Parameter, HTTP-Fehler, Wiederholen, Stop, unvollständige Antworten, Chatsuche, tatsächlicher Excel-Speichern-Button und ungeeignete Dateiformate.
- JavaScript-Syntax und Dateiverweise geprüft. Neue kostenpflichtige Modellantworten sowie die Bedienung/Installation auf echten Geräten sind noch ungetestet.

Dokumentation: https://openrouter.ai/docs/quickstart
