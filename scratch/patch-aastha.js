const fs = require('fs');

const filePath = 'c:/Users/Ashirwad/Desktop/projects/farma ddi checker/src/components/AasthaChat.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the inlineStyle definition
content = content.replace(
  /const inlineStyle = inline \? \{[\s\S]*?\} : \{\};/,
  `const inlineStyle = inline ? {
    position: 'relative' as const,
    height: '550px', // Fixed height so it does not squish when virtual keyboard opens
    width: '100%',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    border: '1px solid var(--border)',
    zIndex: 10,
    bottom: 'auto',
    right: 'auto',
  } : {};`
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('AasthaChat.tsx inlineStyle patched successfully');
