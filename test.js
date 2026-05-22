const fs = require('fs');
const code = fs.readFileSync('frontend/src/components/admin/AdminPanel.tsx', 'utf8');
let depth = 0;
let lines = code.split('\n');
for (let i = 0; i < code.length; i++) {
  if (code[i] === '{') depth++;
  if (code[i] === '}') {
    depth--;
    if (depth === 0) {
      console.log('Depth became 0 at line', code.substring(0, i).split('\n').length);
    }
  }
}
