const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/Ashirwad/Desktop/projects/farma ddi checker/src/app/medcheck.css';
let content = fs.readFileSync(filePath, 'utf-8');

// Update squircle design (make it more clinical scanner-like)
content = content.replace(/border-radius:\s*24px;/g, 'border-radius: 12px;'); // sharper corners
content = content.replace(/border:\s*2px\s*dashed\s*var\(--border\);/g, 'border: 2px dashed var(--border-hover);');

// Update modal container shadow
content = content.replace(/box-shadow:\s*0\s*24px\s*64px\s*rgba\(0,0,0,0\.5\);/g, 'box-shadow: 0 10px 40px rgba(0,0,0,0.6);');
content = content.replace(/border-radius:\s*16px;/g, 'border-radius: 8px;');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('medcheck.css patched successfully');
