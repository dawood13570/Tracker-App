import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';
import { getAppToday, isEligibleToFinalizeDay } from '../utils/date';
export function useAppDay() {
  const boundary = useStore(s => s.dayBoundaryHour);
  const night = useStore(s => s.nightOwlMode);
  const override = useStore(s => s.manualDayOverrideDate);
  const [day, setDay] = useState(getAppToday);
  useEffect(() => {
    const refresh = () => setDay(getAppToday());
    refresh();
    const timer = setInterval(refresh, 15000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [boundary, night, override]);
  return day;
}

export function useCanFinalizeDay() {
  const boundary = useStore(s => s.dayBoundaryHour);
  const night = useStore(s => s.nightOwlMode);
  const override = useStore(s => s.manualDayOverrideDate);
  const [eligible, setEligible] = useState(isEligibleToFinalizeDay);
  useEffect(() => {
    const refresh = () => setEligible(isEligibleToFinalizeDay());
    refresh(); const timer = setInterval(refresh, 15000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [boundary, night, override]);
  return eligible;
}
