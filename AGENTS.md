# ELAH Boutique — Codex operating instructions

Use the existing deployed APIs, not direct edits to product inventory in static HTML.

## Inventory writes
PATCH https://elah-boutique.vercel.app/api/inventory-update
Authorization: Bearer ${ELAH_ADMIN_TOKEN}
Content-Type: application/json

JSON body:
{"reference":"ELAH-AC076","changes":{"priceUSD":8,"size":"Única","stock":1}}

Only include fields the user explicitly requested. Allowed: priceUSD (number), size (string), stock (nonnegative integer). Confirm the exact reference before updating. Never create inventory records implicitly. The API matches exactly one row in the "Inventario" tab of the ELAH master Google Sheet. Only D, E, G are written. COP in F is a spreadsheet formula; never overwrite it. A successful response has ok:true and verified:true.

An HTTP 503 means the Google service account is not yet configured in Vercel. Do not retry blindly, change permissions, or invent credentials. The required production-only environment variables are GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY. The service account must be granted Editor access only to the master spreadsheet; enable Google Sheets API in its Google Cloud project.

## Editorial content changes
PATCH /api/content-updates with the same admin bearer token.
Body: {"reference":"ELAH-AC076","changes":{"name":"Reloj dorado","category":"Accesorios"}}
Only name, description, and category are supported. This does not modify Sheets prices or stock.

## Images
Use the existing ELAH MCP photo-publishing flow only when the OAuth connection is active, or the protected admin upload form. Always preserve product reference and verify publication before reporting success.

Never paste secrets in chat, logs, PRs or code. Do not bypass authorization. Avoid concurrent updates to the same reference; check the response and refresh inventory after a successful change.
