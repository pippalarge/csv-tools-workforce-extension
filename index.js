// Workforce extension action: parse a CSV string into an array of row objects.
// Makes no external API calls, so it stays well within the sandbox limits.
//
// Input:  { csv: string, delimiter?: string }
// Output: { rows: object[], count: number }

function parseCsv({ csv, delimiter = "," }) {
  if (typeof csv !== "string" || csv.trim() === "") {
    return { rows: [], count: 0 };
  }

  const records = splitRecords(csv);
  if (records.length === 0) return { rows: [], count: 0 };

  const headers = parseLine(records[0], delimiter).map((h) => h.trim());

  const rows = [];
  for (let i = 1; i < records.length; i++) {
    if (records[i].trim() === "") continue; // skip blank lines
    const values = parseLine(records[i], delimiter);
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx] !== undefined ? values[idx] : "";
    });
    rows.push(obj);
  }

  return { rows, count: rows.length };
}

// Split into records on newlines that are NOT inside quoted fields.
function splitRecords(text) {
  const records = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      // toggle quote state; handle escaped "" inside quotes
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i++; // CRLF
      records.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current !== "") records.push(current);
  return records;
}

// Parse a single CSV line into an array of field values, honouring quotes.
// Quoted fields are preserved exactly (internal whitespace kept); unquoted
// fields are trimmed for lenience with hand-edited CSVs.
function parseLine(line, delimiter) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  let wasQuoted = false; // did this field contain a quoted section?

  const pushField = () => {
    fields.push(wasQuoted ? field : field.trim());
    field = "";
    wasQuoted = false;
  };

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        wasQuoted = true;
      }
    } else if (char === delimiter && !inQuotes) {
      pushField();
    } else {
      field += char;
    }
  }
  pushField();
  return fields;
}

// Workforce extension action: serialise an array of row objects back into a CSV string.
//
// Input:  { rows: object[], columns?: string[], delimiter?: string }
// Output: { csv: string, count: number }

function arrayToCsv({ rows, columns, delimiter = "," }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { csv: "", count: 0 };
  }

  // Determine column order: explicit `columns` wins, otherwise the union of
  // keys across all rows (preserving first-seen order).
  let headers = Array.isArray(columns) && columns.length > 0 ? columns : null;
  if (!headers) {
    const seen = new Set();
    headers = [];
    for (const row of rows) {
      for (const key of Object.keys(row || {})) {
        if (!seen.has(key)) {
          seen.add(key);
          headers.push(key);
        }
      }
    }
  }

  const lines = [headers.map((h) => escapeField(h, delimiter)).join(delimiter)];
  for (const row of rows) {
    const line = headers
      .map((h) => escapeField(row && row[h] !== undefined && row[h] !== null ? row[h] : "", delimiter))
      .join(delimiter);
    lines.push(line);
  }

  return { csv: lines.join("\r\n"), count: rows.length };
}

