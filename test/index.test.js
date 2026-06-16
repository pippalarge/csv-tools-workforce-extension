import { test } from "node:test";
import assert from "node:assert/strict";

import {
  csvToRows,
  rowsToCsv,
  jsonToRows,
  rowsToJson,
  filterRows,
  sortRows,
  selectColumns,
  dropColumns,
  renameColumns,
  addColumn,
  pluckColumn,
  cleanRows,
  validateRows,
  dedupeRows,
  joinRows,
  concatRows,
  chunkRows,
  summarizeRows,
} from "../index.js";

// ---------------------------------------------------------------------------
// csvToRows
// ---------------------------------------------------------------------------

test("csvToRows: basic header + rows", () => {
  const { rows, count } = csvToRows({ csv: "a,b\n1,2\n3,4" });
  assert.deepEqual(rows, [
    { a: "1", b: "2" },
    { a: "3", b: "4" },
  ]);
  assert.equal(count, 2);
});

test("csvToRows: empty/whitespace input returns no rows", () => {
  assert.deepEqual(csvToRows({ csv: "" }), { rows: [], count: 0 });
  assert.deepEqual(csvToRows({ csv: "   " }), { rows: [], count: 0 });
});

test("csvToRows: skips blank lines", () => {
  assert.equal(csvToRows({ csv: "a,b\n1,2\n\n3,4\n" }).count, 2);
});

test("csvToRows: handles CRLF line endings", () => {
  const { rows } = csvToRows({ csv: "a,b\r\n1,2\r\n3,4" });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { a: "1", b: "2" });
});

test("csvToRows: quoted field containing the delimiter", () => {
  const { rows } = csvToRows({ csv: 'name,note\n"Smith, J","hello, world"' });
  assert.deepEqual(rows[0], { name: "Smith, J", note: "hello, world" });
});

test("csvToRows: escaped double-quotes inside a quoted field", () => {
  const { rows } = csvToRows({ csv: 'q\n"She said ""hi"""' });
  assert.equal(rows[0].q, 'She said "hi"');
});

test("csvToRows: PRESERVES whitespace inside quoted fields", () => {
  const { rows } = csvToRows({ csv: 'a,b\n"  spaced  ",plain' });
  assert.equal(rows[0].a, "  spaced  ");
});

test("csvToRows: trims unquoted fields; custom delimiter; short rows pad", () => {
  assert.deepEqual(csvToRows({ csv: "a,b\n  x  ,  y  " }).rows[0], { a: "x", b: "y" });
  assert.deepEqual(csvToRows({ csv: "a;b\n1;2", delimiter: ";" }).rows[0], { a: "1", b: "2" });
  assert.deepEqual(csvToRows({ csv: "a,b,c\n1,2" }).rows[0], { a: "1", b: "2", c: "" });
});

// ---------------------------------------------------------------------------
// rowsToCsv (round-trips with csvToRows)
// ---------------------------------------------------------------------------

test("rowsToCsv: header from keys, explicit order, escaping, empty", () => {
  assert.equal(rowsToCsv({ rows: [{ a: "1", b: "2" }] }).csv, "a,b\r\n1,2");
  assert.equal(rowsToCsv({ rows: [{ a: "1", b: "2" }], columns: ["b", "a"] }).csv, "b,a\r\n2,1");
  assert.equal(rowsToCsv({ rows: [{ a: "has,comma", b: 'has "quote"' }] }).csv, 'a,b\r\n"has,comma","has ""quote"""');
  assert.deepEqual(rowsToCsv({ rows: [] }), { csv: "", count: 0 });
});

test("round-trip: csvToRows -> rowsToCsv -> csvToRows is stable", () => {
  const original = 'name,note\n"Smith, J","with ""quotes"""';
  const { rows } = csvToRows({ csv: original });
  const { csv } = rowsToCsv({ rows });
  assert.deepEqual(csvToRows({ csv }).rows, rows);
});

// ---------------------------------------------------------------------------
// filterRows
// ---------------------------------------------------------------------------

const sample = [
  { sku: "A", price: "10", stock: "5" },
  { sku: "B", price: "20", stock: "" },
  { sku: "C", price: "30", stock: "0" },
];

test("filterRows: operators + removed count", () => {
  assert.equal(filterRows({ rows: sample, column: "sku", operator: "eq", value: "A" }).count, 1);
  assert.equal(filterRows({ rows: sample, column: "sku", operator: "ne", value: "A" }).count, 2);
  assert.equal(filterRows({ rows: sample, column: "price", operator: "gt", value: "10" }).count, 2);
  assert.equal(filterRows({ rows: sample, column: "price", operator: "gte", value: "10" }).count, 3);
  assert.equal(filterRows({ rows: sample, column: "stock", operator: "empty" }).count, 1);
  assert.equal(filterRows({ rows: sample, column: "stock", operator: "notEmpty" }).count, 2);
  assert.equal(filterRows({ rows: sample, column: "sku", operator: "eq", value: "A" }).removed, 2);
});

