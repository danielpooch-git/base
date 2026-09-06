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
