'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Info,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Pill,
  Activity,
  UserCheck,
  FileText,
  HelpCircle,
  Stethoscope
} from 'lucide-react';
import { SafetyResolutionResult } from '@/lib/safety/resolver';
import { IndividualDrugSafetyProfile } from '@/lib/safety/schema';

interface IndividualDrugSafetyProps {
  drug1Name: string;
  drug2Name: string;
  drug1Safety: SafetyResolutionResult | null;
  drug2Safety: SafetyResolutionResult | null;
  loading?: boolean;
}

export default function IndividualDrugSafetySection({
  drug1Name,
  drug2Name,
  drug1Safety,
  drug2Safety,
  loading = false,
}: IndividualDrugSafetyProps) {
  return (
    <div className="section-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Section Header ── */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <ShieldAlert size={26} style={{ color: 'var(--accent-primary)' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
            Individual Drug Safety & Monotherapy Risk
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Individual safety profiles, contraindications, black-box warnings, and adverse effect profiles
          for each drug independently. While pairwise DDI analysis evaluates concurrent administration risk,
          monotherapy contraindications and single-agent warnings must always be verified first.
        </p>
      </div>

      {/* ── Two-Column Side-by-Side Responsive Layout ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* Drug A Profile */}
        <DrugProfileCard
          label="Drug A"
          queriedName={drug1Name}
          resolution={drug1Safety}
          loading={loading}
          accentColor="var(--accent-primary)"
        />

        {/* Drug B Profile */}
        <DrugProfileCard
          label="Drug B"
          queriedName={drug2Name}
          resolution={drug2Safety}
          loading={loading}
          accentColor="var(--accent-secondary, #38bdf8)"
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DRUG PROFILE CARD (Handles Loading, Error, Ambiguous, Unavailable & Data)
══════════════════════════════════════════════════════════════════════════════ */

interface DrugProfileCardProps {
  label: string;
  queriedName: string;
  resolution: SafetyResolutionResult | null;
  loading: boolean;
  accentColor: string;
}

function DrugProfileCard({
  label,
  queriedName,
  resolution,
  loading,
  accentColor,
}: DrugProfileCardProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  // 1. Loading State
  if (loading || !resolution) {
    return (
      <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <PanelHeader label={label} drugName={queriedName} accentColor={accentColor} badgeText="Loading..." badgeColor="var(--text-dim)" />
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '60px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '40px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>
    );
  }

  // 2. Ambiguous / Combination-Product Guard State
  if (resolution.status === 'ambiguous') {
    return (
      <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.03)' }}>
        <PanelHeader label={label} drugName={queriedName} accentColor={accentColor} badgeText="Ambiguous / Combination" badgeColor="var(--warning)" />
        <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--warning)', fontSize: '0.92rem', marginBottom: '0.4rem' }}>
            <AlertTriangle size={18} />
            Combination Product / Form-Scope Ambiguity
          </div>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {resolution.ambiguityReason || 'The exact formulation or component ratio must be confirmed by a clinician. Single-ingredient safety parameters cannot be silently assumed for combination products.'}
          </p>
        </div>
      </div>
    );
  }

  // 3. Unavailable State (Known Outside Pilot vs Unknown Drug)
  if (resolution.status === 'unavailable' || !resolution.profile) {
    return (
      <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <PanelHeader label={label} drugName={queriedName} accentColor={accentColor} badgeText="Uncataloged" badgeColor="var(--text-dim)" />
        <EmptyStateNotice text={resolution.unavailableReason || 'Individual safety information is not yet available in the current catalog.'} />
      </div>
    );
  }

  const profile = resolution.profile;
  const specPops = profile.precautionsAndSpecialPopulations;

  // 4. Available or Partial Profile Render
  return (
    <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Panel Header ── */}
      <PanelHeader
        label={label}
        drugName={profile.genericName}
        subtitle={queriedName.toLowerCase() !== profile.genericName.toLowerCase() ? `Matched from query: "${queriedName}"` : undefined}
        accentColor={accentColor}
        badgeText={resolution.status === 'available' ? 'Verified Profile' : 'Partial Data'}
        badgeColor={resolution.status === 'available' ? 'var(--success)' : 'var(--warning)'}
      />

      {/* ── Formulation & Product Scope ── */}
      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '0.25rem' }}>
          <Pill size={15} style={{ color: accentColor }} />
          Formulation Scope: {profile.productScope.formulationDescription}
        </div>
        {profile.productScope.scopeNotes && (
          <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.5, fontSize: '0.8rem' }}>
            {profile.productScope.scopeNotes}
          </p>
        )}
      </div>

      {/* ── Boxed Warning (Black Box Warning) ── */}
      {profile.boxedWarning && profile.boxedWarning.present ? (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderLeft: '5px solid var(--danger)',
          borderRadius: '8px',
          padding: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.4rem' }}>
            <AlertOctagon size={19} />
            [!] BOXED WARNING: {profile.boxedWarning.title || 'Severe Safety Warning'}
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
            {profile.boxedWarning.summary}
          </p>
        </div>
      ) : (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '0.4rem 0.6rem', background: 'var(--bg-main)', borderRadius: '4px', border: '1px solid var(--border)' }}>
          No FDA Boxed Warning issued for this active ingredient. Standard warnings and contraindications apply.
        </div>
      )}

      {/* ── Contraindications ── */}
      <div>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.6rem', color: 'var(--text-main)' }}>
          <AlertTriangle size={17} style={{ color: 'var(--danger)' }} />
          Contraindications ({profile.contraindications.length})
        </h4>
        {profile.contraindications.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', margin: 0, fontStyle: 'italic' }}>
            No absolute contraindications listed in pilot record. (Absence does not imply safety across unlisted conditions.)
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {profile.contraindications.map((ci) => (
              <div key={ci.id} style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderLeft: ci.category === 'absolute' ? '3px solid var(--danger)' : '3px solid var(--warning)',
                borderRadius: '6px',
                padding: '0.55rem 0.75rem',
                fontSize: '0.82rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>{ci.clinicalCondition}</strong>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: ci.category === 'absolute' ? 'var(--danger)' : 'var(--warning)' }}>
                    {ci.category}
                  </span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.45, fontSize: '0.78rem' }}>
                  {ci.rationale}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Common Adverse Effects ── */}
      <div>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.6rem', color: 'var(--text-main)' }}>
          <Activity size={17} style={{ color: 'var(--warning)' }} />
          Common Adverse Reactions
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {profile.commonAdverseEffects.map((ae) => (
            <div key={ae.id} style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{ae.reaction}</span>
              {ae.frequencyRange && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                  {ae.frequencyRange}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Special Populations (Pregnancy, Lactation, Renal, Hepatic) ── */}
      <div>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.6rem', color: 'var(--text-main)' }}>
          <UserCheck size={17} style={{ color: 'var(--accent-primary)' }} />
          Special Populations & Organ Function
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
          <SpecialPopCard
            title="Pregnancy"
            statusText={specPops.pregnancy.status}
            summary={specPops.pregnancy.summary}
            isContra={specPops.pregnancy.status === 'contraindicated'}
            isCaution={specPops.pregnancy.status.includes('caution')}
          />
          <SpecialPopCard
            title="Lactation"
            statusText={specPops.lactation.status}
            summary={specPops.lactation.summary}
            isContra={specPops.lactation.status === 'contraindicated'}
            isCaution={specPops.lactation.status.includes('caution')}
          />
          <SpecialPopCard
            title="Renal Function"
            statusText={specPops.renalImpairment.doseAdjustmentRequired ? 'Adjustment Required' : 'Standard'}
            summary={specPops.renalImpairment.guidance}
            isContra={Boolean(specPops.renalImpairment.contraindicatedCutoff)}
            isCaution={specPops.renalImpairment.doseAdjustmentRequired}
          />
          <SpecialPopCard
            title="Hepatic Function"
            statusText={specPops.hepaticImpairment.contraindicatedInSevere ? 'Contraindicated Severe' : 'Caution/Monitor'}
            summary={specPops.hepaticImpairment.guidance}
            isContra={specPops.hepaticImpairment.contraindicatedInSevere}
            isCaution={true}
          />
          {specPops.geriatric && (
            <SpecialPopCard
              title="Geriatric"
              statusText="Precaution"
              summary={specPops.geriatric.guidance}
              isContra={false}
              isCaution={true}
            />
          )}
          {specPops.pediatric && (
            <SpecialPopCard
              title="Pediatric"
              statusText="Precaution"
              summary={specPops.pediatric.guidance}
              isContra={false}
              isCaution={true}
            />
          )}
        </div>
      </div>

      {/* ── Dosage & Administration Context ── */}
      {profile.dosageAndAdministrationContext && (
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
            <Clock size={16} style={{ color: 'var(--accent-primary)' }} />
            Administration & Dose Context
          </div>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {profile.dosageAndAdministrationContext.standardAdultContext}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.6rem' }}>
            <span><strong>Route:</strong> {profile.dosageAndAdministrationContext.route}</span>
            <span><strong>Ceiling Dose:</strong> {profile.dosageAndAdministrationContext.maxCeilingDose}</span>
            {profile.dosageAndAdministrationContext.titrationGuidance && (
              <span><strong>Titration:</strong> {profile.dosageAndAdministrationContext.titrationGuidance}</span>
            )}
          </div>
          <div style={{
            background: 'rgba(15, 23, 42, 0.9)',
            borderLeft: '3px solid var(--warning)',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            lineHeight: 1.4
          }}>
            <strong style={{ color: 'var(--warning)' }}>Prescription Notice:</strong> {profile.dosageAndAdministrationContext.mandatoryDisclaimer}
          </div>
        </div>
      )}

      {/* ── Adverse Reaction Triage Guidance with Distinction of Drug-Specific Management vs General Emergency ── */}
      <div>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.6rem', color: 'var(--text-main)' }}>
          <HelpCircle size={17} style={{ color: 'var(--accent-primary)' }} />
          Adverse Reaction Action Guidance
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {profile.adverseReactionGuidance.map((adr) => {
            const isEmergency = adr.urgency === 'emergency_immediate_care';
            const isUrgent = adr.urgency === 'urgent_physician_consult';
            const borderCol = isEmergency ? 'var(--danger)' : isUrgent ? 'var(--warning)' : 'var(--accent-primary)';
            
            // Distinguish drug-specific clinical management (antidote/timing/discontinuation/TDM) from general triage
            const lowerAction = adr.recommendedAction.toLowerCase();
            const isDrugSpecific = lowerAction.includes('n-acetylcysteine') ||
                                   lowerAction.includes('discontinue') ||
                                   lowerAction.includes('stop') ||
                                   lowerAction.includes('inr') ||
                                   lowerAction.includes('vitamin k') ||
                                   lowerAction.includes('creatine kinase') ||
                                   lowerAction.includes('ck level') ||
                                   lowerAction.includes('antidote') ||
                                   lowerAction.includes('lactate');

            return (
              <div key={adr.id} style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${borderCol}`,
                borderRadius: '6px',
                padding: '0.65rem 0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: borderCol }}>
                    {isEmergency ? 'Emergency Care' : isUrgent ? 'Urgent Doctor Consultation' : 'Routine Monitoring'}
                  </span>
                  
                  {/* Distinct Management Classification Badge */}
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '10px',
                    background: isDrugSpecific ? 'rgba(56, 189, 248, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                    border: isDrugSpecific ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(148, 163, 184, 0.3)',
                    color: isDrugSpecific ? '#38bdf8' : 'var(--text-dim)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    {isDrugSpecific ? <Stethoscope size={11} /> : null}
                    {isDrugSpecific ? 'Drug-Specific Clinical Management' : 'General Emergency Protocol'}
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                  Triggers: {adr.symptomsOrTriggers.join(', ')}
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {adr.recommendedAction}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Completeness & Non-Evidence of Safety Disclaimer ── */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px dashed var(--border)',
        borderRadius: '6px',
        padding: '0.6rem 0.8rem',
        fontSize: '0.74rem',
        color: 'var(--text-dim)',
        lineHeight: 1.45
      }}>
        <strong style={{ color: 'var(--text-muted)' }}>Clinical Completeness Notice:</strong> Profile availability indicates verified catalog coverage for listed parameters. The absence or non-listing of specific adverse effects, contraindications, or warnings does not constitute evidence of safety. Always cross-reference authoritative product inserts and clinical judgment.
      </div>

      {/* ── Source Citations & Provenance ── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
        <button
          onClick={() => setSourcesExpanded(!sourcesExpanded)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: '0.25rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
          aria-expanded={sourcesExpanded}
        >
          <FileText size={14} />
          {sourcesExpanded ? 'Hide Reference Citations' : `Show Reference Citations (${profile.sources.length})`}
          {sourcesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {sourcesExpanded && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {profile.sources.map((src) => (
              <div key={src.sourceId} style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.6rem 0.8rem', fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>{src.name}</strong>
                  {src.url ? (
                    <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-primary)' }}>
                      DailyMed <ExternalLink size={11} />
                    </a>
                  ) : null}
                </div>
                <div>ID: {src.referenceIdentifier} | Jurisdiction: {src.jurisdiction} {src.revisionDate ? `| Rev: ${src.revisionDate}` : ''}</div>
                <div style={{ marginTop: '0.2rem', fontStyle: 'italic' }}>Terms: {src.accessTermsAndLicensing}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   HELPER SUB-COMPONENTS
══════════════════════════════════════════════════════════════════════════════ */

function PanelHeader({
  label,
  drugName,
  subtitle,
  accentColor,
  badgeText,
  badgeColor,
}: {
  label: string;
  drugName: string;
  subtitle?: string;
  accentColor: string;
  badgeText: string;
  badgeColor: string;
}) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: accentColor, background: 'rgba(15, 23, 42, 0.8)', padding: '0.2rem 0.55rem', borderRadius: '4px', border: `1px solid ${accentColor}` }}>
            {label}
          </span>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {drugName}
          </h3>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.9)', border: `1px solid ${badgeColor}`, color: badgeColor }}>
          {badgeText}
        </span>
      </div>
      {subtitle && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

function SpecialPopCard({
  title,
  statusText,
  summary,
  isContra,
  isCaution,
}: {
  title: string;
  statusText: string;
  summary: string;
  isContra: boolean;
  isCaution: boolean;
}) {
  const badgeColor = isContra ? 'var(--danger)' : isCaution ? 'var(--warning)' : 'var(--success)';

  return (
    <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.55rem 0.8rem', fontSize: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
        <strong style={{ color: 'var(--text-main)', fontSize: '0.82rem' }}>{title}</strong>
        <span style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', color: badgeColor }}>
          {statusText.replace(/_/g, ' ')}
        </span>
      </div>
      <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.45, fontSize: '0.78rem' }}>
        {summary}
      </p>
    </div>
  );
}

function EmptyStateNotice({ text }: { text: string }) {
  return (
    <div style={{
      marginTop: '1.25rem',
      padding: '1.5rem',
      textAlign: 'center',
      background: 'rgba(15, 23, 42, 0.5)',
      borderRadius: '8px',
      border: '1px dashed var(--border)',
      color: 'var(--text-dim)',
      fontSize: '0.88rem',
      lineHeight: 1.5
    }}>
      <Info size={24} style={{ margin: '0 auto 0.5rem', color: 'var(--text-dim)', display: 'block' }} />
      {text}
    </div>
  );
}
