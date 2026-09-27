'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export default function GlobalReminder() {
  const { data: session, status } = useSession();
  const [reminders, setReminders] = useState<any[]>([]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const fetchReminders = async () => {
      try {
        const res = await fetch('/api/reminders');
        if (res.ok) {
          const data = await res.json();
          setReminders(data);
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
    if (reminders.length === 0) return;

    // --- CAPACITOR (NATIVE) NOTIFICATIONS ---
    if (Capacitor.isNativePlatform()) {
      const scheduleNative = async () => {
        try {
          const permStatus = await LocalNotifications.checkPermissions();
          if (permStatus.display !== 'granted') {
            await LocalNotifications.requestPermissions();
          }

          // Clear existing to prevent duplicates
          await LocalNotifications.cancel({ notifications: reminders.map(r => ({ id: parseInt(r.id.replace(/\D/g, '').substring(0, 8)) || 1 })) });
          
          // Actually, dynamic scheduling based on `times_json` for native is complex to write without full cron plugins.
          // Let's use the same checking loop but trigger native notifications instead of web ones!
        } catch (e) { console.error('Native notification error', e); }
      };
      scheduleNative();
    }

    // --- WEB / NATIVE POLL LOOP ---
    const checkInterval = setInterval(async () => {
      const now = new Date();
      const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      const today = now.toDateString();
      
      reminders.forEach(async r => {
        try {
          const timesArr = JSON.parse(r.times_json || '[]');
          if (timesArr.includes(currentHHMM)) {
            const cacheKey = `notified_${r.id}_${today}_${currentHHMM}`;
            if (!localStorage.getItem(cacheKey)) {
              localStorage.setItem(cacheKey, 'true');
              
              if (Capacitor.isNativePlatform()) {
                await LocalNotifications.schedule({
                  notifications: [{
                    title: `Medication: ${r.drug_name}`,
                    body: `Time to take ${r.dosage}. ${r.instructions || ''}`,
                    id: Math.floor(Math.random() * 100000),
                    schedule: { at: new Date(Date.now() + 1000) }, // Trigger almost immediately
                    actionTypeId: "",
                    extra: null
                  }]
                });
              } else if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`Medication Reminder: ${r.drug_name}`, {
                  body: `It's time to take ${r.dosage}. ${r.instructions || ''}`,
                  icon: '/icon-512.jpg'
                });
              }
            }
          }
        } catch (e) {}
      });
    }, 15000); // check every 15 seconds

    return () => clearInterval(checkInterval);
  }, [reminders]);

  return null;
}
