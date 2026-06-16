import { useEffect } from 'react';

const usePing = (): void => {
  useEffect(() => {
    const ping = (): void => {
      fetch(`${import.meta.env.VITE_API_URL}/ping`)
        .catch(() => {});
    };

    ping();
    const interval = setInterval(ping, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
};

export default usePing;