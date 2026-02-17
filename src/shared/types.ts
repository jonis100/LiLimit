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
  countSwitchAsVisit: boolean;
}

export interface SettingsResponse {
  settings: Settings;
}

export type MessageResponse = StatsResponse | LimitsResponse | DeLimitResponse | SettingsResponse | void;
