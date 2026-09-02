export type ReflectionMode = 'summary' | 'reflection' | 'brainstorm' | 'perspective' | 'chat';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mode: ReflectionMode;
  aiResponse?: string;
  modelUsed?: string;
  tags: string[];
  mood?: string;
  createdAt: string;
  updatedAt: string;
  conversation?: ChatMessage[];
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface ReflectionRequestOptions {
  title: string;
  entryContent: string;
  mode: ReflectionMode;
  conversation?: { role: 'user' | 'model'; content: string }[];
  customPrompt?: string;
}
