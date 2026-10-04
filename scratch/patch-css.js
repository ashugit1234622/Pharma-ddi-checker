const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../../c/Users/Ashirwad/Desktop/projects/farma ddi checker/src/app/globals.css');
// Since __dirname in scratch might be different, let's use the absolute path given to us:
const absCssPath = 'c:/Users/Ashirwad/Desktop/projects/farma ddi checker/src/app/globals.css';

let content = fs.readFileSync(absCssPath, 'utf-8');

// Replace CSS variables
content = content.replace(/--bg-main:\s*#[0-9a-fA-F]+;/, '--bg-main: #020617;');
content = content.replace(/--bg-card:\s*#[0-9a-fA-F]+;/, '--bg-card: #0f172a;');
content = content.replace(/--bg-hover:\s*#[0-9a-fA-F]+;/, '--bg-hover: #1e293b;');
content = content.replace(/--bg-input:\s*#[0-9a-fA-F]+;/, '--bg-input: #0f172a;');

content = content.replace(/--text-main:\s*#[0-9a-fA-F]+;/, '--text-main: #f8fafc;');
content = content.replace(/--text-muted:\s*#[0-9a-fA-F]+;/, '--text-muted: #94a3b8;');
content = content.replace(/--text-dim:\s*#[0-9a-fA-F]+;/, '--text-dim: #64748b;');

content = content.replace(/--accent-primary:\s*#[0-9a-fA-F]+;/, '--accent-primary: #0ea5e9;');
content = content.replace(/--accent-hover:\s*#[0-9a-fA-F]+;/, '--accent-hover: #0284c7;');
content = content.replace(/--accent-glow:\s*[^;]+;/, '--accent-glow: rgba(14, 165, 233, 0.1);');
content = content.replace(/--accent-soft:\s*[^;]+;/, '--accent-soft: rgba(14, 165, 233, 0.05);');

content = content.replace(/--border:\s*#[0-9a-fA-F]+;/, '--border: #334155;');
content = content.replace(/--border-hover:\s*#[0-9a-fA-F]+;/, '--border-hover: #475569;');

content = content.replace(/--chart-drug1:\s*#[0-9a-fA-F]+;/, '--chart-drug1: #0ea5e9;');
content = content.replace(/--chart-drug2:\s*#[0-9a-fA-F]+;/, '--chart-drug2: #8b5cf6;');

// Remove heavy blurs and oversized box-shadows from cards
content = content.replace(/background:\s*rgba\(14,\s*20,\s*32,\s*0\.92\)\s*!important;/g, 'background: var(--bg-card) !important;');
content = content.replace(/backdrop-filter:\s*blur\(16px\);/g, '');
content = content.replace(/-webkit-backdrop-filter:\s*blur\(16px\);/g, '');
content = content.replace(/box-shadow:\s*0\s*4px\s*24px\s*rgba\(0,\s*0,\s*0,\s*0\.45\);/g, 'box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);');
content = content.replace(/box-shadow:\s*0\s*6px\s*32px\s*rgba\(0,\s*0,\s*0,\s*0\.55\);/g, 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);');
content = content.replace(/border-radius:\s*12px;/g, 'border-radius: 8px;');
content = content.replace(/border-color:\s*rgba\(255,\s*255,\s*255,\s*0\.18\);/g, 'border-color: var(--border-hover);');

// Clean up primary button
content = content.replace(/background:\s*linear-gradient[^;]+;/, 'background: var(--accent-primary); border: 1px solid var(--accent-hover);');
content = content.replace(/box-shadow:\s*0\s*2px\s*12px\s*var\(--accent-glow\);/, 'box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);');
content = content.replace(/box-shadow:\s*0\s*4px\s*24px\s*rgba\(99,\s*102,\s*241,\s*0\.35\);/, 'background: var(--accent-hover); transform: translateY(-1px);');

// Add subtle medical grid to body
content = content.replace(/body\s*{([^}]+)}/g, (match, bodyInner) => {
    let newInner = bodyInner.replace(/background-color:\s*#[0-9a-fA-F]+;/, 'background-color: var(--bg-main);');
    newInner += '\n  background-image: linear-gradient(rgba(14, 165, 233, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(14, 165, 233, 0.03) 1px, transparent 1px);\n  background-size: 40px 40px;';
    return `body {${newInner}}`;
});

// Update the header blur and color
content = content.replace(/background-color:\s*rgba\(10,\s*10,\s*12,\s*0\.92\);/g, 'background-color: rgba(2, 6, 23, 0.95);');
content = content.replace(/backdrop-filter:\s*blur\(16px\);/g, 'backdrop-filter: blur(8px);');

fs.writeFileSync(absCssPath, content, 'utf-8');
console.log('globals.css updated successfully.');
