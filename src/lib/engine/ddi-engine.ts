import { getDatabase } from '../db';
export interface DrugRecord {
  id: string;
  generic_name: string;
  brand_names: string;
  drug_class: string;
  sub_class: string;
  description: string;
  mechanism_of_action: string;
  indications: string;
  contraindications: string;
  absorption: string;
  bioavailability: string;
  distribution: string;
  protein_binding: string;
  volume_of_distribution: string;
  metabolism: string;
  half_life: string;
  excretion: string;
  clearance: string;
  typical_dose_range: string;
  max_daily_dose: string;
  dose_adjustments: string;
  hepatotoxicity_risk: string;
  nephrotoxicity_risk: string;
  cardiotoxicity_risk: string;
  neurotoxicity_risk: string;
  hematotoxicity_risk: string;
  ld50: string;
  therapeutic_index: string;
  approval_status: string;
}

export async function searchDrugs(query: string): Promise<DrugRecord[]> {
  const pool = getDatabase();
  const q = `%${query}%`;
  const result = await pool.query(`
    SELECT * FROM drugs WHERE generic_name ILIKE $1 OR brand_names ILIKE $2 OR drug_class ILIKE $3
    ORDER BY CASE WHEN generic_name ILIKE $4 THEN 0 ELSE 1 END, generic_name
    LIMIT 20
  `, [q, q, q, `${query}%`]);
  return result.rows as DrugRecord[];
}

export async function getDrugById(id: string): Promise<DrugRecord | undefined> {
  const pool = getDatabase();
  const result = await pool.query('SELECT * FROM drugs WHERE id = $1', [id]);
  return result.rows[0] as DrugRecord | undefined;
}

export async function getDrugEnzymes(drugId: string) {
  const pool = getDatabase();
  const result = await pool.query('SELECT * FROM drug_enzymes WHERE drug_id = $1', [drugId]);
  return result.rows;
}

export async function getDrugTransporters(drugId: string) {
  const pool = getDatabase();
  const result = await pool.query('SELECT * FROM drug_transporters WHERE drug_id = $1', [drugId]);
  return result.rows;
}

export async function getInteractions(drug1Id: string, drug2Id: string) {
  const pool = getDatabase();
  const result = await pool.query(`
    SELECT i.*, s.title as source_title, s.publisher as source_publisher, s.url as source_url
    FROM interactions i
    LEFT JOIN sources s ON POSITION(s.id IN i.source_ids) > 0
    WHERE (i.drug1_id = $1 AND i.drug2_id = $2) OR (i.drug1_id = $3 AND i.drug2_id = $4)
  `, [drug1Id, drug2Id, drug2Id, drug1Id]);
  return result.rows;
}

export async function getAlternatives(drugId: string) {
  const pool = getDatabase();
  const result = await pool.query(`
    SELECT a.*, d.generic_name as alt_name, d.drug_class as alt_class
    FROM alternatives a
    JOIN drugs d ON a.alternative_drug_id = d.id
    WHERE a.original_drug_id = $1
  `, [drugId]);
  return result.rows;
}

export async function getSources(sourceIds: string[]) {
  if (sourceIds.length === 0) return [];
  const pool = getDatabase();
  const placeholders = sourceIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await pool.query(`SELECT * FROM sources WHERE id IN (${placeholders})`, sourceIds);
  return result.rows;
}

export async function buildEvidenceBundle(drug1Id: string, drug2Id: string): Promise<any> {
  const drug1 = await getDrugById(drug1Id);
  const drug2 = await getDrugById(drug2Id);
  if (!drug1 || !drug2) throw new Error('Drug not found');

  const interactions = await getInteractions(drug1Id, drug2Id);
  const drug1Enzymes = await getDrugEnzymes(drug1Id);
  const drug2Enzymes = await getDrugEnzymes(drug2Id);
  const drug1Transporters = await getDrugTransporters(drug1Id);
  const drug2Transporters = await getDrugTransporters(drug2Id);
  const alt1 = await getAlternatives(drug1Id);
  const alt2 = await getAlternatives(drug2Id);

  // Collect all source IDs
  const sourceIdSet = new Set<string>();
  interactions.forEach((i: any) => {
    try { JSON.parse(i.source_ids || '[]').forEach((s: string) => sourceIdSet.add(s)); } catch {}
  });
  [...drug1Enzymes, ...drug2Enzymes].forEach((e: any) => {
    if (e.source_id) sourceIdSet.add(e.source_id);
  });

  const sources = await getSources(Array.from(sourceIdSet));

  return {
    drug1: drug1 as unknown as Record<string, unknown>,
    drug2: drug2 as unknown as Record<string, unknown>,
    interactionRecords: interactions as unknown as Record<string, unknown>[],
    drug1Enzymes: drug1Enzymes as unknown as Record<string, unknown>[],
    drug2Enzymes: drug2Enzymes as unknown as Record<string, unknown>[],
    drug1Transporters: drug1Transporters as unknown as Record<string, unknown>[],
    drug2Transporters: drug2Transporters as unknown as Record<string, unknown>[],
    alternatives: [...alt1, ...alt2] as unknown as Record<string, unknown>[],
    sources: sources as unknown as Record<string, unknown>[],
  };
}