// ---------------------------------------------------------------------------
// sortRows (NEW)
// ---------------------------------------------------------------------------

test("sortRows: numeric-aware ascending and descending", () => {
  const rows = [{ p: "30" }, { p: "5" }, { p: "20" }];
  assert.deepEqual(sortRows({ rows, by: "p" }).rows.map((r) => r.p), ["5", "20", "30"]);
  assert.deepEqual(sortRows({ rows, by: "p", order: "desc" }).rows.map((r) => r.p), ["30", "20", "5"]);
});

test("sortRows: multi-column priority; original array untouched", () => {
  const rows = [{ a: "1", b: "y" }, { a: "1", b: "x" }, { a: "2", b: "a" }];
  const sorted = sortRows({ rows, by: ["a", "b"] }).rows;
  assert.deepEqual(sorted.map((r) => r.b), ["x", "y", "a"]);
  assert.equal(rows[0].b, "y"); // input not mutated
});

// ---------------------------------------------------------------------------
// selectColumns / dropColumns / renameColumns
// ---------------------------------------------------------------------------

test("selectColumns: keeps listed columns in order; missing -> empty", () => {
  const { rows } = selectColumns({ rows: [{ a: "1", b: "2", c: "3" }], columns: ["c", "a", "z"] });
  assert.deepEqual(rows[0], { c: "3", a: "1", z: "" });
});

test("dropColumns: removes listed columns, passes the rest through", () => {
  const { rows } = dropColumns({ rows: [{ a: "1", b: "2", c: "3" }], columns: ["b"] });
  assert.deepEqual(rows[0], { a: "1", c: "3" });
});

test("renameColumns: renames + passes through, dropUnmapped works", () => {
  assert.deepEqual(renameColumns({ rows: [{ a: "1", b: "2" }], mapping: { a: "x" } }).rows[0], { x: "1", b: "2" });
  assert.deepEqual(renameColumns({ rows: [{ a: "1", b: "2" }], mapping: { a: "x" }, dropUnmapped: true }).rows[0], { x: "1" });
});

// ---------------------------------------------------------------------------
// addColumn (NEW)
// ---------------------------------------------------------------------------

test("addColumn: constant value", () => {
  const { rows } = addColumn({ rows: [{ a: "1" }], name: "source", value: "sheet" });
  assert.deepEqual(rows[0], { a: "1", source: "sheet" });
});

test("addColumn: template interpolates other columns", () => {
  const { rows } = addColumn({ rows: [{ Brand: "AnyaFinn", Title: "Tee" }], name: "Full", template: "{Brand} {Title}" });
  assert.equal(rows[0].Full, "AnyaFinn Tee");
});

test("addColumn: missing template token becomes empty", () => {
  const { rows } = addColumn({ rows: [{ Brand: "AnyaFinn" }], name: "Full", template: "{Brand}-{Missing}" });
  assert.equal(rows[0].Full, "AnyaFinn-");
});

// ---------------------------------------------------------------------------
// pluckColumn (NEW)
// ---------------------------------------------------------------------------

test("pluckColumn: flat list, distinct, dropEmpty", () => {
  const rows = [{ c: "x" }, { c: "y" }, { c: "x" }, { c: "" }];
  assert.deepEqual(pluckColumn({ rows, column: "c" }).values, ["x", "y", "x"]); // dropEmpty default
  assert.deepEqual(pluckColumn({ rows, column: "c", distinct: true }).values, ["x", "y"]);
  assert.deepEqual(pluckColumn({ rows, column: "c", dropEmpty: false }).values, ["x", "y", "x", ""]);
});

// ---------------------------------------------------------------------------
// cleanRows
// ---------------------------------------------------------------------------

test("cleanRows: trims, coerces numbers/booleans, fills empties; leaves non-numeric", () => {
  const { rows } = cleanRows({
    rows: [{ price: " 9.99 ", inStock: "yes", note: "" }],
    numericColumns: ["price"],
    booleanColumns: ["inStock"],
    emptyDefault: "n/a",
  });
  assert.equal(rows[0].price, 9.99);
  assert.equal(rows[0].inStock, true);
  assert.equal(rows[0].note, "n/a");
  assert.equal(cleanRows({ rows: [{ n: "abc" }], numericColumns: ["n"] }).rows[0].n, "abc");
});

