export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  groundingMetadata?: {
    groundingChunks?: Array<{
      web?: {
        uri: string;
        title: string;
      };
    }>;
    searchEntryPoint?: {
      renderedContent?: string;
    };
  };
  isFavorite?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  model: string;
  systemInstruction?: string;
  useSearch: boolean;
  isPinned?: boolean;
}

export interface PromptTemplate {
  id: string;
  titleAr: string;
  titleEn: string;
  promptAr: string;
  promptEn: string;
  category: "general" | "coding" | "creative" | "education";
}
