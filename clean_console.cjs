const fs = require('fs');
const path = require('path');

const SRC = path.join(process.env.TEMP || '/tmp', 'nexus_fix', 'src');

const SKIP_FILES = new Set([
  'server.ts',
  'start.ts',
  'auth-middleware.ts',
]);

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !SKIP_FILES.has(entry.name)) files.push(full);
  }
  return files;
}

let totalRemoved = 0;
let filesChanged = 0;

for (const filePath of walk(SRC)) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const result = [];
  let removed = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Match standalone single-line console statements
    // These are lines where the ONLY statement is a console.xxx call
    const isStandaloneConsole = /^(console\.(log|warn|error|debug|info)\s*\(.*)\;?\s*$/.test(trimmed);

    if (isStandaloneConsole) {
      // Check it's not inside a .catch() or .then() on the same line
      const prevLine = result.length > 0 ? result[result.length - 1] : '';
      const prevTrimmed = prevLine.trim();

      // Skip if previous line ends with .catch( or .then( or .catch(() => etc
      if (/\.\s*(catch|then)\s*\(\s*(\(\s*\)|function|\()?\s*$/.test(prevTrimmed)) {
        result.push(line);
        i++;
        continue;
      }

      // Skip if line itself contains .catch or .then
      if (/\.\s*(catch|then)\s*\(/.test(trimmed)) {
        result.push(line);
        i++;
        continue;
      }

      removed++;
      i++;
      continue;
    }

    // Also handle multi-line console statements (console.xxx(\n  ...\n))
    if (/^console\.(log|warn|error|debug|info)\s*\(\s*$/.test(trimmed)) {
      // Collect lines until we find the closing );
      let depth = 0;
      let j = i;
      let collected = '';
      while (j < lines.length) {
        collected += lines[j];
        for (const ch of lines[j]) {
          if (ch === '(') depth++;
          if (ch === ')') depth--;
        }
        if (depth <= 0) break;
        j++;
      }
      // Check the full collected string is a standalone console statement
      if (/^\s*console\.(log|warn|error|debug|info)\s*\(/.test(collected.trim()) && /\)\s*;?\s*$/.test(collected.trim())) {
        removed += (j - i + 1);
        i = j + 1;
        continue;
      }
      // Not a standalone console, push all collected lines
      for (let k = i; k <= j; k++) result.push(lines[k]);
      i = j + 1;
      continue;
    }

    result.push(line);
    i++;
  }

  if (removed > 0) {
    let content = result.join('\n').replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(filePath, content, 'utf8');
    const rel = path.relative(SRC, filePath);
    console.log(`${rel}: removed ${removed} console lines`);
    totalRemoved += removed;
    filesChanged++;
  }
}

console.log(`\nDone: ${totalRemoved} lines removed from ${filesChanged} files`);
