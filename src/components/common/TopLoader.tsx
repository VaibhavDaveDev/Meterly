import * as Progress from '@radix-ui/react-progress';
import { useEffect, useState } from 'react';
import { useProgressState } from '@/lib/progress-state';

export function TopLoader() {
  const loading = useProgressState();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!loading) {
      setValue(0);
      return;
    }

    // ponytail: simple progress simulation
    setValue(5);
    const interval = setInterval(() => {
      setValue((oldValue) => {
        if (oldValue >= 90) return oldValue;
        const diff = Math.random() * 15;
        return Math.min(oldValue + diff, 90);
      });
    }, 200);

    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!loading && value > 0) {
      setValue(100);
      const timeout = setTimeout(() => setValue(0), 300);
      return () => clearTimeout(timeout);
    }
  }, [loading, value]);

  if (value === 0) return null;

  return (
    <Progress.Root
      className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-transparent overflow-hidden"
      value={value}
    >
      <Progress.Indicator
        className="bg-primary h-full w-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </Progress.Root>
  );
}
