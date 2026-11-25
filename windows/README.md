# Claude Code unter Windows

Die Windows-Bridge verbindet KI Workspace mit der unveränderten, separat installierten Anthropic-CLI. Unterstützt werden lokal freigegebene GitHub-Arbeitskopien, Start, Aktivitätsanzeige, Abbruch und Folgeaufträge in derselben Claude-Sitzung.

## Einrichtung

1. Installiere Node.js 24, Git für Windows und [Claude Code für Windows](https://code.claude.com/docs/en/setup). Melde dich eigenständig über `claude auth login` an. Die Bridge übergibt keine Anbieter-API-Schlüssel aus der Umgebung.
2. Installiere das Windows-Paket aus dem GitHub-Actions-Lauf. Kopiere `projects.example.json` aus dem Installationsordner nach `%LOCALAPPDATA%\KI Workspace Bridge\projects.json`. Trage die absoluten Pfade zur nativen `claude.exe`, zu `git.exe` und zu deinen lokalen GitHub-Checkouts ein. JSON verlangt doppelte Backslashes.
3. Starte **KI Workspace Bridge** aus dem Startmenü und lass das Fenster geöffnet. Öffne in der bestehenden KI Workspace das Menü **Softwareentwicklung**, gib den angezeigten Kopplungscode ein und klicke auf **Verbinden**. Erlaube gegebenenfalls in Chrome oder Edge den Zugriff auf das lokale Netzwerk.
4. Wähle den Checkout und starte einen Auftrag. Folgeaufträge nutzen **Fortsetzen**. Mit **Auf GitHub öffnen** erreichst du das zugehörige Repository.

## Verhalten

- Vor jedem Start verifiziert die Bridge das Git-Wurzelverzeichnis und das zugehörige GitHub-`origin`. Verwende einen separaten Checkout oder Entwicklungsbranch. Änderungen sind lokal zu prüfen, zu testen, zu committen und zu pushen.
- Erlaubt sind Lesewerkzeuge und Dateiänderungen. Shell, MCP und Browser bleiben deaktiviert. Der Prozess läuft mit den Rechten des angemeldeten Windows-Benutzers. Das ist keine Betriebssystem-Sandbox. Nutze vertrauenswürdige Checkouts sowie ein Windows-Konto mit Zugriff auf die tatsächlich benötigten Daten. Claude kann Projektinhalte an Anthropic übertragen.
- Ein Auftrag gleichzeitig, höchstens 20 Claude-Turns und 30 Minuten pro Aufruf. Die App zeigt Zustand und die letzten 24.000 Ausgabezeichen. Abbruch beendet den lokalen CLI-Prozess. Bereits erfolgte Dateiänderungen und übertragene Anfragen bleiben bestehen. Fortsetzen erfordert eine von Claude bestätigte Sitzungs-ID.
- Der Kopplungscode wird bei jedem Bridge-Start neu erzeugt. Die WebApp hält ihn nur im Arbeitsspeicher. Die Bridge bindet ausschließlich IPv4-Loopback und akzeptiert die festgelegte private Site. Auftragsliste und Fortschritt liegen im Arbeitsspeicher der Bridge. Nach einem Neustart dürfen CLI-Sitzungen weiterhin lokal bei Claude vorhanden sein.
- Die Integration steuert lokale Windows-Sitzungen. Anthropic bietet eigenständige Cloud-Sitzungen mit eigenen Zugangs- und Organisationsvoraussetzungen an. Eine Cloud- oder Hybridsteuerung wurde für diese App nicht verifiziert. [Anthropic-Dokumentation](https://code.claude.com/docs/en/claude-code-on-the-web)
