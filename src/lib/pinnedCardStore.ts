// @ts-nocheck
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

function mapRowToConfig(row: any): PinnedCardConfig {
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
  const { data, error } = await supabase
    .from("pinned_cards")
    .select("*")
    .eq("id", "pinned_featured_event_1")
    .single();

  if (error || !data) return DEFAULT_PINNED_CARD;
  return mapRowToConfig(data);
}

export async function savePinnedCardToDb(config: PinnedCardConfig) {
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
  await (supabase as any).from("pinned_cards").upsert(row);
}

export function usePinnedCard() {
  const [config, setConfig] = useState<PinnedCardConfig>(DEFAULT_PINNED_CARD);

  useEffect(() => {
    let mounted = true;
    fetchPinnedCard().then((c) => {
      if (mounted) setConfig(c);
    });

    const channel = (supabase as any)
      .channel("pinned_cards_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pinned_cards" },
        (payload) => {
          if (payload.new && (payload.new as any).id === "pinned_featured_event_1") {
            setConfig(mapRowToConfig(payload.new));
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const updateConfig = async (newConfig: Partial<PinnedCardConfig>) => {
    const fullConfig = { ...config, ...newConfig };
    setConfig(fullConfig); // optimistic
    await savePinnedCardToDb(fullConfig);
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
