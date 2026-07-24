import { useState, useEffect } from "react";
import { isUnivNumberHidden, setUnivNumberHidden } from "@/lib/privacy";

export function useUnivPrivacy(userId: string | undefined | null) {
  const [isHidden, setIsHidden] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    const fetchIt = async () => {
      const hidden = await isUnivNumberHidden(userId);
      if (mounted) setIsHidden(hidden);
    };

    fetchIt();

    const handleChanged = () => {
      fetchIt();
    };

    window.addEventListener("univ_privacy_changed", handleChanged);
    return () => {
      mounted = false;
      window.removeEventListener("univ_privacy_changed", handleChanged);
    };
  }, [userId]);

  const togglePrivacy = async () => {
    if (!userId) return !isHidden;
    const nextState = !isHidden;
    setIsHidden(nextState); // optimistic update
    await setUnivNumberHidden(userId, nextState);
    return nextState;
  };

  return { isHidden, togglePrivacy };
}