// Quote a field if it contains the delimiter, quotes, or newlines; escape quotes by doubling.
function escapeField(value, delimiter) {
  const str = String(value);
  if (str.includes('"') || str.includes(delimiter) || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ---------------------------------------------------------------------------
// Shaping helpers (all CPU-only, no external API calls)
// ---------------------------------------------------------------------------

// filterRows: keep rows where `column` satisfies `operator` against `value`.
// Operators: eq, ne, gt, gte, lt, lte, contains, empty, notEmpty.
function filterRows({ rows, column, operator = "notEmpty", value }) {
  if (!Array.isArray(rows)) return { rows: [], count: 0, removed: 0 };

  const test = (cell) => {
    const num = parseFloat(cell);
    const cmpNum = parseFloat(value);
    switch (operator) {
      case "eq": return String(cell) === String(value);
      case "ne": return String(cell) !== String(value);
      case "gt": return num > cmpNum;
      case "gte": return num >= cmpNum;
      case "lt": return num < cmpNum;
      case "lte": return num <= cmpNum;
      case "contains": return String(cell).includes(String(value));
      case "empty": return cell === undefined || cell === null || String(cell).trim() === "";
      case "notEmpty": return !(cell === undefined || cell === null || String(cell).trim() === "");
      default: return true;
    }
  };

  const kept = rows.filter((row) => test(row ? row[column] : undefined));
  return { rows: kept, count: kept.length, removed: rows.length - kept.length };
}

// mapColumns: rename keys using a { oldKey: newKey } mapping.
// Unmapped keys pass through unless dropUnmapped is true.
function mapColumns({ rows, mapping = {}, dropUnmapped = false }) {
  if (!Array.isArray(rows)) return { rows: [], count: 0 };

  const out = rows.map((row) => {
    const next = {};
    for (const key of Object.keys(row || {})) {
      if (Object.prototype.hasOwnProperty.call(mapping, key)) {
        next[mapping[key]] = row[key];
      } else if (!dropUnmapped) {
        next[key] = row[key];
      }
    }
    return next;
  });
  return { rows: out, count: out.length };
}

// selectColumns: keep only the listed columns, in the order given.
function selectColumns({ rows, columns = [] }) {
  if (!Array.isArray(rows)) return { rows: [], count: 0 };

  const out = rows.map((row) => {
    const next = {};
    for (const col of columns) {
      next[col] = row && row[col] !== undefined ? row[col] : "";
    }
    return next;
  });
  return { rows: out, count: out.length };
}

// transformRows: clean/coerce values. Trims strings, converts listed columns to
// number or boolean, and fills empties with emptyDefault.
function transformRows({ rows, trim = true, numericColumns = [], booleanColumns = [], emptyDefault }) {
  if (!Array.isArray(rows)) return { rows: [], count: 0 };

  const truthy = new Set(["true", "1", "yes", "y", "t"]);
  const out = rows.map((row) => {
    const next = {};
    for (const key of Object.keys(row || {})) {
      let v = row[key];
      if (trim && typeof v === "string") v = v.trim();
      if ((v === "" || v === undefined || v === null) && emptyDefault !== undefined) {
        v = emptyDefault;
      }
      if (numericColumns.includes(key) && v !== "" && v !== null && v !== undefined) {
        const n = Number(v);
        if (!Number.isNaN(n)) v = n;
      }
      if (booleanColumns.includes(key)) {
        v = truthy.has(String(v).toLowerCase());
      }
      next[key] = v;
    }
    return next;
  });
  return { rows: out, count: out.length };
}

// chunkRows: split rows into batches of `size`. Useful for staying under the
// per-execution API request limit by processing one chunk per flow run.
function chunkRows({ rows, size = 10 }) {
  if (!Array.isArray(rows) || size < 1) return { chunks: [], chunkCount: 0, rowCount: 0 };

  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return { chunks, chunkCount: chunks.length, rowCount: rows.length };
}

// validateRows: split rows into valid/invalid based on required (non-empty) columns.
// Invalid rows are returned with an _errors array describing what failed.
function validateRows({ rows, required = [] }) {
  if (!Array.isArray(rows)) return { valid: [], invalid: [], validCount: 0, invalidCount: 0 };

  const valid = [];
  const invalid = [];
  for (const row of rows) {
    const errors = [];
    for (const col of required) {
      const cell = row ? row[col] : undefined;
      if (cell === undefined || cell === null || String(cell).trim() === "") {
        errors.push(`Missing required field: ${col}`);
      }
    }
    if (errors.length === 0) {
      valid.push(row);
    } else {
      invalid.push({ ...row, _errors: errors });
    }
  }
  return { valid, invalid, validCount: valid.length, invalidCount: invalid.length };
}

// dedupeRows: drop duplicate rows by a key (string or array of column names).
// Keeps the first occurrence.
function dedupeRows({ rows, key }) {
  if (!Array.isArray(rows)) return { rows: [], count: 0, duplicatesRemoved: 0 };

  const keys = Array.isArray(key) ? key : [key];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const signature = keys.map((k) => String(row ? row[k] : "")).join("");
    if (!seen.has(signature)) {
      seen.add(signature);
      out.push(row);
    }
  }
  return { rows: out, count: out.length, duplicatesRemoved: rows.length - out.length };
}

// toJson: serialise the row array to a JSON string.
function toJson({ rows, pretty = false }) {
  const arr = Array.isArray(rows) ? rows : [];
  return { json: JSON.stringify(arr, null, pretty ? 2 : 0), count: arr.length };
}

// fromJson: parse a JSON string into a row array. Accepts an array, or an
// object wrapping an array under a `rows` key.
function fromJson({ json }) {
  if (typeof json !== "string" || json.trim() === "") return { rows: [], count: 0 };
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { rows: [], count: 0, error: `Invalid JSON: ${e.message}` };
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed && parsed.rows)
      ? parsed.rows
      : [];
  return { rows, count: rows.length };
}

// summarizeRows: per-column stats — non-empty count, distinct count, and
// numeric min/max/sum where the values parse as numbers.
function summarizeRows({ rows, columns }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { rowCount: 0, columnCount: 0, columns: [] };
  }

  let names = Array.isArray(columns) && columns.length > 0 ? columns : null;
  if (!names) {
    const seen = new Set();
    names = [];
    for (const row of rows) {
      for (const key of Object.keys(row || {})) {
        if (!seen.has(key)) { seen.add(key); names.push(key); }
      }
    }
  }

  const stats = names.map((name) => {
    const distinct = new Set();
    let nonEmpty = 0;
    let numericCount = 0;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const row of rows) {
      const cell = row ? row[name] : undefined;
      if (cell === undefined || cell === null || String(cell).trim() === "") continue;
      nonEmpty++;
      distinct.add(String(cell));
      const n = Number(cell);
      if (!Number.isNaN(n)) {
        numericCount++;
        if (n < min) min = n;
        if (n > max) max = n;
        sum += n;
      }
    }
    const result = { name, nonEmpty, distinct: distinct.size };
    if (numericCount > 0) {
      result.min = min;
      result.max = max;
      result.sum = sum;
    }
    return result;
  });

  return { rowCount: rows.length, columnCount: names.length, columns: stats };
}

export {
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
};
