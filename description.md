Shape tabular data inside a Workforce flow. Table Tools works on rows — an array of header-keyed objects — so it pairs directly with the Google Sheets extension: load rows from a sheet, shape them here, write rows back. It also reads and writes CSV and JSON, and is pure logic with no external API calls, so it stays well within the sandbox limits.

How it fits together:
- Google Sheets extension = I/O — gets rows out of and back into a spreadsheet.
- Table Tools = transforms — filter, sort, join, add/drop/rename columns, validate, deduplicate, and more, over those same rows.
- Typical pipeline: Load Rows (Google Sheets) → Join / Add Column / Filter (Table Tools) → Append Rows (Google Sheets).

Actions:
- CSV to Rows / Rows to CSV — parse and serialise CSV text.
- JSON to Rows / Rows to JSON — parse and serialise JSON.
- Filter Rows — keep rows where a column meets a condition.
- Sort Rows — order rows by one or more columns.
- Select Columns / Drop Columns — keep or remove columns.
- Rename Columns — remap headers to the names a downstream step expects.
- Add Column — add a constant column, or one built from a template of other columns.
- Pluck Column — return a single column's values as a flat list.
- Clean Rows — trim whitespace and coerce columns to numbers or booleans.
- Validate Rows — split rows into valid and invalid by required fields.
- Deduplicate Rows — remove repeats by one or more key columns.
- Join Rows — attach reference data to records by a key (a VLOOKUP across datasets).
- Concatenate Rows — stack two row sets into one.
- Chunk Rows into Batches — split large sets into batches for controlled processing.
- Summarize Rows — per-column counts, distinct values, and numeric stats.

Combine these in a flow to build an ingest, clean, enrich, validate, output pipeline without custom code.
