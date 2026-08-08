import { settingRepository } from '../repositories/setting.repository';
import { DEFAULT_SETTINGS } from '../constants';
import { createTtlCache } from '../utils/cache';

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

// Settings change rarely; cache them briefly so AI requests don't pay a
// MongoDB round-trip on every call (getAISettings is hit 2-4x per chat).
// The cache is invalidated whenever the admin updates settings.
const cache = createTtlCache<Record<string, unknown>>(30_000);

/**
 * Settings service - reads typed application settings from the DB
 * with env/constant fallbacks so the app never crashes on missing keys.
 */
export const settingsService = {
  async loadValues(keys: string[]): Promise<Record<string, unknown>> {
    const cacheKey = keys.join(',');
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const values = await settingRepository.getMany(keys);
    cache.set(cacheKey, values);
    return values;
  },

  async getAppSettings(): Promise<AppSettings> {
    const values = await this.loadValues([
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
    const values = await this.loadValues([
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
    cache.clear();
  },

  /** Clears the cached settings (used by seeders/imports). */
  clearCache(): void {
    cache.clear();
  },
};

export default settingsService;
