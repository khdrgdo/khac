import { useState, useEffect } from "react";
import { isUnivNumberHidden, setUnivNumberHidden } from "@/lib/privacy";

export function useUnivPrivacy(userId: string | undefined | null) {
  const [isHidden, setIsHidden] = useState<boolean>(() => isUnivNumberHidden(userId));

  useEffect(() => {
    setIsHidden(isUnivNumberHidden(userId));

    const handleChanged = () => {
      setIsHidden(isUnivNumberHidden(userId));
    };

    window.addEventListener("univ_privacy_changed", handleChanged);
    window.addEventListener("storage", handleChanged);
    return () => {
      window.removeEventListener("univ_privacy_changed", handleChanged);
      window.removeEventListener("storage", handleChanged);
    };
  }, [userId]);

  const togglePrivacy = () => {
    if (!userId) return !isHidden;
    const nextState = !isHidden;
    setUnivNumberHidden(userId, nextState);
    setIsHidden(nextState);
    return nextState;
  };

  return { isHidden, togglePrivacy };
}
