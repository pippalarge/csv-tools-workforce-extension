Bring spreadsheet-style data handling into your Workforce flows.

Parse a CSV into structured rows, then filter, rename, clean, validate, deduplicate, batch, and summarise that data — and write it back out as CSV or JSON when you are done. Ideal for preparing product feeds, catalogue exports, or any tabular file before it is sent to an external system.

Includes 12 actions:
- Parse CSV to rows — turn a CSV string into an array of records.
- Save to CSV — serialise records back into a CSV string.
- Filter rows — keep rows matching a condition (equals, greater-than, contains, not-empty, and more).
- Rename columns — remap headers to the field names a downstream API expects.
- Select columns — keep only the fields you need.
- Clean and coerce rows — trim whitespace and convert columns to numbers or booleans.
- Chunk rows into batches — split large datasets into batches for controlled processing.
- Validate rows — separate valid records from those missing required fields.
- Deduplicate rows — remove repeats by one or more key columns.
- Rows to JSON / JSON to rows — convert between tabular and JSON formats.
- Summarize rows — get per-column counts, distinct values, and numeric stats.

Every action is pure data-shaping logic with no external API calls, so it runs fast and stays well within the Workforce sandbox limits. Combine the actions in a flow to build a complete "ingest, clean, validate, output" pipeline without custom code.
