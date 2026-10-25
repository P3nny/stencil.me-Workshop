"""KI-Selbstporträt (Station „Selbstporträts mit KI neu erschaffen“).

Die iPads schicken nur ihre Auswahl aus dem Baukasten. Der Laptop baut daraus den
Prompt, fragt Claude (Anthropic) und gibt das SVG zurück. Der API-Schlüssel bleibt
auf dem Laptop:

    ANTHROPIC_API_KEY  oder  ~/.config/stencilme/anthropic-key

Das Anthropic-SDK ist die einzige Bibliothek außerhalb der Standardbibliothek. Fehlt
sie oder der Schlüssel, meldet die Station „nicht eingerichtet“ und zeigt Beispiele.
Mit STENCILME_KI_TEST=1 antwortet der Server ohne Claude (für automatische Tests).
"""
import datetime
import json
import os
import pathlib
import re
import threading

STATION_DATEI = pathlib.Path(__file__).resolve().parents[1] / "stationen" / "ki-selbstportraet.json"
SCHLUESSEL_DATEI = pathlib.Path.home() / ".config" / "stencilme" / "anthropic-key"
MODELL = os.environ.get("STENCILME_KI_MODELL", "claude-sonnet-5-5")  # Patricia, 24.10.2026: Sonnet statt Haiku
# US-Dollar pro 1 Mio. Token (Eingabe, Ausgabe), Stand Oktober 2026, nur für die Anzeige am Laptop
PREISE = {
    "claude-haiku-5-5": (0.10, 0.50),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-opus-5-5": (4.00, 20.00),
    "Test": (2.00, 10.00),  # Testmodus: rechnet wie Sonnet, damit die Anzeige etwas zeigt
}
TEST_TOKEN = (300, 2000)  # Testmodus: so tun, als hätte Claude so viele Token gebraucht
# Strom: Anthropic veröffentlicht keine Zahlen. Grobe Spanne aus öffentlichen Schätzungen für große
# Sprachmodelle (ca. 0,3 bis 3 Wh für eine Antwort mit ~500 Token): 0,5 bis 5 Wh pro 1000 Ausgabe-Token.
# Eingabe-Token kosten viel weniger Rechenzeit, sie zählen hier ein Zehntel. Nur zum Nachdenken, keine Messung.
STROM_WH_PRO_1000 = (0.5, 5.0)
PRO_TAG = int(os.environ.get("STENCILME_KI_PRO_TAG", "150"))  # Obergrenze für alle Gruppen zusammen
TEST = os.environ.get("STENCILME_KI_TEST") == "1"
TIMEOUT_S = 150  # Sonnet braucht ca. 50 s pro Bild

SYSTEM = (
    "Du bist eine Illustratorin für einen Kunst-Workshop mit Jugendlichen. "
    "Du zeichnest Porträts als SVG-Code. Antworte ausschließlich mit genau einem SVG-Element: "
    "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 400 500\"> … </svg>. "
    "Keine Erklärungen, kein Markdown, kein <script>, keine externen Bilder oder Schriften, kein Text im Bild. "
    "Zeichne eine ausdrucksstarke, farbige Illustration, die den genannten Kunststil deutlich erkennen lässt "
    "(Farben, Formen, typische Motive). Die Person ist erfunden und soll keiner echten Person ähneln."
)

TEST_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="#ff2d95"/>'
            '<circle cx="200" cy="220" r="110" fill="#f2c9a0"/><rect x="120" y="330" width="160" height="170" fill="#1e4fd6"/></svg>')

_sperre = threading.Lock()


class KiFehler(Exception):
    """Fehler mit einem Satz, den die Kinder in der App sehen."""

    def __init__(self, text, status=400):
        super().__init__(text)
        self.text = text
        self.status = status


# Freie Lücken (z. B. App-Name): nur kurze, harmlose Zeichen
FREI_RE = re.compile(r"^[A-Za-zÄÖÜäöüß0-9 !?.,:'-]+$")


def station(datei=STATION_DATEI):
    with open(datei, encoding="utf-8") as fh:
        return json.load(fh)["ki"]


