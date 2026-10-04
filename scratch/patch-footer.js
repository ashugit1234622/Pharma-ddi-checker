const fs = require('fs');

const cssPath = 'c:/Users/Ashirwad/Desktop/projects/farma ddi checker/src/app/globals.css';
let content = fs.readFileSync(cssPath, 'utf-8');

// Add the focus-within rule at the end of the file
const focusRule = `\n
/* Hide footer on mobile when keyboard is open (input is focused) */
@media (max-width: 768px) {
  main:focus-within ~ footer {
    display: none !important;
  }
}
`;

if (!content.includes('main:focus-within ~ footer')) {
  content += focusRule;
  fs.writeFileSync(cssPath, content, 'utf-8');
  console.log('globals.css patched with focus-within rule.');
} else {
  console.log('Rule already exists.');
}
