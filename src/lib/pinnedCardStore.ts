import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PinnedCardType = "poll" | "contest" | "event" | "announcement";
export type PinnedCardTheme = "royal" | "emerald" | "amber" | "sapphire" | "crimson" | "cyber";

export interface PollOption {
  id: string;
  text: string;
}

export interface PinnedCardConfig {
  id: string;
  enabled: boolean;
  type: PinnedCardType;
  theme: PinnedCardTheme;
  badgeText: string;
  title: string;
  description: string;
  imageUrl?: string;
  endDate?: string; // ISO date
  actionButtonText?: string;
  actionButtonUrl?: string;
  targetYear?: number | null;
  targetMajor?: string | null;
  pollOptions: PollOption[];
  votes: Record<string, string>; // userId -> optionId
  participants: string[]; // array of userIds
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PINNED_CARD: PinnedCardConfig = {
  id: "pinned_featured_event_1",
  enabled: true,
  type: "contest",
  theme: "royal",
  badgeText: "🏆 مسابقة الأسبوع المميزة",
  title: "تحدي البرمجة والحلول الأكاديمية - الدورة الثالثة",
  description:
    "شارك أفضل ملخص دراسي أو مشروع تطبيقي ونافس على جائزة أفضل مساهم أكاديمي! يتم تقييم المساهمات بناءً على تصويت زملائك بالكلية.",
  imageUrl: "",
  endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
  actionButtonText: "سجل في المسابقة الآن",
  actionButtonUrl: "",
  targetYear: null,
  targetMajor: null,
  pollOptions: [
    { id: "opt_1", text: "الذكاء الاصطناعي وتعلم الآلة" },
    { id: "opt_2", text: "تطبيقات الويب والأجهزة المحمولة" },
    { id: "opt_3", text: "الأمن السيبراني والشبكات" },
  ],
  votes: {},
  participants: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const STORAGE_KEY = "unihub_pinned_featured_card_v1";

export function getStoredPinnedCard(): PinnedCardConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PINNED_CARD, ...parsed };
    }
  } catch (err) {
    console.error("Failed to parse stored pinned card", err);
  }
  return DEFAULT_PINNED_CARD;
}

export function savePinnedCard(config: PinnedCardConfig): void {
  try {
    const updated = { ...config, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Dispatch custom event for same-tab reactive updates
    window.dispatchEvent(new CustomEvent("pinnedCardUpdated", { detail: updated }));
  } catch (err) {
    console.error("Failed to save pinned card", err);
  }
}

// React Hook to access and update pinned card config reactively
export function usePinnedCard() {
  const [config, setConfig] = useState<PinnedCardConfig>(getStoredPinnedCard);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<PinnedCardConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      } else {
        setConfig(getStoredPinnedCard());
      }
    };

    window.addEventListener("pinnedCardUpdated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("pinnedCardUpdated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const updateConfig = (newConfig: Partial<PinnedCardConfig>) => {
    const fullConfig = { ...config, ...newConfig };
    setConfig(fullConfig);
    savePinnedCard(fullConfig);
  };

  const castVote = (userId: string, optionId: string) => {
    const newVotes = { ...config.votes, [userId]: optionId };
    updateConfig({ votes: newVotes });
  };

  const toggleParticipation = (userId: string) => {
    const hasJoined = config.participants.includes(userId);
    const newParticipants = hasJoined
      ? config.participants.filter((id) => id !== userId)
      : [...config.participants, userId];
    updateConfig({ participants: newParticipants });
  };

  const toggleEnabled = () => {
    updateConfig({ enabled: !config.enabled });
  };

  return {
    config,
    updateConfig,
    castVote,
    toggleParticipation,
    toggleEnabled,
  };
}
