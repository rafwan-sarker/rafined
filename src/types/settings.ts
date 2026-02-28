export interface UserSettings {
  apiKey: string;
  tone: 'professional' | 'casual' | 'technical';
  addOutputFormat: boolean;
  keepConcise: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  apiKey: '',
  tone: 'professional',
  addOutputFormat: true,
  keepConcise: false,
};
