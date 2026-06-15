# CSV Tools — Amplience Workforce Extension

A set of Amplience [Workforce](https://amplience.com/developers/docs/workforce/flows/) actions for working with CSV and tabular data inside automation flows. Parse a CSV into structured rows, shape and validate that data, and serialise it back out — all without writing custom flow logic.

Every action is pure data-shaping JavaScript: it makes **no external API calls**, so each one runs comfortably within the Workforce sandbox limits (30s runtime, 10 API requests, 128MB RAM). A typical pipeline parses a CSV, cleans and validates the rows, then either writes a new CSV/JSON or hands batches off to an API-posting action elsewhere in the flow.

## Actions

| Action | Label | Input → Output |
| --- | --- | --- |
| `parseCsv` | Parse CSV to rows | `{ csv, delimiter? }` → `{ rows, count }` |
| `arrayToCsv` | Save to CSV | `{ rows, columns?, delimiter? }` → `{ csv, count }` |
| `filterRows` | Filter rows | `{ rows, column, operator?, value? }` → `{ rows, count, removed }` |
| `mapColumns` | Rename columns | `{ rows, mapping, dropUnmapped? }` → `{ rows, count }` |
| `selectColumns` | Select columns | `{ rows, columns }` → `{ rows, count }` |
| `transformRows` | Clean and coerce rows | `{ rows, trim?, numericColumns?, booleanColumns?, emptyDefault? }` → `{ rows, count }` |
| `chunkRows` | Chunk rows into batches | `{ rows, size? }` → `{ chunks, chunkCount, rowCount }` |
| `validateRows` | Validate rows | `{ rows, required }` → `{ valid, invalid, validCount, invalidCount }` |
| `dedupeRows` | Deduplicate rows | `{ rows, key }` → `{ rows, count, duplicatesRemoved }` |
| `toJson` | Rows to JSON | `{ rows, pretty? }` → `{ json, count }` |
| `fromJson` | JSON to rows | `{ json }` → `{ rows, count }` |
| `summarizeRows` | Summarize rows | `{ rows, columns? }` → `{ rowCount, columnCount, columns }` |

### Notes on the data model

- **Rows** are represented as an array of plain objects keyed by the CSV header row, e.g. `[{ "sku": "ABC-1", "price": "9.99" }, ...]`.
- Workforce requires action input and output **roots to be objects**, so array results are always wrapped (e.g. `{ "rows": [...] }`) rather than returned bare.
- CSV values are read as **strings**. Use `transformRows` to coerce numeric/boolean columns before sending data to a typed API.

### filterRows operators

`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `empty`, `notEmpty`. Numeric operators parse cells with `parseFloat`; the rest compare as strings.

## Example pipeline

A flow that ingests a product CSV and prepares it for an external API:

1. **Parse CSV to rows** — turn the raw CSV string into `rows`.
2. **Clean and coerce rows** — trim whitespace, convert `price` to a number and `inStock` to a boolean.
3. **Rename columns** — map `product_sku` → `sku` to match the API contract.
4. **Validate rows** — require `sku` and `price`; split into `valid` / `invalid`.
5. **Deduplicate rows** — drop repeats by `sku`.
6. **Chunk rows into batches** — split into batches of 10 to stay under the per-run API request limit.
7. *(Downstream)* loop the batches into your own API-posting action.

## Repository contents

| File | Purpose |
| --- | --- |
| `index.js` | Extension implementation. Each exported function is one action. |
| `manifest.json` | Declares the actions, with input/output schemas, for Workforce. |
| `csv-icon.svg` | Extension icon (Amplience-style navy + pink). |
| `csv-icon-base64.txt` | The icon as a `data:image/svg+xml;base64,...` string for the create-extension dialog. |

## Installing on a hub

The code is plain JavaScript conforming to the [Minimum Common Web Platform API](https://min-common-api.proposal.wintertc.org) standard, so **no build or bundling step is required** — paste `index.js` directly.

1. In Workforce, open **Integrations → Create extension**.
2. Enter a label (e.g. `CSV Tools`), a markdown description, a docs URL, and the icon from `csv-icon-base64.txt`.
3. Create a **release**: give it a version (e.g. `0.1.0`), upload `manifest.json`, and paste `index.js` into the code field.
4. **Install** the release on your hub and give the instance a label. There are no environment variables to configure.
5. The actions appear in the Action Library under the **Integrations → CSV Tools** folder.

To update later, publish a new release (e.g. `0.2.0`) rather than editing the live one. Extensions can also be installed via the [GraphQL Management API](https://amplience.com/developers/docs/workforce/flows/installing-extensions-with-graphql/).

## Sandbox limits

Workforce runs extension code in a sandbox with these limits per execution:

- 30 seconds runtime
- 10 API requests
- 128MB RAM
- No local network access

All actions in this extension are CPU-only and stay well within these bounds.

## License

MIT
