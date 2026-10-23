# HTTPS einrichten: `workshop.datenhandlung.de`

Diese Anleitung führst du selbst auf dem Ubuntu-Rechner aus. Die INWX-Zugangsdaten bleiben auf dem Rechner und kommen **nie ins Repo**.

Warum: Safari gibt die Kamera im Browser nur über HTTPS frei (siehe [entscheidungen.md](entscheidungen.md), Punkt 2).

---

## A. Einmalig: Zertifikat holen (braucht Internet)

### 1. `acme.sh` installieren

```bash
git clone https://github.com/acmesh-official/acme.sh.git ~/acme.sh-src
cd ~/acme.sh-src
./acme.sh --install -m DEINE-MAIL@example.de
cd ~ && rm -rf ~/acme.sh-src
```

Danach das Terminal neu öffnen. `acme.sh --version` muss eine Versionsnummer zeigen.

### 2. INWX-Zugang hinterlegen

Tipp: Bei INWX ein eigenes Unterkonto anlegen, das nur DNS ändern darf, und dieses hier verwenden.

```bash
export INWX_User="DEIN-INWX-BENUTZER"
read -s -p "INWX-Passwort: " INWX_Password; echo; export INWX_Password
# nur wenn 2-Faktor-Anmeldung aktiv ist:
# read -s -p "INWX 2FA-Secret: " INWX_Shared_Secret; echo; export INWX_Shared_Secret
```

`read -s` sorgt dafür, dass das Passwort nicht in der Befehls-Historie landet. `acme.sh` speichert die Daten danach selbst in `~/.acme.sh/account.conf`, die Datei kann nur dein Benutzer lesen.

### 3. Zertifikat holen

```bash
acme.sh --issue --dns dns_inwx -d workshop.datenhandlung.de --server letsencrypt
```

Das dauert 1–2 Minuten, weil `acme.sh` auf den DNS-Eintrag wartet.

### 4. Zertifikat an festen Ort kopieren

```bash
mkdir -p ~/stencilme-zertifikat
acme.sh --install-cert -d workshop.datenhandlung.de \
  --key-file       ~/stencilme-zertifikat/key.pem \
  --fullchain-file ~/stencilme-zertifikat/fullchain.pem
chmod 600 ~/stencilme-zertifikat/key.pem
```

---

## B. Zu Hause testen (Heim-WLAN, ohne eigenen Router)

### 1. IP des Ubuntu-Rechners herausfinden

```bash
hostname -I
```

Die erste Adresse nehmen, z. B. `192.168.178.42`.

### 2. DNS-Eintrag bei INWX

INWX → Domain `datenhandlung.de` → Nameserver-Einträge → neuer Eintrag:

| Name       | Typ | Wert             | TTL  |
| ---------- | --- | ---------------- | ---- |
| `workshop` | A   | `192.168.178.42` | 300  |

Bei einer Fritzbox kann der **DNS-Rebind-Schutz** den Eintrag blockieren, weil er auf eine private Adresse zeigt. Dann: Fritzbox → Heimnetz → Netzwerk → Netzwerkeinstellungen → DNS-Rebind-Schutz → `workshop.datenhandlung.de` als Ausnahme eintragen.

### 3. Testserver starten

```bash
cd ~/00_art/stencil.me/00_workshop
python3 docs/https-testserver.py \
  --cert ~/stencilme-zertifikat/fullchain.pem \
  --key  ~/stencilme-zertifikat/key.pem
```

Falls die Ubuntu-Firewall aktiv ist: `sudo ufw allow 8443/tcp`.

### 4. Auf dem iPad öffnen

`https://workshop.datenhandlung.de:8443/docs/ipad-test.html`

Zum Vergleich ohne HTTPS: `python3 -m http.server 8000`, dann `http://192.168.178.42:8000/docs/ipad-test.html`.

---

## C. Im Workshop (eigener Router, kein Internet)

Ohne Internet findet das iPad den öffentlichen DNS-Eintrag nicht. Darum beantwortet ein lokaler DNS die Frage nach `workshop.datenhandlung.de`.

**Weg 1 (einfacher, wenn der Router es kann):** Im Router einen lokalen DNS-Eintrag anlegen (heißt oft „Hostnames“, „Custom DNS“ oder „Lokale DNS-Einträge“): `workshop.datenhandlung.de → 192.168.8.10`.

**Weg 2: `dnsmasq` auf dem Ubuntu-Rechner**

```bash
sudo apt install dnsmasq
sudo tee /etc/dnsmasq.d/stencilme.conf >/dev/null <<'EOF'
listen-address=192.168.8.10
bind-interfaces
no-resolv
address=/workshop.datenhandlung.de/192.168.8.10
EOF
sudo systemctl restart dnsmasq
```

Danach im Router bei DHCP als DNS-Server `192.168.8.10` eintragen. Die iPads müssen das WLAN einmal neu verbinden.

`192.168.8.10` ist ein Beispiel. Es muss die feste IP des Ubuntu-Rechners im Workshop-WLAN sein.

---

## D. Vor jedem Workshop (zu Hause, mit Internet)

Das Zertifikat gilt 90 Tage. `acme.sh` erneuert es automatisch, aber nur, wenn der Rechner läuft und Internet hat.

```bash
acme.sh --list                     # Spalte "Renew" zeigt das nächste Erneuerungsdatum
acme.sh --renew -d workshop.datenhandlung.de --force   # bei Bedarf sofort erneuern
```

Am Ende müssen bis zum Workshop-Tag noch **mindestens 14 Tage** Gültigkeit übrig sein.
