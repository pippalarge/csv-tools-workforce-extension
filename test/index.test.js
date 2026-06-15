import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseCsv,
  arrayToCsv,
  filterRows,
  mapColumns,
  selectColumns,
  transformRows,
  chunkRows,
  validateRows,
  dedupeRows,
  toJson,
  fromJson,
  summarizeRows,
} from "../index.js";

// ---------------------------------------------------------------------------
// parseCsv
// ---------------------------------------------------------------------------

test("parseCsv: basic header + rows", () => {
  const { rows, count } = parseCsv({ csv: "a,b\n1,2\n3,4" });
  assert.deepEqual(rows, [
    { a: "1", b: "2" },
    { a: "3", b: "4" },
  ]);
  assert.equal(count, 2);
});

test("parseCsv: empty/whitespace input returns no rows", () => {
  assert.deepEqual(parseCsv({ csv: "" }), { rows: [], count: 0 });
  assert.deepEqual(parseCsv({ csv: "   " }), { rows: [], count: 0 });
});

test("parseCsv: skips blank lines", () => {
  const { count } = parseCsv({ csv: "a,b\n1,2\n\n3,4\n" });
  assert.equal(count, 2);
});

test("parseCsv: handles CRLF line endings", () => {
  const { rows } = parseCsv({ csv: "a,b\r\n1,2\r\n3,4" });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { a: "1", b: "2" });
});

test("parseCsv: quoted field containing the delimiter", () => {
  const { rows } = parseCsv({ csv: 'name,note\n"Smith, J","hello, world"' });
  assert.deepEqual(rows[0], { name: "Smith, J", note: "hello, world" });
});

test("parseCsv: escaped double-quotes inside a quoted field", () => {
  const { rows } = parseCsv({ csv: 'q\n"She said ""hi"""' });
  assert.equal(rows[0].q, 'She said "hi"');
});

test("parseCsv: quoted field containing a newline", () => {
  const { rows } = parseCsv({ csv: 'a,b\n"line1\nline2",x' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].a, "line1\nline2");
});

test("parseCsv: PRESERVES whitespace inside quoted fields (the fix)", () => {
  const { rows } = parseCsv({ csv: 'a,b\n"  spaced  ",plain' });
  assert.equal(rows[0].a, "  spaced  ", "quoted whitespace must be kept");
});

test("parseCsv: trims unquoted fields for lenience", () => {
  const { rows } = parseCsv({ csv: "a,b\n  x  ,  y  " });
  assert.deepEqual(rows[0], { a: "x", b: "y" });
});

test("parseCsv: custom delimiter", () => {
  const { rows } = parseCsv({ csv: "a;b\n1;2", delimiter: ";" });
  assert.deepEqual(rows[0], { a: "1", b: "2" });
});

test("parseCsv: missing trailing values fill with empty string", () => {
  const { rows } = parseCsv({ csv: "a,b,c\n1,2" });
  assert.deepEqual(rows[0], { a: "1", b: "2", c: "" });
});

// ---------------------------------------------------------------------------
// arrayToCsv  (round-trips with parseCsv)
// ---------------------------------------------------------------------------

test("arrayToCsv: serialises with header derived from keys", () => {
  const { csv, count } = arrayToCsv({ rows: [{ a: "1", b: "2" }] });
  assert.equal(csv, "a,b\r\n1,2");
  assert.equal(count, 1);
});

test("arrayToCsv: explicit column order", () => {
  const { csv } = arrayToCsv({ rows: [{ a: "1", b: "2" }], columns: ["b", "a"] });
  assert.equal(csv, "b,a\r\n2,1");
});

test("arrayToCsv: quotes fields needing escaping", () => {
  const { csv } = arrayToCsv({ rows: [{ a: 'has,comma', b: 'has "quote"' }] });
  assert.equal(csv, 'a,b\r\n"has,comma","has ""quote"""');
});

test("arrayToCsv: empty rows -> empty csv", () => {
  assert.deepEqual(arrayToCsv({ rows: [] }), { csv: "", count: 0 });
});

