import { settingRepository } from '../repositories/setting.repository';
import { DEFAULT_SETTINGS } from '../constants';

export interface AISettings {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  dailyQuotaPerUser: number;
  monthlyQuotaPerUser: number;
  openRouterApiKey: string;
}

export interface AppSettings {
  title: string;
  tagline: string;
  allowRegistration: boolean;
  showTokenUsage: boolean;
  showSuggestedPrompts: boolean;
}

/**
 * Settings service - reads typed application settings from the DB
 * with env/constant fallbacks so the app never crashes on missing keys.
 */
export const settingsService = {
  async getAppSettings(): Promise<AppSettings> {
    const values = await settingRepository.getMany([
      'app.title',
      'app.tagline',
      'app.allowRegistration',
      'ui.showTokenUsage',
      'ui.showSuggestedPrompts',
    ]);

    return {
      title: String(values['app.title'] ?? DEFAULT_SETTINGS['app.title']),
      tagline: String(values['app.tagline'] ?? DEFAULT_SETTINGS['app.tagline']),
      allowRegistration: Boolean(values['app.allowRegistration'] ?? true),
      showTokenUsage: Boolean(values['ui.showTokenUsage'] ?? true),
      showSuggestedPrompts: Boolean(values['ui.showSuggestedPrompts'] ?? true),
    };
  },

  async getAISettings(): Promise<AISettings> {
    const values = await settingRepository.getMany([
      'ai.model',
      'ai.temperature',
      'ai.maxTokens',
      'ai.systemPrompt',
      'ai.dailyQuotaPerUser',
      'ai.monthlyQuotaPerUser',
      'ai.openRouterApiKey',
    ]);

    return {
      model: String(values['ai.model'] || DEFAULT_SETTINGS['ai.model']),
      temperature: Number(values['ai.temperature'] ?? 0.15),
      maxTokens: Number(values['ai.maxTokens'] ?? 700),
      systemPrompt: String(values['ai.systemPrompt'] ?? ''),
      dailyQuotaPerUser: Number(values['ai.dailyQuotaPerUser'] ?? 40000),
      monthlyQuotaPerUser: Number(values['ai.monthlyQuotaPerUser'] ?? 0),
      openRouterApiKey: String(values['ai.openRouterApiKey'] ?? ''),
    };
  },

  async getAllForAdmin(): Promise<Array<{ key: string; value: unknown; group: string; description: string }>> {
    const docs = await settingRepository.getAll();
    return docs.map((doc) => ({
      key: doc.key,
      value: doc.value,
      group: doc.group,
      description: doc.description,
    }));
  },

  async updateMany(entries: Array<{ key: string; value: unknown }>): Promise<void> {
    await settingRepository.setMany(entries);
  },
};

export default settingsService;
