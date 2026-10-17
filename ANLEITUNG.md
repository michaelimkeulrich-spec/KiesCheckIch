# KiesCheckIch Family Beta – Einrichtung (Stand 17.10.2026)

## WICHTIG: Entwicklungsstand
Dieses Paket ist eine **technische Testversion**, kein freigegebener Betrieb mit Minderjährigen.
Es enthält die Grundfunktionen und serverseitig geprüfte Adminaktionen. Vor der echten Familien-Beta müssen Registrierung und Einladung atomar und serverseitig gekoppelt, Einwilligung/Sorgeberechtigung geprüft und die Löschabläufe umfassend getestet werden. Verwende bis dahin **nur erwachsene Testpersonen und Testdaten**.

## Schritt 1 – Dateien nach GitHub hochladen
1. ZIP herunterladen und auf dem Computer entpacken.
2. https://github.com/michaelimkeulrich-spec/KiesCheckIch öffnen.
3. **Add file → Upload files** auswählen.
4. Alle Dateien und Unterordner aus dem entpackten Verzeichnis hochladen. Die Ordnerstruktur muss erhalten bleiben, insbesondere `supabase/sql/` und `supabase/functions/admin-api/`.
5. Unten **Commit changes** anklicken.
6. Falls GitHub beim Hochladen der Ordner Schwierigkeiten macht, zunächst die Dateien im Hauptverzeichnis hochladen; die beiden Supabase-Dateien kannst du später über **Add file → Create new file** mit dem kompletten Pfad anlegen.

## Schritt 2 – Datenbank sichern
Supabase-Projekt: `dlvcfaplkidgcsvyiiai`.
Vor jeder SQL-Änderung ein Backup bzw. eine Wiederherstellungsmöglichkeit prüfen. Die bestehende Datenbank wird weiterverwendet, also **keine Tabellen löschen**.

## Schritt 3 – SQL einspielen
1. Supabase Dashboard → Projekt → **SQL Editor → New query**.
2. Datei `supabase/sql/01_family_beta.sql` öffnen und Inhalt einfügen.
3. **Run** klicken. Fehler vollständig notieren, nicht mehrfach blind ausführen.
4. Im Table Editor prüfen: `kc_families`, `kc_family_parents`, `kc_family_children`, `kc_invitations`, `kc_feedback`, `kc_admin_audit`, `kc_allowances`, `kc_child_setups`.
5. Die Migration setzt die bestehenden Tabellen `app_admins`, `transactions`, `savings_goals`, `budgets`, `transaction_categories` voraus.

## Schritt 4 – Edge Function einrichten
1. Supabase → **Edge Functions** → neue Function `admin-api` anlegen.
2. Inhalt aus `supabase/functions/admin-api/index.ts` übernehmen und deployen. Alternativ mit Supabase CLI deployen.
3. JWT-Prüfung für die Function aktiviert lassen.
4. Für die Function das Secret `APP_ORIGIN` auf die **neue** Vercel-URL setzen (z. B. `https://kiescheckich-....vercel.app`, ohne abschließenden Slash). `SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase üblicherweise in der Edge-Function-Umgebung bereit; überprüfen, **niemals** im GitHub-Frontend eintragen.
5. Nach dem ersten Deployment CORS prüfen. Bei geändertem Origin `APP_ORIGIN` aktualisieren.

## Schritt 5 – Neue Vercel-App erstellen
1. Vercel Dashboard → **Add New → Project**.
2. GitHub-Repository `michaelimkeulrich-spec/KiesCheckIch` importieren.
3. Framework **Other**; Root Directory `./`; Build Command leer; Output Directory leer lassen (statische Dateien im Projektwurzelverzeichnis).
4. **Deploy** anklicken.
5. Neue URL notieren und `APP_ORIGIN` der Supabase-Function darauf setzen.
6. Supabase → Authentication → URL Configuration: neue URL als erlaubte Redirect-URL ergänzen. Bestehende URL nicht entfernen.

## Schritt 6 – Mit erwachsenen Testkonten prüfen
1. Bestehenden Admin anmelden. Der Admin-Reiter muss sichtbar sein.
2. Eine erwachsene Testperson mit bestätigter E-Mail verwenden.
3. Admin erstellt Einladung für deren E-Mail. Link privat weitergeben.
4. Testperson meldet sich an und löst die Einladung ein. Elternkonto wird erstellt.
5. Elternkonto erstellt Einladung für ein **zweites erwachsenes Testkonto**. Dessen Geburtsdatum korrekt eingeben. **Die Finanzübersicht der Eltern ist absichtlich nur für Minderjährige freigegeben und daher mit erwachsenen Testkonten nicht vollständig testbar.** Für die Rechteprüfung ist ein gesonderter, rechtlich geprüfter Testaufbau erforderlich.
6. Buchungen, Sparziele, Feedback und Admin-Statusänderungen testen.
7. Löschfunktionen **ausschließlich mit eigens angelegten Wegwerf-Testkonten** testen.

## Grenzen dieser ersten Version
- **Öffentliche Supabase-Sign-ups müssen vor echter geschlossener Beta serverseitig verhindert werden.** Die Registrierung ist aktuell nur im Frontend an einen Link gebunden und lässt sich über die Auth-API umgehen. Nicht als wirksame Zugangssperre betrachten. Eine serverseitige Registrierung mit Einladungsprüfung folgt vor dem echten Pilot.
- Einladungen sind 7 Tage gültig, an eine bestätigte E-Mail gebunden und als Hash gespeichert. Das Einlösen ist noch **nicht vollständig transaktionssicher** bei parallelen Aufrufen.
- Persönliche Einladung wird als **kopierbarer Link** erstellt, nicht automatisch per E-Mail versendet.
- Die Eltern-Ersteinrichtung ist nur einmal vorgesehen; bei Teilausfällen muss ein Admin korrigieren. Die Vorgänge sind noch nicht vollständig transaktional.
- Löschen über die Edge Function ist administrativ geschützt, aber mehrstufig und noch nicht atomar. Keine rechtliche Zusage einer vollständigen Löschung von Backups oder externen Logs.
- Feedback ist nutzerbezogen; die Beta-Auswertung ist bewusst zunächst einfach.
- Kein produktiver Minderjährigenbetrieb ohne rechtliche Prüfung, sichere Sorgeberechtigtenprüfung, Datenschutzinformation und getestete Berechtigungen.

## Fehlerdiagnose
- **Admin-Reiter fehlt:** Benutzer nicht in `public.app_admins` oder Anmeldung erneuern.
- **Function 401:** Supabase-Session / JWT prüfen.
- **Function 403:** Admin- oder Elternberechtigung fehlt.
- **CORS-Fehler:** `APP_ORIGIN` stimmt nicht mit Vercel-URL überein.
- **Tabellen nicht gefunden:** SQL nicht ausgeführt oder Schema-Cache / Grants prüfen.
- **Eltern sehen keine Kinderfinanzen:** Nur verknüpfte Minderjährige und nur SELECT-Berechtigung.

## Reihenfolge der nächsten Entwicklungsstufe
1. Einladungsgesteuerte Registrierung vollständig serverseitig absichern.
2. Einladungseinlösung und Ersteinrichtung transaktionssicher machen.
3. Namen/Spitznamen, Rechte- und Altersübergang, Einwilligungsprozesse ergänzen.
4. Löschabläufe mit vollständiger Abhängigkeitsanalyse und Audit testen.
5. UX-Tests, Feedback-Auswertung, geschlossene Pilotfreigabe.
