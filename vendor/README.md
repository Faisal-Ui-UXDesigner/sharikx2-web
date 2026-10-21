# Local barcode decoder

`zxing.min.js` is the unmodified UMD build of `@zxing/library` **0.23.0**, Apache-2.0 (see `zxing-LICENSE.txt`). Regenerate with `npm ci --ignore-scripts` then `node scripts/vendor-barcode.mjs`. The pinned dependency and lockfile track provenance; no CDN is used at runtime.

Only loaded when the browser has no native `BarcodeDetector`. Camera frames stay on the device. This upstream library is in maintenance mode; upgrades require barcode regression tests. Manual input and the existing product selector remain available independently of the decoder.

Bundled dependency license notices are retained in `ts-custom-error-LICENSE.txt` (MIT) and `text-encoding-LICENSE.txt` (Unlicense/Apache-2.0). Dependency regeneration uses Node 24+ per the upstream package engine requirement; production delivery is static JavaScript.
