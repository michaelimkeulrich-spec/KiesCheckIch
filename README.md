# KiesCheckIch – Family Beta (technischer Start)

Eine mobile Finanzlern-App für Jugendliche und Familien. Diese Version ist ein **nicht produktionsfreigegebener technischer Prototyp** für erwachsene Tester mit Testdaten.

**Einrichtung:** siehe [ANLEITUNG.md](ANLEITUNG.md).

Frontend: statische Dateien `index.html`, `app.js`, `style.css`.
Backend: bestehendes Supabase-Projekt; neue SQL-Tabellen und eine Edge Function `admin-api`.

**Sicherheit:** `service_role` niemals in `app.js`, GitHub oder Vercel-Frontend einfügen. Neue Registrierung ist noch nicht serverseitig geschlossen; daher keine echten Minderjährigen einladen.
