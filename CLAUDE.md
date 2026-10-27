# Poolboard – Arbeitsanweisungen

Lies zuerst [PROJECT.md](./PROJECT.md) (Was und Warum, API, Formate) und [CONTEXT.md](./CONTEXT.md) (verbindliches Glossar). Verwende die Glossarbegriffe in UI-Texten und im Code.

## Stack

Vite, React, TypeScript (strict), Tailwind, shadcn/ui, React Flow. Kein Backend. Paketmanager: npm.

## Regeln

- Erst die Mindestanforderungen aus PROJECT.md vollständig und stabil, dann die Optional-Liste in der dort genannten Reihenfolge.
- UI-Texte und Dokumente auf Deutsch. Code, Bezeichner und Kommentare auf Englisch.
- Englische Entsprechungen der Domänenbegriffe: Objekt = `item`, Startobjekt = `startItem`, Vorschlag = `suggestion`, Metadaten-/Bild-Vorschlag = `metadata`/`image` suggestion, Verbindung = `link`, Reise = `journey`, Board = `board`, History = `history`.
- Kulturpool-API ausschließlich über einen eigenen Client in `src/api/` ansprechen; Rückgaben in eigene Typen übersetzen, UI und Logik kennen keine rohen API-Dokumente.
- Reise-Logik (Hinzufügen, Zurücknehmen, Limit 20, Ausblenden gesehener Objekte, geteilte Felder) als reine Funktionen/Reducer ohne UI-Abhängigkeit schreiben und mit Unit-Tests (Vitest) absichern.
- Persistenz (History) und Export/Import hinter kleinen Schnittstellen kapseln (`src/storage/`, `src/exchange/`); Export und Import testen, inklusive Roundtrip mit der Referenzdatei unter `docs/reference/`.
- API-Annahmen nie raten: neue Felder und Filter erst gegen echte Antworten prüfen (z. B. mit `curl`). Fehlerfälle (400 ohne Bildvektor, 429, 503, leere Ergebnisse, fehlende Bilder) sichtbar behandeln, nicht verschlucken.
- Keine Bilddateien lokal speichern, Bilder nur über URL einbinden.
- Hinzugekommene Begriffe in CONTEXT.md ergänzen; CONTEXT.md bleibt reines Glossar ohne Implementierungsdetails.
- Kleine, thematisch saubere Commits. Nur auf ausdrückliche Anfrage pushen oder veröffentlichen.

## Befehle (nach dem Gerüst hier eintragen)

```bash
npm install
npm run dev
npm run test
npm run build
```

## Verifikation

Nach jeder Funktion im Browser ausprobieren (Dev-Server starten, Reise bis zum Board durchspielen). Vor Abschluss einer Etappe: Tests und Build grün, keine Konsolenfehler im Hauptablauf.
