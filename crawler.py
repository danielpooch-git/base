#!/usr/bin/env python3
"""Article-Sale-Crawler.

Prueft fuer jeden in config.yaml gelisteten Artikel, ob er inzwischen
verfuegbar/kaufbar ist, und schickt bei einem Wechsel von "nicht
verfuegbar" zu "verfuegbar" eine Push-Benachrichtigung ueber ntfy.sh.
Der letzte bekannte Status wird in state.json gespeichert (wird vom
GitHub-Actions-Workflow committet), damit Statuswechsel ueber
mehrere Laeufe hinweg erkannt werden.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import requests
import yaml
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.yaml"
STATE_PATH = ROOT / "state.json"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
}
REQUEST_TIMEOUT = 20

STATUS_AVAILABLE = "available"
STATUS_UNAVAILABLE = "unavailable"
STATUS_UNKNOWN = "unknown"


def load_config() -> dict[str, Any]:
    with CONFIG_PATH.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {}
    with STATE_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_state(state: dict[str, Any]) -> None:
    with STATE_PATH.open("w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=2, sort_keys=True)
        fh.write("\n")


def fetch_text(url: str, selector: str | None) -> str:
    response = requests.get(url, headers=REQUEST_HEADERS, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    if selector:
        element = soup.select_one(selector)
        if element is None:
            print(f"  [warn] Selektor '{selector}' nicht gefunden, pruefe gesamte Seite.")
            element = soup
    else:
        element = soup
    return element.get_text(" ", strip=True).lower()


def determine_status(page_text: str, item: dict[str, Any]) -> str:
    unavailable_keywords = [k.lower() for k in item.get("unavailable_keywords", [])]
    available_keywords = [k.lower() for k in item.get("available_keywords", [])]

    for keyword in unavailable_keywords:
        if keyword in page_text:
            return STATUS_UNAVAILABLE

    for keyword in available_keywords:
        if keyword in page_text:
            return STATUS_AVAILABLE

    return STATUS_UNKNOWN


def send_ntfy_notification(ntfy_config: dict[str, Any], item: dict[str, Any]) -> None:
    topic = os.environ.get("NTFY_TOPIC")
    if not topic:
        print("  [warn] NTFY_TOPIC ist nicht gesetzt, ueberspringe Benachrichtigung.")
        return

    server = os.environ.get("NTFY_SERVER") or ntfy_config.get("server", "https://ntfy.sh")
    url = f"{server.rstrip('/')}/{topic}"

    message = f"{item['name']} ist jetzt verfuegbar!\n{item['url']}"
    headers = {
        "Title": "Artikel verfuegbar".encode("utf-8"),
        "Priority": "high",
        "Tags": "shopping_trolley,bell",
    }

    try:
        response = requests.post(
            url,
            data=message.encode("utf-8"),
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        print(f"  [ok] ntfy-Benachrichtigung gesendet an Topic '{topic}'.")
    except requests.RequestException as exc:
        print(f"  [error] ntfy-Benachrichtigung fehlgeschlagen: {exc}")


def main() -> int:
    config = load_config()
    state = load_state()
    items = config.get("items", [])
    ntfy_config = config.get("ntfy", {})

    error_count = 0

    for item in items:
        name = item["name"]
        url = item["url"]
        selector = item.get("selector")
        print(f"Pruefe: {name} ({url})")

        try:
            page_text = fetch_text(url, selector)
        except requests.RequestException as exc:
            print(f"  [error] Abruf fehlgeschlagen: {exc}")
            error_count += 1
            continue

        status = determine_status(page_text, item)
        previous_status = state.get(url, {}).get("status", STATUS_UNAVAILABLE)
        print(f"  Status: {previous_status} -> {status}")

        if status == STATUS_UNKNOWN:
            snippet = page_text[:300]
            print(f"  [warn] Kein Keyword gefunden, Status unklar. Seitenausschnitt: {snippet!r}")

        if status == STATUS_AVAILABLE and previous_status != STATUS_AVAILABLE:
            print("  [!] Statuswechsel zu VERFUEGBAR erkannt, sende Benachrichtigung.")
            send_ntfy_notification(ntfy_config, item)

        state[url] = {"status": status, "name": name}

    save_state(state)

    if items and error_count == len(items):
        print("Alle Artikel-Abrufe sind fehlgeschlagen.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
