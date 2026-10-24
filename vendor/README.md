# vendor: lokale Kopien aller Bibliotheken

Damit die App ohne Internet läuft und keine Daten an CDNs gehen, liegen alle Bibliotheken, Modelle und Schriften hier.

| Ordner | Was | Version | Quelle | Lizenz |
| --- | --- | --- | --- | --- |
| `tfjs/` | TensorFlow.js | 3.11.0 | `cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.11.0/dist/tf.min.js` | Apache-2.0 |
| `body-pix/` | BodyPix (Personenerkennung) | 2.0.5 | `cdn.jsdelivr.net/npm/@tensorflow-models/body-pix@2.0.5/dist/body-pix.min.js` | Apache-2.0 |
| `body-pix/model/` | BodyPix-Modell MobileNetV1, Multiplier 0.75, Stride 16, quant2 (Foto, Stempel, Hintergrund) | – | `storage.googleapis.com/tfjs-models/savedmodel/bodypix/mobilenet/quant2/075/` | Apache-2.0 |
| `body-pix/model-050/` | BodyPix-Modell MobileNetV1, Multiplier 0.50, Stride 16, quant2 (leichter, für Video in „Körpererkennung testen“) | – | `storage.googleapis.com/tfjs-models/savedmodel/bodypix/mobilenet/quant2/050/` | Apache-2.0 |
| `qrcode/` | qrcode-generator (QR-Code auf der Laptop-Seite) | 1.4.4 | `cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js` | MIT |
| `fonts/` | Oswald, DM Sans, Courier Prime (nur latin, latin-ext) | – | Google Fonts | SIL Open Font License 1.1 |

Das Modell passt zu den Einstellungen in `stencil.html` (`getBodyPixNet`). Wer `multiplier`, `outputStride` oder `quantBytes` ändert, muss das passende Modell herunterladen.
