'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { calculateCycle } from '@/lib/cycle-tracker';

export default function GlobalReminder() {
  const { data: session, status } = useSession();
  const [reminders, setReminders] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const fetchReminders = async () => {
      try {
        const res = await fetch('/api/reminders');
        if (res.ok) {
          const data = await res.json();
          setReminders(data);
        }

        // Also fetch profile for cycle tracking
        const profRes = await fetch('/api/profile');
        if (profRes.ok) {
          const profData = await profRes.json();
          if (profData.profile) {
            setProfile(profData.profile);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchReminders();
    const fetchInterval = setInterval(fetchReminders, 5 * 60 * 1000);
    return () => clearInterval(fetchInterval);
  }, [status]);

  useEffect(() => {
    if (reminders.length === 0 && !profile) return;

    // --- WEB NOTIFICATION POLL LOOP ---
    const checkInterval = setInterval(async () => {
      const now = new Date();
      const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      const today = now.toDateString();

      reminders.forEach(r => {
        try {
          const timesArr = JSON.parse(r.times_json || '[]');
          if (timesArr.includes(currentHHMM)) {
            const cacheKey = `notified_${r.id}_${today}_${currentHHMM}`;
            if (!localStorage.getItem(cacheKey)) {
              localStorage.setItem(cacheKey, 'true');
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`Medication Reminder: ${r.drug_name}`, {
                  body: `It's time to take ${r.dosage}. ${r.instructions || ''}`,
                  icon: '/icon-512.png'
                });
              }
            }
          }
        } catch (e) {}
      });

      // --- CYCLE NOTIFICATIONS ---
      if (profile && profile.gender === 'female' && profile.last_menstruation_date) {
        try {
          const calculated = calculateCycle({
            lastPeriodDate: new Date(profile.last_menstruation_date),
            age: profile.age || 30,
            conditions: JSON.parse(profile.underlying_diseases || '[]'),
            medications: JSON.parse(profile.current_medications || '[]'),
            menstruation_details: profile.menstruation_details ? (typeof profile.menstruation_details === 'string' ? JSON.parse(profile.menstruation_details) : profile.menstruation_details) : undefined
          });

          const daysUntilNext = Math.ceil((calculated.nextPeriodDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

          let cycleNotifTitle = '';
          let cycleNotifBody = '';
          let notifId = 'cycle_none';

          if (daysUntilNext === 2) {
            cycleNotifTitle = 'Cycle Tracker';
            cycleNotifBody = 'Your next period is expected in 2 days. Make sure to rest and stay hydrated.';
            notifId = `cycle_pre_${today}`;
          } else if (daysUntilNext === 0) {
            cycleNotifTitle = 'Cycle Tracker';
            cycleNotifBody = 'Your period is expected to start today.';
            notifId = `cycle_start_${today}`;
          } else {
            const phaseStartingToday = calculated.phases.find(p =>
              new Date(p.startDate).toDateString() === today && p.name !== 'Menstruation'
            );
            if (phaseStartingToday) {
              cycleNotifTitle = 'Cycle Phase Update';
              cycleNotifBody = `You have entered the ${phaseStartingToday.name}. ${phaseStartingToday.description}`;
              notifId = `cycle_phase_${phaseStartingToday.name}_${today}`;
            }
          }

          if (cycleNotifTitle && notifId !== 'cycle_none') {
            const cacheKey = `notified_${notifId}`;
            if (!localStorage.getItem(cacheKey)) {
              localStorage.setItem(cacheKey, 'true');
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(cycleNotifTitle, {
                  body: cycleNotifBody,
                  icon: '/icon-512.png'
                });
              }
            }
          }
        } catch (e) { console.error('Cycle notif error', e); }
      }
    }, 15000); // check every 15 seconds

    return () => clearInterval(checkInterval);
  }, [reminders, profile]);

  return null;
}
