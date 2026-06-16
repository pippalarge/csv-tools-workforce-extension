# Table Tools — Amplience Workforce Extension

A set of Amplience [Workforce](https://amplience.com/developers/docs/workforce/flows/) actions for shaping **tabular data** inside automation flows — filter, sort, join, add/drop/rename columns, validate, deduplicate, and convert to/from CSV and JSON.

**Role: transforms.** Everything operates on **`rows`** — an array of header-keyed objects, e.g. `[{ "SKU": "AF-1", "Price": "18" }, ...]`. Every action is pure data-shaping JavaScript with **no external API calls**, so each runs comfortably within the Workforce sandbox limits (30s, 10 API requests, 128MB).

## Works together with the Google Sheets extension

Table Tools and the [Google Sheets extension](https://github.com/pippalarge/google-sheets-reader-workforce-extension) are two halves of one tabular-data pipeline, joined by a shared shape: **`rows`** (an array of header-keyed objects).

- **Google Sheets = I/O** — gets rows out of (`loadRows` / `loadTabs`) and back into (`appendRows` / `updateRange`) a spreadsheet.
- **Table Tools = transforms** — operates on those same `rows`, from any source (a sheet, CSV, or JSON).

Because the shape matches, they chain with no glue:

```
Google Sheets (loadRows / loadTabs)  →  Table Tools (joinRows, addColumn, filterRows, …)  →  Google Sheets (appendRows)
        I/O: rows OUT                              transforms on rows                                I/O: rows BACK
```

Nothing here is CSV-specific — CSV and JSON are just adapters at the edges. The currency is `rows`.

## Actions

| Action | Label | Input → Output |
| --- | --- | --- |
| `csvToRows` | CSV to Rows | `{ csv, delimiter? }` → `{ rows, count }` |
| `rowsToCsv` | Rows to CSV | `{ rows, columns?, delimiter? }` → `{ csv, count }` |
| `jsonToRows` | JSON to Rows | `{ json }` → `{ rows, count }` |
| `rowsToJson` | Rows to JSON | `{ rows, pretty? }` → `{ json, count }` |
| `filterRows` | Filter Rows | `{ rows, column, operator?, value? }` → `{ rows, count, removed }` |
| `sortRows` | Sort Rows | `{ rows, by, order? }` → `{ rows, count }` |
| `selectColumns` | Select Columns | `{ rows, columns }` → `{ rows, count }` |
| `dropColumns` | Drop Columns | `{ rows, columns }` → `{ rows, count }` |
| `renameColumns` | Rename Columns | `{ rows, mapping, dropUnmapped? }` → `{ rows, count }` |
| `addColumn` | Add Column | `{ rows, name, value? , template? }` → `{ rows, count }` |
| `pluckColumn` | Pluck Column | `{ rows, column, distinct?, dropEmpty? }` → `{ values, count }` |
| `cleanRows` | Clean Rows | `{ rows, trim?, numericColumns?, booleanColumns?, emptyDefault? }` → `{ rows, count }` |
| `validateRows` | Validate Rows | `{ rows, required }` → `{ valid, invalid, validCount, invalidCount }` |
| `dedupeRows` | Deduplicate Rows | `{ rows, key }` → `{ rows, count, duplicatesRemoved }` |
| `joinRows` | Join Rows | `{ leftRows, rightRows, leftKey, rightKey?, type?, prefix? }` → `{ rows, count, matched, unmatched }` |
| `concatRows` | Concatenate Rows | `{ rows, rows2 }` → `{ rows, count }` |
| `chunkRows` | Chunk Rows into Batches | `{ rows, size? }` → `{ chunks, chunkCount, rowCount }` |
| `summarizeRows` | Summarize Rows | `{ rows, columns? }` → `{ rowCount, columnCount, columns }` |

### Notes on the data model

- **Rows** are an array of plain objects keyed by column name.
- Workforce requires action input/output **roots to be objects**, so arrays are always wrapped (e.g. `{ "rows": [...] }`), never returned bare.
- Values read from CSV are **strings** — use `cleanRows` to coerce numeric/boolean columns before sending to a typed API.

### `filterRows` operators

`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `empty`, `notEmpty`. Numeric operators parse cells with `parseFloat`; the rest compare as strings.

## Example pipeline (with Google Sheets)

Enrich product rows from a sheet with reference data, then write them back:

1. **Load Rows** (Google Sheets) — load the `Products` tab as `rows`.
2. **Load Rows** (Google Sheets) — load the `Taxonomy` tab as the reference set.
3. **Join Rows** — `joinRows` on `Category` to attach the taxonomy `Category Code` to each product.
4. **Add Column** — `addColumn` a `channel` tag, or a composite title from `{Brand} {Title}`.
5. **Validate Rows** — require `SKU` and `Price`; split `valid` / `invalid`.
6. **Append Rows** (Google Sheets) — write the enriched `valid` rows to an output tab.

## Installing on a hub

Plain JavaScript conforming to the [Minimum Common Web Platform API](https://min-common-api.proposal.wintertc.org) — **no build step**; paste `index.js` directly. There are no environment variables.

1. **Integrations → Create extension**; enter the label `Table Tools`, the description, a docs URL, and the icon from `csv-icon-base64.txt`.
2. Create a **release** (e.g. `0.2.0`): upload `manifest.json`, paste `index.js`.
3. **Install** the release on your hub; the actions appear under **Integrations → Table Tools**.

To update later, publish a new release rather than editing the live one. Extensions can also be installed via the [GraphQL Management API](https://amplience.com/developers/docs/workforce/flows/installing-extensions-with-graphql/), or with the bundled `install.mjs`.

## Sandbox limits

Per execution: 30s runtime, 10 API requests, 128MB RAM, no local network. All actions here are CPU-only and stay well within these bounds.

## License

MIT