// ---------------------------------------------------------------------------
// validateRows / dedupeRows
// ---------------------------------------------------------------------------

test("validateRows: splits valid/invalid and attaches _errors", () => {
  const r = validateRows({ rows: [{ sku: "A", price: "1" }, { sku: "", price: "2" }], required: ["sku", "price"] });
  assert.equal(r.validCount, 1);
  assert.equal(r.invalidCount, 1);
  assert.match(r.invalid[0]._errors[0], /sku/);
});

test("dedupeRows: single key keeps first; composite key", () => {
  const r = dedupeRows({ rows: [{ id: "1", v: "a" }, { id: "1", v: "b" }, { id: "2" }], key: "id" });
  assert.equal(r.count, 2);
  assert.equal(r.duplicatesRemoved, 1);
  assert.equal(r.rows[0].v, "a");
  assert.equal(dedupeRows({ rows: [{ a: "1", b: "x" }, { a: "1", b: "y" }, { a: "1", b: "x" }], key: ["a", "b"] }).count, 2);
});

// ---------------------------------------------------------------------------
// joinRows (NEW)
// ---------------------------------------------------------------------------

test("joinRows: left join attaches right fields, keeps unmatched", () => {
  const products = [{ SKU: "1", Cat: "Dresses" }, { SKU: "2", Cat: "Unknown" }];
  const taxonomy = [{ Cat: "Dresses", Code: "W-DR" }];
  const r = joinRows({ leftRows: products, rightRows: taxonomy, leftKey: "Cat" });
  assert.equal(r.count, 2);
  assert.equal(r.matched, 1);
  assert.equal(r.unmatched, 1);
  assert.equal(r.rows[0].Code, "W-DR");
  assert.equal(r.rows[1].Code, undefined); // unmatched left row passes through unchanged
});

test("joinRows: inner join drops unmatched; rightKey + prefix", () => {
  const left = [{ range: "A", k: "1" }, { range: "B", k: "2" }];
  const right = [{ key: "1", label: "Alpha" }];
  const r = joinRows({ leftRows: left, rightRows: right, leftKey: "k", rightKey: "key", type: "inner", prefix: "ref_" });
  assert.equal(r.count, 1);
  assert.equal(r.rows[0].ref_label, "Alpha");
  assert.equal(r.rows[0].ref_key, "1"); // with a prefix the join key is carried too
});

// ---------------------------------------------------------------------------
// concatRows (NEW)
// ---------------------------------------------------------------------------

test("concatRows: stacks two row sets", () => {
  const r = concatRows({ rows: [{ a: "1" }], rows2: [{ a: "2" }, { a: "3" }] });
  assert.equal(r.count, 3);
  assert.deepEqual(r.rows.map((x) => x.a), ["1", "2", "3"]);
});

// ---------------------------------------------------------------------------
// chunkRows
// ---------------------------------------------------------------------------

test("chunkRows: splits into batches; invalid size empty", () => {
  const rows = [1, 2, 3, 4, 5].map((n) => ({ n }));
  const r = chunkRows({ rows, size: 2 });
  assert.equal(r.chunkCount, 3);
  assert.deepEqual(r.chunks[2], [{ n: 5 }]);
  assert.deepEqual(chunkRows({ rows: [{ n: 1 }], size: 0 }), { chunks: [], chunkCount: 0, rowCount: 0 });
});

// ---------------------------------------------------------------------------
// jsonToRows / rowsToJson
// ---------------------------------------------------------------------------

test("rowsToJson / jsonToRows round-trip; object-wrapped; invalid", () => {
  const rows = [{ a: "1" }, { a: "2" }];
  const { json } = rowsToJson({ rows });
  assert.deepEqual(jsonToRows({ json }).rows, rows);
  assert.deepEqual(jsonToRows({ json: '{"rows":[{"a":"1"}]}' }).rows, [{ a: "1" }]);
  const bad = jsonToRows({ json: "{not json" });
  assert.deepEqual(bad.rows, []);
  assert.ok(bad.error);
});

// ---------------------------------------------------------------------------
// summarizeRows
// ---------------------------------------------------------------------------

test("summarizeRows: per-column counts and numeric stats", () => {
  const r = summarizeRows({ rows: [{ p: "10", s: "x" }, { p: "20", s: "x" }, { p: "", s: "y" }] });
  assert.equal(r.rowCount, 3);
  assert.equal(r.columnCount, 2);
  const p = r.columns.find((c) => c.name === "p");
  assert.equal(p.nonEmpty, 2);
  assert.equal(p.sum, 30);
  const s = r.columns.find((c) => c.name === "s");
  assert.equal(s.distinct, 2);
  assert.equal(s.min, undefined);
});
