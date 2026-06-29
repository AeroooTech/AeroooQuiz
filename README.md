# 🧠 Quiz Arena

Ein Online-Multiplayer-Browser-Quiz mit Lobbys, **9 Spielmodi** und Sprachumschaltung **Deutsch / Englisch** während des Spiels – inklusive der **Fragen**.

> An online multiplayer browser quiz with lobbies, 9 game modes and live German/English switching (questions included).

![Stack](https://img.shields.io/badge/Node-%E2%89%A518-339933) ![Socket.IO](https://img.shields.io/badge/Socket.IO-realtime-010101) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

- **Online-Lobbys** – Erstelle einen Raum, teile den 4-stelligen Code, Freunde treten von jedem Gerät bei (Echtzeit über WebSockets).
- **9 Spielmodi:**
  | Modus | Beschreibung |
  |-------|--------------|
  | **Klassisch** | Richtige Antwort = 100 Punkte. Höchste Punktzahl gewinnt. |
  | **Schnellster gewinnt** | Je schneller die richtige Antwort, desto mehr Punkte. |
  | **Überleben / K.O.** | Eine falsche Antwort und du bist raus. Der Letzte gewinnt. |
  | **Teams** | Spieler bilden Teams, Punkte werden zusammengezählt. |
  | **Höher oder tiefer** | Zwei Dinge – wähle, was höher/größer/mehr ist. |
  | **Freitext** | Tippe die Antwort selbst ein (mit Tippfehler-Toleranz). |
  | **Schätzfrage** | Tippe eine Zahl – wer am nächsten dran ist, gewinnt die Runde. |
  | **Wahr/Falsch-Blitz** | Schnelle Ja/Nein-Runden mit Tempo-Bonus. |
  | **Doppelt oder nichts** | Setze vor jeder Frage Punkte. Richtig verdoppelt, falsch kostet. |
- **Zweisprachige Fragen (DE/EN)** – kuratierte lokale Fragen-Datenbank. Der DE/EN-Umschalter wechselt **auch die Fragetexte** live, mitten im Spiel.
- **Sprachumschaltung DE/EN** – jederzeit per Klick. Die komplette Oberfläche *und* die Fragen wechseln sofort.
- **Live-Punkte & Timer**, automatische Rundenabwicklung, Wiederverbindung-freundlich.
- **Citypop / Synthwave-Design** mit animiertem Intro, Logo, Hintergrundmusik und Lautstärke-Regler.
- **Admin-Panel** (`/admin`, passwortgeschützt): Fragen hinzufügen/bearbeiten/löschen und laufende Spiele live verfolgen.
- Fragen wählbar nach **Kategorie, Schwierigkeit und Anzahl**.

---

## 🚀 Schnellstart (lokal)

Du brauchst **[Node.js](https://nodejs.org) Version 18 oder neuer**.

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Server starten
npm start

# 3. Im Browser öffnen
#    http://localhost:3000
```

Zum Testen einfach mehrere Browser-Tabs öffnen: in einem den Raum erstellen, in den anderen mit dem Code beitreten.

**Admin-Panel:** `http://localhost:3000/admin` – Passwort über die Umgebungsvariable `ADMIN_PASSWORD` setzen (Standard lokal: `admin`):

```bash
# Windows PowerShell:  $env:ADMIN_PASSWORD="deinPasswort"; npm start
# macOS/Linux:         ADMIN_PASSWORD=deinPasswort npm start
```

Für die Entwicklung mit automatischem Neustart:

```bash
npm run dev
```

---

## 🌐 Online stellen (Hosting)

Dieses Spiel braucht einen laufenden **Node-Server** (wegen der Echtzeit-Lobbys). Reine Static-Hosts wie **GitHub Pages funktionieren dafür *nicht***. GitHub eignet sich aber perfekt, um den Code zu speichern.

### 🏠 Raspberry Pi + Portainer + eigene Domain (z. B. `quiz.aerooo.net`)
Komplette Schritt-für-Schritt-Anleitung mit **Cloudflare Tunnel** (keine Portfreigabe nötig, HTTPS automatisch): **[HOSTING.md](HOSTING.md)**.
Fertige Stacks: [docker-compose.cloudflared.yml](docker-compose.cloudflared.yml) (mit Tunnel) bzw. [docker-compose.yml](docker-compose.yml) (eigener Reverse Proxy).

### ☁️ Render.com / Railway / Fly.io (kostenloses Tier)
1. Code zu GitHub pushen (siehe unten).
2. Neuen **Web Service** aus dem Repo erstellen.
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. Der Server liest den Port aus `process.env.PORT` – die Plattform vergibt eine öffentliche URL.

---

## 📤 Auf GitHub hochladen

```bash
git init
git add .
git commit -m "Quiz Arena: Multiplayer-Quiz mit Lobbys, 4 Modi und DE/EN"
git branch -M main
git remote add origin https://github.com/<dein-name>/QuizGame.git
git push -u origin main
```

---

## 🗂️ Projektstruktur

```
QuizGame/
├── package.json          # Abhängigkeiten & Start-Skripte
├── Dockerfile, docker-compose*.yml, HOSTING.md   # Deployment (Pi/Portainer/Cloudflare)
├── server/
│   ├── index.js          # Express + Socket.IO Server, Modi, Spiel- & Admin-Logik
│   ├── questions.js      # Standard-Fragen (Seed) + Auswahl/Matching
│   ├── questionStore.js  # Beschreibbarer Fragen-Speicher (data/questions.json)
│   └── trivia.js         # Optionale Open-Trivia-DB-Anbindung (englisch)
└── public/               # Client (vom Server ausgeliefert)
    ├── index.html        # Aufbau der Oberfläche
    ├── audio/            # intro.mp3 & background.mp3
    ├── admin/            # Admin-Panel (Login, Fragen-CRUD, Live-Spiele)
    ├── css/styles.css    # Citypop-/Synthwave-Styling
    └── js/
        ├── main.js       # Client-Logik, Sockets, Intro & Musik
        └── i18n.js       # Alle UI-Texte auf Deutsch & Englisch
```

---

## ✍️ Eigene Fragen hinzufügen

**Am einfachsten über das Admin-Panel** unter `/admin` (Login mit `ADMIN_PASSWORD`): dort lassen sich Fragen aller Typen per Formular hinzufügen, bearbeiten und löschen – sie werden sofort in `server/data/questions.json` gespeichert.

Die **Standard-Fragen** (Seed) stehen zweisprachig in [`server/questions.js`](server/questions.js), nach Typ gruppiert. Beispiel für eine Multiple-Choice-Frage:

```js
{ cat: 'geography', diff: 'easy',
  prompt:  { de: 'Hauptstadt von Italien?', en: 'Capital of Italy?' },
  correct: { de: 'Rom', en: 'Rome' },
  wrong:   { de: ['Mailand', 'Neapel', 'Turin'], en: ['Milan', 'Naples', 'Turin'] } }
```

Die anderen Typen (`truefalse`, `higherlower`, `freetext`, `estimate`) sind in der Datei dokumentiert. Punkte, Modi und Timer funktionieren automatisch weiter.

---

## ⚙️ Einstellungen im Spiel

Der **Host** legt vor dem Start fest:
- Spielmodus, Kategorie, Schwierigkeit
- Anzahl der Fragen (3–50)
- Zeit pro Frage (5–60 Sekunden)

---

## 🧪 Wie das Echtzeit-Protokoll funktioniert (kurz)

Client → Server: `createRoom`, `joinRoom`, `updateSettings`, `joinTeam`, `startGame`, `submitAnswer`, `leaveRoom`
Server → Client: `roomUpdate`, `gameLoading`, `gameStarted`, `question`, `playerAnswered`, `reveal`, `gameOver`, `gameError`

---

## 📄 Lizenz

MIT – mach damit, was du willst. Quizfragen stammen von der [Open Trivia DB](https://opentdb.com) (CC BY-SA 4.0).
