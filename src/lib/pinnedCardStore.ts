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
  enabled: false,
  type: "contest",
  theme: "royal",
  badgeText: "🏆 مسابقة الأسبوع المميزة",
  title: "تحدي البرمجة والحلول الأكاديمية - الدورة الثالثة",
  description:
    "شارك أفضل ملخص دراسي أو مشروع تطبيقي ونافس على جائزة أفضل مساهم أكاديمي! يتم تقييم المساهمات بناءً على تصويت زملائك بالكلية.",
  imageUrl: "",
  endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
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

function mapRowToConfig(row: Record<string, unknown>): PinnedCardConfig {
  return {
    id: row.id,
    enabled: row.enabled ?? true,
    type: row.type as PinnedCardType,
    theme: row.theme as PinnedCardTheme,
    badgeText: row.badge_text || "",
    title: row.title || "",
    description: row.description || "",
    imageUrl: row.image_url || "",
    endDate: row.end_date,
    actionButtonText: row.action_button_text || "",
    actionButtonUrl: row.action_button_url || "",
    targetYear: row.target_year,
    targetMajor: row.target_major,
    pollOptions: (row.poll_options as PollOption[]) || [],
    votes: (row.votes as Record<string, string>) || {},
    participants: (row.participants as string[]) || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPinnedCard(): Promise<PinnedCardConfig> {
  try {
    let result = DEFAULT_PINNED_CARD;
    const { data, error } = await supabase
      .from("pinned_cards")
      .select("*")
      .eq("id", "pinned_featured_event_1")
      .single();

    if (!error && data) {
      result = mapRowToConfig(data);
    }

    // Always merge with local storage backup to ensure votes/participants are never lost
    const localStr = localStorage.getItem("unihub_pinned_featured_card_v1");
    let localConfig: Partial<PinnedCardConfig> = {};
    if (localStr) {
      try {
        localConfig = JSON.parse(localStr);
      } catch (e) {
        /* ignore */
      }
    }

    const localVotesStr = localStorage.getItem("unihub_poll_votes_v1");
    let localVotes: Record<string, string> = {};
    if (localVotesStr) {
      try {
        localVotes = JSON.parse(localVotesStr);
      } catch (e) {
        /* ignore */
      }
    }

    const mergedVotes = {
      ...(result.votes || {}),
      ...(localConfig.votes || {}),
      ...localVotes,
    };

    const mergedParticipants = Array.from(
      new Set([
        ...(result.participants || []),
        ...(localConfig.participants || []),
      ]),
    );

    return {
      ...result,
      ...(localConfig.enabled !== undefined ? { enabled: localConfig.enabled } : {}),
      votes: mergedVotes,
      participants: mergedParticipants,
    };
  } catch (err) {
    console.warn("Failed to fetch pinned card:", err);
    const local = localStorage.getItem("unihub_pinned_featured_card_v1");
    if (local) {
      try {
        return { ...DEFAULT_PINNED_CARD, ...JSON.parse(local) };
      } catch (e) {
        /* ignore */
      }
    }
    return DEFAULT_PINNED_CARD;
  }
}

export async function savePinnedCardToDb(config: PinnedCardConfig) {
  // 1. Immediately store locally to guarantee client persistence
  try {
    localStorage.setItem("unihub_pinned_featured_card_v1", JSON.stringify(config));
    if (config.votes) {
      localStorage.setItem("unihub_poll_votes_v1", JSON.stringify(config.votes));
    }
    window.dispatchEvent(new CustomEvent("pinnedCardUpdated", { detail: config }));
  } catch (e) {
    console.warn("Local storage save failed:", e);
  }

  // 2. Try DB update/upsert
  const row = {
    id: config.id,
    enabled: config.enabled,
    type: config.type,
    theme: config.theme,
    badge_text: config.badgeText,
    title: config.title,
    description: config.description,
    image_url: config.imageUrl,
    end_date: config.endDate,
    action_button_text: config.actionButtonText,
    action_button_url: config.actionButtonUrl,
    target_year: config.targetYear,
    target_major: config.targetMajor,
    poll_options: config.pollOptions,
    votes: config.votes,
    participants: config.participants,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("pinned_cards").upsert(row);
  if (error) {
    // Try update as fallback
    await supabase.from("pinned_cards").update(row).eq("id", config.id);
  }
}

export function usePinnedCard() {
  const [config, setConfig] = useState<PinnedCardConfig>(DEFAULT_PINNED_CARD);

  useEffect(() => {
    let mounted = true;
    fetchPinnedCard()
      .then((c) => {
        if (mounted) setConfig(c);
      })
      .catch((err) => {
        console.warn("Unhandled error in usePinnedCard effect:", err);
      });

    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<PinnedCardConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      } else {
        const local = localStorage.getItem("unihub_pinned_featured_card_v1");
        if (local) {
          try {
            setConfig({ ...DEFAULT_PINNED_CARD, ...JSON.parse(local) });
          } catch (e) {
            /* ignore error */
          }
        }
      }
    };

    window.addEventListener("pinnedCardUpdated", handleStorageUpdate);
    window.addEventListener("storage", handleStorageUpdate);

    const channel = supabase
      .channel(`pinned_cards_changes_${Math.random().toString(36).substring(7)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pinned_cards" },
        (payload) => {
          if (
            payload.new &&
            (payload.new as Record<string, unknown>).id === "pinned_featured_event_1"
          ) {
            setConfig(mapRowToConfig(payload.new));
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      window.removeEventListener("pinnedCardUpdated", handleStorageUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);

  const updateConfig = async (newConfig: Partial<PinnedCardConfig>) => {
    try {
      const fullConfig = { ...config, ...newConfig };
      setConfig(fullConfig); // optimistic
      await savePinnedCardToDb(fullConfig);
    } catch (err) {
      console.warn("Failed to save pinned card config to DB:", err);
    }
  };

  const castVote = async (userId: string, optionId: string) => {
    const newVotes = { ...config.votes, [userId]: optionId };
    await updateConfig({ votes: newVotes });
  };

  const toggleParticipation = async (userId: string) => {
    const hasJoined = config.participants.includes(userId);
    const newParticipants = hasJoined
      ? config.participants.filter((id) => id !== userId)
      : [...config.participants, userId];
    await updateConfig({ participants: newParticipants });
  };

  const toggleEnabled = async () => {
    await updateConfig({ enabled: !config.enabled });
  };

  return {
    config,
    updateConfig,
    castVote,
    toggleParticipation,
    toggleEnabled,
  };
}
