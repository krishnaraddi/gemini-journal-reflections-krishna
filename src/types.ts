export type ReflectionMode = 'summary' | 'reflection' | 'brainstorm' | 'perspective' | 'chat';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

export interface EntryLocation {
  lat: number;
  lng: number;
  name?: string;
  formattedAddress?: string;
  placeId?: string;
  accuracy?: number;
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
  location?: EntryLocation;
}

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'suspended';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role?: UserRole;
  status?: UserStatus;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AdminAuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: 'ROLE_PROMOTION' | 'ROLE_DEMOTION' | 'USER_SUSPENDED' | 'USER_ACTIVATED' | 'ACCESS_DENIED' | 'SYSTEM_CONFIG_UPDATED';
  targetUid?: string;
  targetEmail?: string;
  details: string;
  timestamp: string;
}

export interface PlatformStats {
  totalUsers: number;
  totalAdmins: number;
  totalEntries: number;
  totalGeotagged: number;
  modeBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
}


export interface ReflectionRequestOptions {
  title: string;
  entryContent: string;
  mode: ReflectionMode;
  conversation?: { role: 'user' | 'model'; content: string }[];
  customPrompt?: string;
  location?: EntryLocation;
}