def prompt_bauen(auswahl, ki=None):
    """Satz aus dem Baukasten. Auswahl-Lücken: nur Werte aus der Liste. Freie Lücken
    (art „text“): kurz, nur harmlose Zeichen, im Satz in Anführungszeichen."""
    ki = ki or station()
    texte = {}
    for baustein in ki["baukasten"]:
        wahl = str(auswahl.get(baustein["id"], "")).strip()
        if baustein.get("art") == "text":
            if not wahl or len(wahl) > baustein.get("maxLaenge", 24) or not FREI_RE.match(wahl):
                raise KiFehler("Bei „%s“ bitte kurz und nur mit Buchstaben, Zahlen und Satzzeichen." % baustein["frage"])
            texte[baustein["id"]] = "„%s“" % wahl
            continue
        option = next((o for o in baustein["optionen"] if o["id"] == wahl), None)
        if not option:
            raise KiFehler("Bitte bei „%s“ etwas auswählen." % baustein["frage"])
        texte[baustein["id"]] = option["text"]
    satz = ki["satz"]
    for _ in range(2):  # zweimal: {person} enthält selbst {alter}
        satz = re.sub(r"\{([a-z]+)\}", lambda m: texte.get(m.group(1), m.group(0)), satz)
    return satz


def schluessel():
    if os.environ.get("ANTHROPIC_API_KEY"):
        return os.environ["ANTHROPIC_API_KEY"]
    try:
        return SCHLUESSEL_DATEI.read_text(encoding="utf-8").strip() or None
    except OSError:
        return None


def eingerichtet():
    if TEST:
        return True
    try:
        import anthropic  # noqa: F401  (nur prüfen, ob installiert)
    except ImportError:
        return False
    return bool(schluessel())


def svg_reinigen(text):
    """Nur ein SVG ohne Skripte, Ereignisse und externe Verweise durchlassen."""
    treffer = re.search(r"<svg[\s\S]*</svg>", text)
    if not treffer:
        raise KiFehler("Die KI hat kein Bild geliefert. Bitte nochmal versuchen.", 502)
    svg = treffer.group(0)
    svg = re.sub(r"<script[\s\S]*?</script>|<foreignObject[\s\S]*?</foreignObject>", "", svg, flags=re.I)
    svg = re.sub(r"\son[a-z]+\s*=\s*(\"[^\"]*\"|'[^']*')", "", svg, flags=re.I)
    svg = re.sub(r"(href\s*=\s*)(\"(?!#)[^\"]*\"|'(?!#)[^']*')", r'\1"#"', svg, flags=re.I)
    if re.search(r"<script|javascript:", svg, re.I):
        raise KiFehler("Die KI hat kein Bild geliefert. Bitte nochmal versuchen.", 502)
    return svg


def erzeugen(prompt):
    """Ruft Claude auf. Rückgabe: (svg, eingabe_token, ausgabe_token, modell). Das Modell
    kann bei einer Ablehnung ein anderes sein als MODELL (Rückfall der API)."""
    if TEST:
        return TEST_SVG, TEST_TOKEN[0], TEST_TOKEN[1], "Test"
    try:
        import anthropic
    except ImportError:
        raise KiFehler("Die KI ist auf dem Laptop nicht eingerichtet.", 503)
    key = schluessel()
    if not key:
        raise KiFehler("Die KI ist auf dem Laptop nicht eingerichtet.", 503)
    client = anthropic.Anthropic(api_key=key, timeout=TIMEOUT_S, max_retries=1)
    # Lehnt das Modell eine Anfrage ab, springt die API auf ein passendes anderes Modell
    # (nur Sonnet/Opus, nur Claude API). Haiku kennt das nicht.
    rueckfall = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"} if MODELL in ("claude-sonnet-5-5", "claude-opus-5-5") else {}
    try:
        antwort = client.beta.messages.create(
            model=MODELL,
            max_tokens=16000,
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            **rueckfall,
        )
    except anthropic.RateLimitError:
        raise KiFehler("Gerade wollen sehr viele gleichzeitig ein Bild. Bitte in einer Minute nochmal.", 429)
    except anthropic.APIStatusError as err:
        # 400 bei leerem Guthaben oder erreichtem Ausgabenlimit, 401 bei falschem Schlüssel
        print("KI-Fehler %s: %s" % (err.status_code, getattr(err, "message", "")))
        raise KiFehler("Die KI ist gerade nicht erreichbar. Sagt Penny Bescheid.", 503)
    except anthropic.APIConnectionError:
        raise KiFehler("Der Laptop kommt nicht ins Internet. Sagt Penny Bescheid.", 503)
    if antwort.stop_reason == "refusal":
        raise KiFehler("Die KI wollte dieses Bild nicht zeichnen. Probiert andere Bausteine.", 422)
    text = "".join(b.text for b in antwort.content if b.type == "text")
    return svg_reinigen(text), antwort.usage.input_tokens, antwort.usage.output_tokens, antwort.model


