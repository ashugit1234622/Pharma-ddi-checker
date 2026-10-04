const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/Ashirwad/Desktop/projects/farma ddi checker/src/app/page.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace Hero Section
content = content.replace(
  /<div style={{ fontSize: '2\.5rem', marginBottom: '0\.5rem' }}>\s*<Pill size={48} style={{ color: 'var\(--accent-primary\)', filter: 'drop-shadow\(0 0 12px var\(--accent-glow\)\)' }} \/>\s*<\/div>\s*<h1 style={{ color: 'var\(--text-main\)', marginBottom: '0\.5rem' }}>\s*\{isPharmacologist \? 'Drug-Drug Interaction Checker' : 'Aastha Health Assistant'\}\s*<\/h1>\s*<p style={{ color: 'var\(--text-muted\)', fontSize: '1rem', maxWidth: '550px', margin: '0 auto' }}>\s*\{isPharmacologist \s*\? 'Select two drugs to check for interactions, view ADME & toxicity charts, and get AI-powered clinical analysis\.' \s*: 'Ask Aastha about your health, medications, or any medical questions you have\.'\}\s*<\/p>/g,
  `<h1 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', letterSpacing: '0.1em', fontWeight: 700, fontSize: '2rem' }}>
            {isPharmacologist ? 'FARMA DDI' : 'AASTHA'}
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem', maxWidth: '550px', margin: '0 auto', letterSpacing: '0.02em' }}>
            {isPharmacologist 
              ? 'Understand your medicines with clarity. Professional drug interaction analysis.' 
              : 'Your clinical health assistant. Ask about your health or medications.'}
          </p>`
);

// Make the drug search indicator much more subtle
content = content.replace(
  /className={`interaction-indicator \$\{report \? \(isInteraction \? 'indicator-danger' : 'indicator-safe'\) : 'indicator-pending'\}`}/g,
  `className={\`interaction-indicator \${report ? (isInteraction ? 'indicator-danger' : 'indicator-safe') : 'indicator-pending'}\`} style={{boxShadow: 'none', background: 'var(--bg-main)', border: '1px solid var(--border)'}}`
);

// Update DDI Search Container layout (remove massive spacing)
content = content.replace(
  /<div className="ddi-search-container">/g,
  '<div className="ddi-search-container" style={{ display: "flex", gap: "1rem", alignItems: "center", justifyContent: "center", flexWrap: "wrap", maxWidth: "900px", margin: "0 auto" }}>'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('page.tsx patched successfully');
