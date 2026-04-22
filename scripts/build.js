const fs = require('fs');
const path = require('path');

const files = [
  'scripts/metadata.txt',
  'src/config.js',
  'src/state.js',
  'src/api.js',
  'src/parser.js',
  'src/export.js',
  'src/ui.js',
  'src/main.js',
];

console.log('Building spool.user.js...');

const output = files
  .map(f => {
    const content = fs.readFileSync(path.join('..', f), 'utf8');
    console.log(`  ${f}`);
    return content;
  })
  .join('\n\n');

const outPath = path.join('..', 'spool.user.js');
fs.writeFileSync(outPath, output);

const stats = fs.statSync(outPath);
console.log(`\nDone! Generated ${outPath} (${stats.size} bytes)`);