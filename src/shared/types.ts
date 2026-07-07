export interface StatItem {
  hostname: string;
  timeLimit?: number;
  visitLimit?: number;
  visitCount: number;
}

export interface LimitItem {
  hostname: string;
  timeLimit?: number;
  visitLimit?: number;
}

export interface TimeLeftItem {
  hostname: string;
  timeLimit: number;
  remainingMs: number;
  spentMs: number;
  isActive: boolean;
}

export interface TimeLeftResponse {
  timeLeft: TimeLeftItem[];
}

export interface StatsResponse {
  stats: StatItem[];
}

export interface LimitsResponse {
  limits: LimitItem[];
}

export interface DeLimitResponse {
  success: boolean;
}

export interface Settings {
  dailyTimeLimit: boolean;
}

export interface SettingsResponse {
  settings: Settings;
}

export type MessageResponse =
  | StatsResponse
  | LimitsResponse
  | TimeLeftResponse
  | DeLimitResponse
  | SettingsResponse
  | void;