test("round-trip: parse -> serialise -> parse is stable", () => {
  const original = 'name,note\n"Smith, J","with ""quotes"""';
  const { rows } = parseCsv({ csv: original });
  const { csv } = arrayToCsv({ rows });
  const { rows: rows2 } = parseCsv({ csv });
  assert.deepEqual(rows2, rows);
});

// ---------------------------------------------------------------------------
// filterRows
// ---------------------------------------------------------------------------

const sample = [
  { sku: "A", price: "10", stock: "5" },
  { sku: "B", price: "20", stock: "" },
  { sku: "C", price: "30", stock: "0" },
];

test("filterRows: eq / ne", () => {
  assert.equal(filterRows({ rows: sample, column: "sku", operator: "eq", value: "A" }).count, 1);
  assert.equal(filterRows({ rows: sample, column: "sku", operator: "ne", value: "A" }).count, 2);
});

test("filterRows: numeric gt/gte/lt/lte", () => {
  assert.equal(filterRows({ rows: sample, column: "price", operator: "gt", value: "10" }).count, 2);
  assert.equal(filterRows({ rows: sample, column: "price", operator: "gte", value: "10" }).count, 3);
  assert.equal(filterRows({ rows: sample, column: "price", operator: "lt", value: "30" }).count, 2);
  assert.equal(filterRows({ rows: sample, column: "price", operator: "lte", value: "30" }).count, 3);
});

test("filterRows: contains", () => {
  assert.equal(filterRows({ rows: sample, column: "sku", operator: "contains", value: "B" }).count, 1);
});

test("filterRows: empty / notEmpty", () => {
  assert.equal(filterRows({ rows: sample, column: "stock", operator: "empty" }).count, 1);
  assert.equal(filterRows({ rows: sample, column: "stock", operator: "notEmpty" }).count, 2);
});

test("filterRows: reports removed count", () => {
  const r = filterRows({ rows: sample, column: "sku", operator: "eq", value: "A" });
  assert.equal(r.removed, 2);
});

// ---------------------------------------------------------------------------
// mapColumns / selectColumns
// ---------------------------------------------------------------------------

test("mapColumns: renames and passes through unmapped", () => {
  const { rows } = mapColumns({ rows: [{ a: "1", b: "2" }], mapping: { a: "x" } });
  assert.deepEqual(rows[0], { x: "1", b: "2" });
});

test("mapColumns: dropUnmapped drops the rest", () => {
  const { rows } = mapColumns({ rows: [{ a: "1", b: "2" }], mapping: { a: "x" }, dropUnmapped: true });
  assert.deepEqual(rows[0], { x: "1" });
});

test("selectColumns: keeps only listed columns in order", () => {
  const { rows } = selectColumns({ rows: [{ a: "1", b: "2", c: "3" }], columns: ["c", "a"] });
  assert.deepEqual(Object.keys(rows[0]), ["c", "a"]);
  assert.deepEqual(rows[0], { c: "3", a: "1" });
});

test("selectColumns: missing column becomes empty string", () => {
  const { rows } = selectColumns({ rows: [{ a: "1" }], columns: ["a", "z"] });
  assert.deepEqual(rows[0], { a: "1", z: "" });
});

// ---------------------------------------------------------------------------
// transformRows
// ---------------------------------------------------------------------------

test("transformRows: trims, coerces numbers and booleans, fills empties", () => {
  const { rows } = transformRows({
    rows: [{ price: " 9.99 ", inStock: "yes", note: "" }],
    numericColumns: ["price"],
    booleanColumns: ["inStock"],
    emptyDefault: "n/a",
  });
  assert.equal(rows[0].price, 9.99);
  assert.equal(rows[0].inStock, true);
  assert.equal(rows[0].note, "n/a");
});

test("transformRows: non-numeric value left untouched in numeric column", () => {
  const { rows } = transformRows({ rows: [{ n: "abc" }], numericColumns: ["n"] });
  assert.equal(rows[0].n, "abc");
});

