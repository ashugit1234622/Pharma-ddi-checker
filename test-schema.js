const Database = require('better-sqlite3');
try {
  const db = new Database('./test.db');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS drugs (
      id TEXT PRIMARY KEY, generic_name TEXT NOT NULL, brand_names TEXT DEFAULT '[]',
      drug_class TEXT, sub_class TEXT, description TEXT, mechanism_of_action TEXT,
      indications TEXT DEFAULT '[]', contraindications TEXT DEFAULT '[]',
      absorption TEXT, bioavailability TEXT, distribution TEXT, protein_binding TEXT,
      volume_of_distribution TEXT, metabolism TEXT, half_life TEXT, excretion TEXT, clearance TEXT,
      typical_dose_range TEXT, max_daily_dose TEXT, dose_adjustments TEXT,
      hepatotoxicity_risk TEXT DEFAULT 'unknown', nephrotoxicity_risk TEXT DEFAULT 'unknown',
      cardiotoxicity_risk TEXT DEFAULT 'unknown', neurotoxicity_risk TEXT DEFAULT 'unknown',
      hematotoxicity_risk TEXT DEFAULT 'unknown', ld50 TEXT, therapeutic_index TEXT,
      approval_status TEXT DEFAULT 'approved',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS drug_enzymes (
      id TEXT PRIMARY KEY, drug_id TEXT NOT NULL, enzyme_name TEXT NOT NULL,
      role TEXT NOT NULL, strength TEXT, evidence_level TEXT DEFAULT 'established',
      notes TEXT, source_id TEXT, FOREIGN KEY (drug_id) REFERENCES drugs(id)
    );
    CREATE TABLE IF NOT EXISTS drug_transporters (
      id TEXT PRIMARY KEY, drug_id TEXT NOT NULL, transporter_name TEXT NOT NULL,
      role TEXT NOT NULL, significance TEXT, evidence_level TEXT DEFAULT 'established',
      notes TEXT, source_id TEXT, FOREIGN KEY (drug_id) REFERENCES drugs(id)
    );
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY, drug1_id TEXT NOT NULL, drug2_id TEXT NOT NULL,
      severity TEXT NOT NULL, interaction_type TEXT NOT NULL, mechanism TEXT,
      clinical_description TEXT, management TEXT, onset TEXT,
      documentation_level TEXT DEFAULT 'established',
      effect_on_drug1 TEXT, effect_on_drug2 TEXT, source_ids TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (drug1_id) REFERENCES drugs(id), FOREIGN KEY (drug2_id) REFERENCES drugs(id)
    );
    CREATE TABLE IF NOT EXISTS alternatives (
      id TEXT PRIMARY KEY, original_drug_id TEXT NOT NULL, alternative_drug_id TEXT NOT NULL,
      therapeutic_equivalence TEXT, rationale TEXT, evidence_level TEXT, source_id TEXT,
      FOREIGN KEY (original_drug_id) REFERENCES drugs(id),
      FOREIGN KEY (alternative_drug_id) REFERENCES drugs(id)
    );
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, publisher TEXT, url TEXT,
      publication_date TEXT, access_date TEXT, evidence_type TEXT, description TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_analyses (
      id TEXT PRIMARY KEY, drug1_id TEXT NOT NULL, drug2_id TEXT NOT NULL,
      status TEXT NOT NULL, severity TEXT, confidence TEXT, executive_summary TEXT,
      structured_result TEXT NOT NULL, model TEXT, model_version TEXT,
      prompt_version TEXT NOT NULL, evidence_bundle_hash TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (drug1_id) REFERENCES drugs(id), FOREIGN KEY (drug2_id) REFERENCES drugs(id)
    );
    CREATE TABLE IF NOT EXISTS qa_history (
      id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL, question TEXT NOT NULL,
      answer TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (analysis_id) REFERENCES ai_analyses(id)
    );
    CREATE INDEX IF NOT EXISTS idx_drugs_generic_name ON drugs(generic_name);
    CREATE INDEX IF NOT EXISTS idx_drug_enzymes_drug_id ON drug_enzymes(drug_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_drugs ON interactions(drug1_id, drug2_id);
    CREATE INDEX IF NOT EXISTS idx_ai_analyses_drugs ON ai_analyses(drug1_id, drug2_id);

    -- NextAuth tables (standard schema for databases)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      emailVerified TEXT,
      image TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Patient profile (onboarding data)
    CREATE TABLE IF NOT EXISTS patient_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      display_name TEXT,
      age INTEGER,
      gender TEXT,
      blood_group TEXT,
      underlying_diseases TEXT DEFAULT '[]',
      allergies TEXT DEFAULT '[]',
      current_medications TEXT DEFAULT '[]',
      medical_history TEXT,
      emergency_contact TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON patient_profiles(user_id);
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      providerAccountId TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      sessionToken TEXT UNIQUE NOT NULL,
      userId TEXT NOT NULL,
      expires TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires TEXT NOT NULL,
      PRIMARY KEY (identifier, token)
    );

    -- Patient History Hub
    CREATE TABLE IF NOT EXISTS patient_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      record_type TEXT NOT NULL, -- 'ddi_check', 'prescription_ocr', 'medcheck'
      title TEXT NOT NULL,
      summary TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_patient_records_user_id ON patient_records(user_id);

    -- Medication Reminders
    CREATE TABLE IF NOT EXISTS medication_reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      drug_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      times_json TEXT NOT NULL,
      instructions TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_medication_reminders_user_id ON medication_reminders(user_id);

    -- Dose Logs
    CREATE TABLE IF NOT EXISTS dose_logs (
      id TEXT PRIMARY KEY,
      reminder_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      status TEXT NOT NULL, -- 'taken', 'skipped'
      logged_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (reminder_id) REFERENCES medication_reminders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_dose_logs_reminder_user ON dose_logs(reminder_id, user_id);
  `);
  console.log('SUCCESS');
} catch (e) {
  console.error('ERROR:', e);
}
