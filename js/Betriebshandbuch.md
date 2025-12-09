# Betriebshandbuch – Ausschreibungen App

## 1. Überblick
- Web-Frontend für Verwaltung von Ausschreibungen mit Login/Rollen (viewer/admin).
- Funktionen: Tabelle mit Suche/Sort/Pagination, KPIs, Neu/Edit/Delete, Bulk-Delete, Long-Text-Viewer, Export (CSV/XLS), Audit-Ansicht (Admin), Benutzer-Einladung (Admin), Verzeichnis-Links, Fälligkeits-Hervorhebung, Filter „abgelaufene + nicht abgegebene ausblenden“.
- APIs: `/api/ausschreibungen` (CRUD), `/api/ausschreibungen/export` (CSV-Dump), `/api/kpis` (KPIs), weitere: columns, by_month, auth, invite, audit.

## 2. Systemvoraussetzungen
- Postgres mit Tabelle `public.ausschreibungen`.
- Node/Next.js (App im Ordner `js/`).
- Environment: `.env.local` mit `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, optional `PGSSL=require`. `USE_MOCK=1` für Mockdaten (Testmodus).

## 3. Start & Deployment
- Lokal: im Verzeichnis `js/` `npm install`, danach `npm run dev` (Standard Port 3000).
- Produktion: Next.js Build/Start oder Hosting-Plattform; passende PG-Env-Variablen setzen.
- Auth: NextAuth; Rollen kommen aus dem Userobjekt (`role`).

## 4. Rollen
- `viewer`: lesen, keine Mutationen/Exporte/Einladungen/Audit.
- `admin`: alle Aktionen (Neu/Edit/Delete, Bulk-Delete, Export, Audit, Benutzer einladen).

## 5. UI/Bedienung
- Header: Logo, Titel, Buttons (Neu, +Benutzer, Audit, Export, Logout). Während Session-Load Placeholder.
- KPIs: Gesamt, Offen, Nächste Frist (innerhalb 7 Tagen, nicht abgegeben, Datum + Name).
- Filterleiste (unter KPIs): Zurück-Button (Seite 1), Suche in allen Spalten, Checkbox „Abgelaufene + nicht abgegebene ausblenden“ (Standard an), Zeilen pro Seite (10/50/100).
- Tabelle: Sortierbare Spalten, Checkboxen für Auswahl/Bulk-Delete, Link/Verzeichnis-Sonderdarstellung, Hervorhebung fällig/überfällig, Long-Text-Clamp + Modal, Datumsformatierung, Booleans als „Ja/Nein“.
- Pagination unten: Seiten, Bulk-Delete-Button bei Auswahl.
- Modale: Neu/Edit (Formular), Delete, Bulk-Delete, Export (CSV/XLS), Audit (Admin), Invite User (Admin), Login, Long-Text-Viewer.

## 6. Wichtige Endpunkte
- `GET /api/ausschreibungen?limit=5000` – Liste.
- `POST /api/ausschreibungen` – Neu.
- `PUT/DELETE /api/ausschreibungen/:id` – Update/Delete.
- `GET /api/ausschreibungen/columns` – Spaltenliste aus DB.
- `GET /api/ausschreibungen/export` – Vollständiger CSV-Dump (UTF‑8 BOM, Semikolon).
- `GET /api/kpis` – KPIs inkl. nächster Frist (7 Tage Fenster, ungegeben).
- Weitere: by_month, auth, invite, audit (Code einsehbar unter `js/app/api/...`).

## 7. Datenmodell (Kernfelder)
`public.ausschreibungen`: id, abgabefrist, uhrzeit, ort, name, kurzbesch_auftrag, teilnahme, bearbeiter, abgegeben (bool), vergabe_nr, link, verzeichnis, abholfrist, fragefrist, besichtigung, bewertung, zuschlagsfrist, ausfuehrung, grund_bei_ablehnung, bemerkung, created_at, updated_at.

## 8. KPIs
- Zählt Gesamt und Offen (abgegeben=false).
- Nächste Frist: ungegebene Einträge mit Datum innerhalb der nächsten 7 Tage ab heute, verschiedene Datumsformate robust geparst; nimmt erste mit Name, sonst früheste.

## 9. Export / Backup
- CSV-Dump: `GET /api/ausschreibungen/export` → Download durch Browser oder `curl -L -o ausschreibungen.csv http://<host>/api/ausschreibungen/export`.
- Kein automatisches Server-Backup integriert; für regelmäßige Backups `pg_dump`/DB-Snapshot separat einrichten.

## 10. Hinweise & Troubleshooting
- Session-Ladephase: Platzhalter im Header verhindert Layout-Shift.
- Datum-Parsing in KPIs: ISO (`YYYY-MM-DD` auch mit Zeit), deutsch (`DD.MM.YYYY/YY` auch mit Zeit).
- Filter „abgelaufen + nicht abgegebene ausblenden“ ist standardmäßig aktiv.
- Mock-Modus (`USE_MOCK=1`) liefert Testdaten und beeinflusst KPIs/Export.
