export interface CycleData {
  lastPeriodDate: Date;
  age: number;
  conditions: string[];
  medications: string[];
}

export interface PhasePrediction {
  name: string;
  startDate: Date;
  endDate: Date;
  description: string;
}

export interface CyclePrediction {
  cycleLength: number;
  periodLength: number;
  nextPeriodDate: Date;
  phases: PhasePrediction[];
  isIrregular: boolean;
  modifierNotes: string[];
}

export function calculateCycle(data: CycleData): CyclePrediction {
  // Base Assumptions
  let cycleLength = 28;
  let periodLength = 5;
  const lutealLength = 14; 
  let isIrregular = false;
  const modifierNotes: string[] = [];

  const medsLower = data.medications.map(m => m.toLowerCase());
  const condsLower = data.conditions.map(c => c.toLowerCase());

  // Check for hormonal contraceptives (birth control pills, etc)
  // Simple heuristic: "pill", "contraceptive", "ethinyl", "progestin", "levonorgestrel"
  const hasBirthControl = medsLower.some(m => 
    m.includes('pill') || m.includes('contraceptive') || m.includes('ethinyl') || m.includes('progestin') || m.includes('levonorgestrel')
  );

  // Check for PCOS or Thyroid disorders
  const hasPCOS = condsLower.some(c => c.includes('pcos') || c.includes('polycystic'));
  const hasThyroid = condsLower.some(c => c.includes('thyroid') || c.includes('hypothyroid') || c.includes('hyperthyroid'));

  if (hasBirthControl) {
    cycleLength = 28;
    isIrregular = false;
    modifierNotes.push("Your cycle length is highly predictable due to hormonal contraceptives.");
  } else {
    // Modify based on conditions
    if (hasPCOS) {
      cycleLength = 35; // PCOS often extends cycles
      isIrregular = true;
      modifierNotes.push("PCOS can cause irregular and longer cycles. Predictions have been adjusted.");
    } else if (hasThyroid) {
      isIrregular = true;
      modifierNotes.push("Thyroid conditions can cause cycle variability.");
    }

    // Modify based on age
    if (data.age > 40 && data.age < 55) {
      cycleLength = Math.max(21, cycleLength - 2); // Perimenopause often shortens cycles initially
      isIrregular = true;
      modifierNotes.push("Age-related hormonal shifts may cause shorter or irregular cycles.");
    }
  }

  // Calculate Dates
  const lastPeriod = new Date(data.lastPeriodDate);
  const nextPeriodDate = new Date(lastPeriod);
  nextPeriodDate.setDate(lastPeriod.getDate() + cycleLength);

  const ovulationDate = new Date(nextPeriodDate);
  ovulationDate.setDate(nextPeriodDate.getDate() - lutealLength);

  // Phases
  // 1. Menstruation
  const menstruationEnd = new Date(lastPeriod);
  menstruationEnd.setDate(lastPeriod.getDate() + periodLength - 1);

  // 2. Follicular
  const follicularStart = new Date(menstruationEnd);
  follicularStart.setDate(menstruationEnd.getDate() + 1);
  const follicularEnd = new Date(ovulationDate);
  follicularEnd.setDate(ovulationDate.getDate() - 3);

  // 3. Ovulation Window (Fertile Window)
  const fertileStart = new Date(ovulationDate);
  fertileStart.setDate(ovulationDate.getDate() - 2);
  const fertileEnd = new Date(ovulationDate);
  fertileEnd.setDate(ovulationDate.getDate() + 1); // egg lives 24h

  // 4. Luteal Phase
  const lutealStart = new Date(fertileEnd);
  lutealStart.setDate(fertileEnd.getDate() + 1);
  const lutealEnd = new Date(nextPeriodDate);
  lutealEnd.setDate(nextPeriodDate.getDate() - 1);

  const phases: PhasePrediction[] = [
    {
      name: "Menstruation",
      startDate: lastPeriod,
      endDate: menstruationEnd,
      description: "Shedding of the uterine lining."
    },
    {
      name: "Follicular Phase",
      startDate: follicularStart,
      endDate: follicularEnd,
      description: "Body prepares for ovulation. Energy levels usually rise."
    },
    {
      name: "Fertile Window",
      startDate: fertileStart,
      endDate: fertileEnd,
      description: "Highest chance of conception. Ovulation occurs during this window."
    },
    {
      name: "Luteal Phase",
      startDate: lutealStart,
      endDate: lutealEnd,
      description: "Body prepares for possible pregnancy. PMS symptoms may occur."
    }
  ];

  return {
    cycleLength,
    periodLength,
    nextPeriodDate,
    phases,
    isIrregular,
    modifierNotes
  };
}
