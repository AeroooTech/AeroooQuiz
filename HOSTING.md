# 🚀 Quiz Arena auf dem Raspberry Pi hosten (Portainer + Cloudflare Tunnel)

So machst du das Quiz unter **`quiz.aerooo.net`** für deine Freunde erreichbar – **ohne Portfreigabe** am Router. Cloudflare Tunnel baut die Verbindung von deinem Pi nach außen auf, HTTPS gibt es automatisch.

```
[Freunde] → quiz.aerooo.net → Cloudflare → (Tunnel) → cloudflared → quizgame:3000 (dein Pi)
```

---

## Voraussetzungen

- Raspberry Pi mit **Docker** und **Portainer**.
- Die Domain **`aerooo.net`** liegt bei **Cloudflare** (Nameserver auf Cloudflare gesetzt).
- Der Projektcode auf dem Pi (z. B. per `git clone`) **oder** als Portainer-Stack aus deinem Git-Repo.

---

## Schritt 1 – Cloudflare Tunnel anlegen

1. Cloudflare-Dashboard → **Zero Trust** → **Networks → Tunnels** → **Create a tunnel**.
2. Typ **Cloudflared** wählen, Namen vergeben (z. B. `quiz-pi`), **Save**.
3. Im nächsten Schritt **den Token kopieren** (der lange String hinter `--token`). Den brauchst du gleich.
4. Tab **Public Hostname** → **Add a public hostname**:
   - **Subdomain:** `quiz`
   - **Domain:** `aerooo.net`
   - **Type:** `HTTP`
   - **URL:** `quizgame:3000`
   - Speichern.

> WebSockets (für die Live-Lobbys) laufen über Cloudflare automatisch – du musst nichts extra aktivieren.

---

## Schritt 2 – Stack in Portainer deployen

1. Portainer → **Stacks → Add stack** → Name z. B. `quizarena`.
2. **Build method:**
   - **Repository:** deine GitHub-URL, Compose-Pfad `docker-compose.cloudflared.yml`, **oder**
   - **Web editor:** Inhalt von [docker-compose.cloudflared.yml](docker-compose.cloudflared.yml) einfügen.
3. Unter **Environment variables** anlegen:
   - `TUNNEL_TOKEN` = *der in Schritt 1 kopierte Token*
   - `ADMIN_PASSWORD` = *dein gewünschtes Admin-Passwort* (für das Admin-Panel – unbedingt setzen!)
4. **Deploy the stack**.

Portainer baut das Image direkt auf dem Pi (ARM-kompatibel) und startet zwei Container: `quizgame` und `quizgame-tunnel`. Die bearbeitbaren Fragen werden im Docker-Volume `quizdata` gespeichert und bleiben bei Updates erhalten.

---

## 🛠️ Admin-Panel

Erreichbar unter **`https://quiz.aerooo.net/admin`** – Login mit deinem `ADMIN_PASSWORD`.

Dort kannst du:
- **Fragen** aller Typen hinzufügen, bearbeiten und löschen (wird sofort gespeichert),
- **laufende Spiele live** sehen (Raum-Code, Modus, Fortschritt, Spieler & Punkte).

> ⚠️ Setze unbedingt ein starkes `ADMIN_PASSWORD`. Ohne gesetzte Variable nutzt der Server das unsichere Default „admin" und warnt im Log.

### 🌍 Fragen automatisch übersetzen (optional)
Beim Import aus der öffentlichen Open Trivia DB kann der Admin die englischen Fragen **automatisch ins Deutsche übersetzen** lassen (Häkchen im Import-Bereich).
- **Ohne Einrichtung:** nutzt automatisch das kostenlose **MyMemory** (gut, leicht limitiert).
- **Beste Qualität:** hinterlege die Stack-Variable `DEEPL_API_KEY` mit einem kostenlosen [DeepL-API-Key](https://www.deepl.com/pro-api) (Free-Keys enden auf `:fx`).

---

## Schritt 3 – Testen

- Öffne **https://quiz.aerooo.net** – die Startseite sollte erscheinen.
- Erstelle einen Raum, öffne den Link auf dem Handy und tritt mit dem Code bei.

---

## Updates einspielen

Neue Version bauen und neu starten:

```bash
# auf dem Pi, im Projektordner
git pull
docker compose -f docker-compose.cloudflared.yml up -d --build
```

Oder in Portainer beim Stack auf **Pull and redeploy** klicken.

---

## Fehlersuche

| Problem | Lösung |
|--------|--------|
| Seite lädt nicht | Container-Logs prüfen: `quizgame-tunnel` muss „Registered tunnel connection" zeigen. |
| 502 / Bad Gateway | Public Hostname-URL muss exakt `quizgame:3000` sein (gleicher Stack/Netzwerk). |
| Lobby verbindet nicht | Token korrekt? Beide Container im selben Netzwerk `quiznet`? |
| Bauen schlägt fehl | Auf dem Pi genug Speicher/RAM? `node:20-alpine` unterstützt arm64/armv7. |

---

## Alternative ohne Cloudflare

Lieber klassisch mit Portfreigabe + eigenem Reverse Proxy (z. B. Nginx Proxy Manager)?
Nutze [docker-compose.yml](docker-compose.yml) (Port `3000` veröffentlicht), leite im Router 80/443 auf den Pi, und richte im Proxy `quiz.aerooo.net → http://<pi-ip>:3000` mit aktiviertem **Websockets Support** ein.
