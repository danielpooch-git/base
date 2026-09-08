## Termine-App

Im Ordner `app/` liegt eine installierbare Web-App ("Termine") für private und
geschäftliche Termine, To-Do-Listen und Arbeitsinfos – mit echtem App-Icon
auf dem Startbildschirm.

**Einmalig aktivieren:**
1. Repo-Settings → **Pages** → unter "Build and deployment" die Quelle
   **GitHub Actions** auswählen.
2. Diesen Branch in den Standardbranch mergen (der Deploy-Workflow
   `deploy-app.yml` läuft auf Pushes gegen den Standardbranch im Pfad `app/`).
   Danach ist die App unter der von GitHub angezeigten Pages-URL erreichbar.
3. Seite auf dem Handy öffnen → **Android/Chrome**: Button "App installieren"
   bzw. Menü → "App installieren". **iPhone/iPad (Safari)**: Teilen-Symbol →
   "Zum Home-Bildschirm".
4. In der App oben auf **"Aktivieren"** tippen, um Erinnerungen (Push-artige
   Benachrichtigungen) zu erlauben.

**Wichtig zu wissen:** Die App speichert alle Daten nur lokal auf dem
jeweiligen Gerät (kein Server, kein Sync zwischen Geräten). Erinnerungen
funktionieren zuverlässig, solange die App installiert ist und das Handy sie
zumindest gelegentlich im Hintergrund aktiv hält bzw. man sie ab und zu
öffnet – echte Server-Push-Benachrichtigungen wie bei ntfy.sh (siehe unten)
sind mit reinem GitHub-Pages-Hosting ohne eigenen Backend-Server technisch
nicht möglich.

---

# Article Sale Crawler

Prüft in regelmäßigen Abständen konfigurierte Produkt-URLs und schickt eine
Push-Benachrichtigung (über [ntfy.sh](https://ntfy.sh)), sobald ein Artikel
von "nicht verfügbar" auf "verfügbar" wechselt (z. B. wenn statt
"In Kürze verfügbar" ein "In den Warenkorb"-Button erscheint).

## Wie es funktioniert

- `crawler.py` lädt jede URL aus `config.yaml`, sucht im Seitentext nach
  `unavailable_keywords` bzw. `available_keywords` und bestimmt daraus den
  Status.
- Der letzte bekannte Status pro URL liegt in `state.json`. Ändert sich der
  Status auf "verfügbar", wird eine Benachrichtigung an ein ntfy.sh-Topic
  gesendet.
- `.github/workflows/crawler.yml` führt `crawler.py` alle 15 Minuten über
  GitHub Actions aus und committet die aktualisierte `state.json` zurück ins
  Repo, damit Statuswechsel über mehrere Läufe hinweg erkannt werden.

## Einrichtung

1. **ntfy.sh-Topic wählen**: Ein Topic ist einfach ein frei wählbarer,
   möglichst schwer zu erratender Name (z. B.
   `daniel-panini-batman-7f3a91`). Jeder, der den Namen kennt, kann die
   Nachrichten lesen – daher keinen offensichtlichen Namen wählen.
2. **App installieren**: [ntfy-App](https://ntfy.sh/#subscribe) auf dem
   Handy installieren (Android/iOS) oder die Weboberfläche nutzen, und das
   gewählte Topic abonnieren.
3. **GitHub Secret setzen**: Im Repo unter
   `Settings → Secrets and variables → Actions → New repository secret`
   ein Secret `NTFY_TOPIC` mit dem gewählten Topic-Namen anlegen.
   (Optional: Repository-Variable `NTFY_SERVER`, falls ein eigener
   ntfy-Server statt `https://ntfy.sh` genutzt werden soll.)
4. **Artikel konfigurieren**: In `config.yaml` unter `items` die zu
   überwachenden URLs eintragen. Der Batman-Artikel ist bereits als
   Beispiel hinterlegt.
5. Workflow läuft automatisch alle 15 Minuten. Manuell auslösen geht über
   den Tab **Actions → Article Sale Crawler → Run workflow**.

## Anpassen der Erkennung

Falls ein Artikel fälschlich als "verfügbar" oder "nicht verfügbar" erkannt
wird, im Actions-Log den Log-Eintrag `Seitenausschnitt` (bei unklarem
Status) bzw. den erkannten Status ansehen und `available_keywords` /
`unavailable_keywords` in `config.yaml` entsprechend anpassen. Alternativ
kann über `selector` ein CSS-Selektor angegeben werden, dessen Text
(anstelle der gesamten Seite) geprüft wird – das ist präziser, muss aber bei
Layout-Änderungen des Shops ggf. nachgezogen werden.

## Lokal testen

```bash
pip install -r requirements.txt
NTFY_TOPIC=dein-topic python3 crawler.py
```
