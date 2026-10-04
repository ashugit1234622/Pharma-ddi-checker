const fs = require('fs');

const pwaPath = 'c:/Users/Ashirwad/Desktop/projects/farma ddi checker/src/app/pwa.css';
let pwaContent = fs.readFileSync(pwaPath, 'utf-8');

// Clinical PWA button instead of gradient
pwaContent = pwaContent.replace(/background:\s*linear-gradient[^;]+;/g, 'background: var(--bg-hover);');
pwaContent = pwaContent.replace(/border:\s*1px\s*solid\s*rgba\(0, 180, 216, 0\.35\);/g, 'border: 1px solid var(--border);');
pwaContent = pwaContent.replace(/box-shadow:\s*0\s*0\s*12px\s*rgba[^;]+;/g, 'box-shadow: 0 1px 2px rgba(0,0,0,0.2);');
fs.writeFileSync(pwaPath, pwaContent, 'utf-8');

const headerPath = 'c:/Users/Ashirwad/Desktop/projects/farma ddi checker/src/components/Header.tsx';
let headerContent = fs.readFileSync(headerPath, 'utf-8');

// Unify icon colors in Header to accent-primary
headerContent = headerContent.replace(/color:\s*'#ec4899'/g, "color: 'var(--accent-primary)'");
headerContent = headerContent.replace(/color:\s*'#d946ef'/g, "color: 'var(--accent-primary)'");

// Convert header layout slightly to be more clinical
headerContent = headerContent.replace(/background-color: rgba\(10, 10, 12, 0\.92\);/g, 'background-color: rgba(2, 6, 23, 0.95);');

fs.writeFileSync(headerPath, headerContent, 'utf-8');
console.log('pwa.css and Header.tsx patched successfully');
