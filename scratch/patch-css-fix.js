const fs = require('fs');

const absCssPath = 'c:/Users/Ashirwad/Desktop/projects/farma ddi checker/src/app/globals.css';
let content = fs.readFileSync(absCssPath, 'utf-8');

// Fix the dangling -webkit- left by the previous regex replacement
content = content.replace(/\s*-webkit-\s*border/g, '\n  border');

fs.writeFileSync(absCssPath, content, 'utf-8');
console.log('globals.css fixed successfully.');
