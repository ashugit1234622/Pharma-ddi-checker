'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

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
    // Fetch every 5 minutes just in case
    const fetchInterval = setInterval(fetchReminders, 5 * 60 * 1000);
    return () => clearInterval(fetchInterval);
  }, [status]);

  useEffect(() => {
    if (reminders.length === 0) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const checkInterval = setInterval(() => {
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
              new Notification(`Medication Reminder: ${r.drug_name}`, {
                body: `It's time to take ${r.dosage}. ${r.instructions || ''}`,
                icon: '/icon-512.jpg'
              });
            }
          }
        } catch (e) {}
      });
    }, 15000); // check every 15 seconds

    return () => clearInterval(checkInterval);
  }, [reminders]);

  return null; // This is a background component
}
