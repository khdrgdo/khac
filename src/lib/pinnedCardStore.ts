import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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
  endDate?: string;
  actionButtonText?: string;
  actionButtonUrl?: string;
  targetYear?: number | null;
  targetMajor?: string | null;
  pollOptions: PollOption[];
  votes: Record<string, string>;
  participants: string[];
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
    id: (row.id as string) || "",
    enabled: (row.enabled as boolean) ?? true,
    type: (row.type as PinnedCardType) || "contest",
    theme: (row.theme as PinnedCardTheme) || "royal",
    badgeText: (row.badge_text as string) || "",
    title: (row.title as string) || "",
    description: (row.description as string) || "",
    imageUrl: (row.image_url as string) || "",
    endDate: (row.end_date as string) || undefined,
    actionButtonText: (row.action_button_text as string) || "",
    actionButtonUrl: (row.action_button_url as string) || "",
    targetYear: (row.target_year as number | null) ?? null,
    targetMajor: (row.target_major as string | null) ?? null,
    pollOptions: (row.poll_options as PollOption[]) || [],
    votes: (row.votes as Record<string, string>) || {},
    participants: (row.participants as string[]) || [],
    createdAt: (row.created_at as string) || new Date().toISOString(),
    updatedAt: (row.updated_at as string) || new Date().toISOString(),
  };
}

export async function fetchPinnedCard(): Promise<PinnedCardConfig> {
  try {
    const { data, error } = await supabase
      .from("pinned_cards" as never)
      .select("*")
      .eq("id", "pinned_featured_event_1")
      .single();

    if (!error && data) {
      return mapRowToConfig(data);
    }
  } catch (err) {
  }

  return DEFAULT_PINNED_CARD;
}

export async function savePinnedCardToDb(config: PinnedCardConfig) {
  try {
    localStorage.setItem("unihub_pinned_featured_card_v1", JSON.stringify(config));
    window.dispatchEvent(new CustomEvent("pinnedCardUpdated", { detail: config }));
  } catch (e) {
  }

  const row = {
    id: config.id,
    enabled: config.enabled,
    type: config.type,
    theme: config.theme,
    badge_text: config.badgeText,
    title: config.title,
    description: config.description || null,
    image_url: config.imageUrl || null,
    end_date: config.endDate || null,
    action_button_text: config.actionButtonText || null,
    action_button_url: config.actionButtonUrl || null,
    target_year: config.targetYear || null,
    target_major: config.targetMajor || null,
    poll_options: config.pollOptions as unknown as Json,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("pinned_cards").update(row as never).eq("id", config.id);
  if (error) {
    const { error: upsertError } = await supabase.from("pinned_cards").upsert({
      ...row,
      votes: config.votes as unknown as Json,
      participants: config.participants as unknown as Json,
    } as never);
    if (upsertError) {
    }
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
          }
        }
      }
    };

    window.addEventListener("pinnedCardUpdated", handleStorageUpdate);
    window.addEventListener("storage", handleStorageUpdate);

    const channel = supabase
      .channel(`pinned_cards_changes`)
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

  const updateConfig = async (newConfigPartial: Partial<PinnedCardConfig>) => {
    const { data: latestRow } = await supabase
      .from("pinned_cards")
      .select("*")
      .eq("id", "pinned_featured_event_1")
      .single();

    const latestConfig = latestRow ? mapRowToConfig(latestRow) : config;

    const fullConfig: PinnedCardConfig = {
      ...latestConfig,
      ...newConfigPartial,
      votes: latestConfig.votes,
      participants: latestConfig.participants,
    };

    setConfig(fullConfig);
    await savePinnedCardToDb(fullConfig);
  };

  const castVote = async (userId: string, optionId: string) => {
    const { data: updatedVotes, error } = await (supabase.rpc as any)("vote_on_poll", {
      p_user_id: userId,
      p_option_id: optionId,
    });

    if (error) {
      const newVotes = { ...(config.votes || {}), [userId]: optionId };
      setConfig((prev) => ({ ...prev, votes: newVotes }));
      await supabase
        .from("pinned_cards")
        .update({ votes: newVotes as unknown as Json, updated_at: new Date().toISOString() } as never)
        .eq("id", config.id);
      return;
    }

    setConfig((prev) => ({
      ...prev,
      votes: (updatedVotes as Record<string, string>) || {},
    }));
  };

  const toggleParticipation = async (userId: string) => {
    const { data: latestRow } = await supabase
      .from("pinned_cards")
      .select("*")
      .eq("id", "pinned_featured_event_1")
      .single();

    let currentParticipants: string[] = [];
    if (latestRow?.participants && Array.isArray(latestRow.participants)) {
      currentParticipants = [...(latestRow.participants as string[])];
    } else {
      currentParticipants = [...(config.participants || [])];
    }

    const hasJoined = currentParticipants.includes(userId);
    const newParticipants = hasJoined
      ? currentParticipants.filter((id) => id !== userId)
      : [...currentParticipants, userId];

    const latestConfig = latestRow ? mapRowToConfig(latestRow) : config;
    const updatedConfig: PinnedCardConfig = {
      ...latestConfig,
      participants: newParticipants,
    };

    setConfig(updatedConfig);
    await supabase
      .from("pinned_cards")
      .update({ participants: newParticipants as unknown as Json, updated_at: new Date().toISOString() } as never)
      .eq("id", "pinned_featured_event_1");
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
