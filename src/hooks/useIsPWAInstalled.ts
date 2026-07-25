import { useState, useEffect } from "react";

export function useIsPWAInstalled() {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkStandalone();

    const mql = window.matchMedia("(display-mode: standalone)");
    mql.addEventListener("change", checkStandalone);
    return () => {
      mql.removeEventListener("change", checkStandalone);
    };
  }, []);

  return isInstalled;
}
