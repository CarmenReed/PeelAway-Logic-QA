const fs = require('fs');
const path = require('path');

const ignore = ['node_modules', '.git', 'dist', 'build', '.next'];

function walk(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !ignore.includes(e.name));
  return entries.map(e => {
    const line = `${prefix}${e.isDirectory() ? '📁' : '📄'} ${e.name}`;
    if (e.isDirectory()) {
      return [line, walk(path.join(dir, e.name), prefix + '  ')].flat();
    }
    return line;
  }).flat();
}

const lines = [`# REPO MAP — ${new Date().toISOString()}`, '', ...walk('.')];
fs.writeFileSync('REPO_MAP.md', lines.join('\n'));
console.log('✅ REPO_MAP.md updated');