def kosten_usd(modell, ein, aus):
    preis = PREISE.get(modell, (0, 0))
    return (ein * preis[0] + aus * preis[1]) / 1_000_000


def strom_wh(ein, aus):
    gewichtet = (aus + ein / 10) / 1000
    return [round(gewichtet * STROM_WH_PRO_1000[0], 2), round(gewichtet * STROM_WH_PRO_1000[1], 2)]


def verbrauch(modell, ein, aus):
    """Was eine Anfrage verbraucht hat: für die Anzeige an der Station."""
    return {"eingabe": ein, "ausgabe": aus, "kostenUsd": round(kosten_usd(modell, ein, aus), 5), "stromWh": strom_wh(ein, aus)}


def protokoll_lesen(protokoll_datei):
    eintraege = []
    try:
        with open(protokoll_datei, encoding="utf-8") as fh:
            for zeile in fh:
                try:
                    eintraege.append(json.loads(zeile))
                except ValueError:
                    continue
    except OSError:
        pass
    return eintraege


def status(protokoll_datei):
    eintraege = protokoll_lesen(protokoll_datei)
    heute = datetime.date.today().isoformat()
    bilder = [e for e in eintraege if e.get("art", "bild") == "bild"]
    apps = [e for e in eintraege if e.get("art") == "app"]
    return {
        "eingerichtet": eingerichtet(),
        "modell": "Test" if TEST else MODELL,
        "bilderHeute": sum(1 for e in bilder if e.get("zeit", "").startswith(heute)),
        "bilderGesamt": len(bilder),
        "appsHeute": sum(1 for e in apps if e.get("zeit", "").startswith(heute)),
        "appsGesamt": len(apps),
        "kostenGesamtUsd": round(sum(e.get("kostenUsd", 0) for e in eintraege), 4),
        "proTag": PRO_TAG,
        # Für die Auswertung: Token, Kosten und Strom-Schätzung je Station
        "arten": {art: summe(liste) for art, liste in (("bild", bilder), ("app", apps))},
        "gesamt": summe(eintraege),
    }


def summe(eintraege):
    ein = sum(e.get("eingabe", 0) for e in eintraege)
    aus = sum(e.get("ausgabe", 0) for e in eintraege)
    return {"anfragen": len(eintraege), "eingabe": ein, "ausgabe": aus,
            "kostenUsd": round(sum(e.get("kostenUsd", 0) for e in eintraege), 4), "stromWh": strom_wh(ein, aus)}


def bild_fuer_gruppe(gruppe_dir, protokoll_datei, auswahl, gruppe):
    """Prüft Grenzen, erzeugt das Bild, speichert es bei der Gruppe und im Protokoll."""
    ki = station()
    prompt = prompt_bauen(auswahl)
    dateien_dir = os.path.join(gruppe_dir, "dateien")
    with _sperre:
        bisher = len([f for f in os.listdir(dateien_dir) if f.startswith("ki-selbstportraet_")]) if os.path.isdir(dateien_dir) else 0
        if bisher >= ki["proGruppe"]:
            raise KiFehler("Ihr habt schon %d Bilder erzeugt, mehr geht nicht. Super!" % bisher, 429)
        if status(protokoll_datei)["bilderHeute"] >= PRO_TAG:
            raise KiFehler("Für heute sind alle KI-Bilder aufgebraucht. Sagt Penny Bescheid.", 429)
    svg, ein, aus, modell = erzeugen(prompt)
    jetzt = datetime.datetime.now()
    os.makedirs(dateien_dir, exist_ok=True)
    name = "ki-selbstportraet_%s.svg" % jetzt.strftime("%H%M%S%f")
    with open(os.path.join(dateien_dir, name), "w", encoding="utf-8") as fh:
        fh.write(svg)
    kosten = kosten_usd(modell, ein, aus)
    with _sperre:
        with open(protokoll_datei, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({"zeit": jetzt.isoformat(timespec="seconds"), "gruppe": gruppe, "prompt": prompt,
                                 "modell": modell, "eingabe": ein, "ausgabe": aus, "kostenUsd": round(kosten, 5)},
                                ensure_ascii=False) + "\n")
    print("KI-Bild für %s: %d + %d Token, ca. %.4f $" % (gruppe, ein, aus, kosten))
    return {"ok": True, "svg": svg, "prompt": prompt, "nr": bisher + 1, "rest": ki["proGruppe"] - bisher - 1,
            "verbrauch": verbrauch(modell, ein, aus)}
