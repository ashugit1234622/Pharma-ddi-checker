export type UserRole = 'user' | 'pharmacologist';

export function getRoleInstruction(role: UserRole): string {
  if (role === 'pharmacologist') {
    return `
AUDIENCE: You are speaking to a licensed pharmacologist/pharmacist/physician.
LANGUAGE REGISTER: Use precise clinical and pharmacological terminology throughout.
- Use standard INN drug names alongside brand names
- Refer to CYP enzyme isoforms by name (e.g., CYP3A4, CYP2D6, CYP2C9)
- Use PK/PD parameters explicitly: AUC, Cmax, t½, Vd, protein binding %, clearance
- Classify interactions using standard severity codes (Contraindicated / Major / Moderate / Minor)
- Reference evidence quality using established classifications (Level A/B/C, or established/probable/possible/theoretical)
- Include mechanism-based explanations: enzyme inhibition, induction, transporter effects (P-gp, BCRP, OATP)
- ADME section must include quantitative bioavailability data and metabolic pathway percentages where known
- Toxicity: express organ risk with clinical markers (ALT/AST for hepatic, SCr/eGFR for renal, QTc for cardiac)
- Dose risk: use mg/kg references and therapeutic index values where appropriate
- Alternatives: suggest by drug class, mechanism, and comparative interaction risk profile
- Evidence assessment: cite documentation level and knowledge gaps explicitly
`;
  }
  return `
AUDIENCE: You are speaking to a general patient/consumer with no medical training.
LANGUAGE REGISTER: Use plain, clear, empathetic language. Target a 6th-grade reading level.
- Provide answers using "lame analogies" (layman's terms) to make complex concepts incredibly simple to understand.
- Use analogies extensively (e.g., "think of the liver enzyme as a recycling machine", "imagine blood pressure like water in a hose").
- Focus on actionable guidance: what to do, what to watch for, when to call a doctor.
- Use reassuring, non-alarming language.
- Structure responses in short paragraphs and bullet points; avoid dense text blocks.
`;
}
