# Poolboard

Eine Webseite, mit der Nutzer:innen ausgehend von einem Zufallsobjekt aus Kulturpool Schritt für Schritt ähnliche Kulturobjekte entdecken und zu einem Board verbinden.

## Language

**Objekt**:
Ein digitalisiertes Kulturgut aus Kulturpool, identifiziert durch seine Kulturpool-ID.
_Avoid_: Bild, Item, Werk

**Startobjekt**:
Das zufällig gewählte erste Objekt einer Entdeckungsreise.
_Avoid_: Startbild, Seed

**Vorschlag**:
Ein Objekt, das zu einem gewählten Objekt als ähnlich angeboten wird.
_Avoid_: Treffer, Empfehlung

**Metadaten-Vorschlag**:
Ein Vorschlag, der inhaltlich (semantisch über Titel, Beschreibung, Künstler:in usw.) ähnlich ist.

**Bild-Vorschlag**:
Ein Vorschlag, dessen Bild dem Bild des gewählten Objekts visuell ähnlich ist.

**Verbindung**:
Die Beziehung zwischen einem hinzugefügten Objekt und dem Objekt, von dem aus es vorgeschlagen wurde; sie nennt die Art (Metadaten oder Bild) und bei Metadaten die konkret geteilten Felder (z. B. gleiche Institution).
_Avoid_: Kante, Link, Relation

**Reise**:
Eine lineare Kette aus bis zu 20 **Objekten**, die mit dem **Startobjekt** beginnt; jedes weitere **Objekt** wird aus den **Vorschlägen** des zuletzt hinzugefügten **Objekts** gewählt.
_Avoid_: Session, Pfad

**Board**:
Das Ergebnis einer beendeten **Reise**: alle hinzugefügten **Objekte** als Karten, verbunden durch ihre **Verbindungen**, mit einem editierbaren Titel.
_Avoid_: Moodboard, Sammlung

**History**:
Die lokal im Browser gespeicherte Liste aller **Boards** der Nutzer:in.
_Avoid_: Verlauf, Archiv

**Einleitung**:
Ein kurzer, von einem Sprachmodell aus den Daten des **Boards** erzeugter Begleittext mit Titel; als KI-generiert gekennzeichnet und von der Nutzer:in editierbar.
_Avoid_: Ausstellungstext, Zusammenfassung

## Relationships

- Eine **Reise** endet durch "Reise fertigstellen" oder automatisch bei 20 **Objekten** und erzeugt dann ein **Board**; eine per "Neue Reise" verlassene **Reise** wird verworfen und nicht gespeichert
- Jedes **Board** liegt in der **History**

- Eine **Reise** beginnt mit genau einem zufälligen **Startobjekt**; dieses kann vor dem ersten Hinzufügen durch ein neues Zufallsobjekt ersetzt werden
- Eine neue **Reise** kann jederzeit gestartet werden, auch mit einem per Suche gewählten **Startobjekt**; eine laufende **Reise** wird dabei nach Rückfrage verworfen
- Zu jedem gewählten **Objekt** gibt es 15 **Metadaten-Vorschläge** und 10 **Bild-Vorschläge**
- Bereits hinzugefügte oder schon angezeigte **Objekte** erscheinen nicht erneut als **Vorschlag**
- Jedes hinzugefügte **Objekt** (außer dem **Startobjekt**) hat genau eine **Verbindung** zu seinem Vorgänger in der **Reise**

## Flagged ambiguities

- "ähnlich nach Metadaten" konnte semantisch (Embedding) oder explizit (geteilte Felder) bedeuten — resolved: Vorschläge kommen semantisch aus der API, die **Verbindung** zeigt zusätzlich die geteilten Felder.