test("transformRows: boolean falsey values", () => {
  const { rows } = transformRows({ rows: [{ b: "no" }, { b: "0" }, { b: "" }], booleanColumns: ["b"] });
  assert.equal(rows[0].b, false);
  assert.equal(rows[1].b, false);
  assert.equal(rows[2].b, false);
});

// ---------------------------------------------------------------------------
// chunkRows
// ---------------------------------------------------------------------------

test("chunkRows: splits into batches", () => {
  const rows = [1, 2, 3, 4, 5].map((n) => ({ n }));
  const r = chunkRows({ rows, size: 2 });
  assert.equal(r.chunkCount, 3);
  assert.equal(r.rowCount, 5);
  assert.deepEqual(r.chunks[2], [{ n: 5 }]);
});

test("chunkRows: invalid size returns empty", () => {
  assert.deepEqual(chunkRows({ rows: [{ n: 1 }], size: 0 }), { chunks: [], chunkCount: 0, rowCount: 0 });
});

// ---------------------------------------------------------------------------
// validateRows
// ---------------------------------------------------------------------------

test("validateRows: splits valid/invalid and attaches _errors", () => {
  const r = validateRows({
    rows: [{ sku: "A", price: "1" }, { sku: "", price: "2" }],
    required: ["sku", "price"],
  });
  assert.equal(r.validCount, 1);
  assert.equal(r.invalidCount, 1);
  assert.ok(Array.isArray(r.invalid[0]._errors));
  assert.match(r.invalid[0]._errors[0], /sku/);
});

// ---------------------------------------------------------------------------
// dedupeRows
// ---------------------------------------------------------------------------

test("dedupeRows: removes dupes by single key, keeps first", () => {
  const r = dedupeRows({ rows: [{ id: "1", v: "a" }, { id: "1", v: "b" }, { id: "2" }], key: "id" });
  assert.equal(r.count, 2);
  assert.equal(r.duplicatesRemoved, 1);
  assert.equal(r.rows[0].v, "a");
});

test("dedupeRows: composite key", () => {
  const r = dedupeRows({
    rows: [{ a: "1", b: "x" }, { a: "1", b: "y" }, { a: "1", b: "x" }],
    key: ["a", "b"],
  });
  assert.equal(r.count, 2);
});

// ---------------------------------------------------------------------------
// toJson / fromJson
// ---------------------------------------------------------------------------

test("toJson / fromJson round-trip", () => {
  const rows = [{ a: "1" }, { a: "2" }];
  const { json } = toJson({ rows });
  const { rows: back, count } = fromJson({ json });
  assert.deepEqual(back, rows);
  assert.equal(count, 2);
});

test("fromJson: accepts object wrapping rows key", () => {
  const { rows } = fromJson({ json: '{"rows":[{"a":"1"}]}' });
  assert.deepEqual(rows, [{ a: "1" }]);
});

test("fromJson: invalid JSON returns error, not throw", () => {
  const r = fromJson({ json: "{not json" });
  assert.deepEqual(r.rows, []);
  assert.ok(r.error);
});

// ---------------------------------------------------------------------------
// summarizeRows
// ---------------------------------------------------------------------------

test("summarizeRows: per-column counts and numeric stats", () => {
  const r = summarizeRows({
    rows: [{ p: "10", s: "x" }, { p: "20", s: "x" }, { p: "", s: "y" }],
  });
  assert.equal(r.rowCount, 3);
  assert.equal(r.columnCount, 2);
  const p = r.columns.find((c) => c.name === "p");
  assert.equal(p.nonEmpty, 2);
  assert.equal(p.min, 10);
  assert.equal(p.max, 20);
  assert.equal(p.sum, 30);
  const s = r.columns.find((c) => c.name === "s");
  assert.equal(s.distinct, 2);
  assert.equal(s.min, undefined, "non-numeric column has no numeric stats");
});
