import { SettingModel, SettingDocument } from '../database/models/Setting.model';
import { DEFAULT_SETTINGS } from '../constants';

/**
 * Settings repository - key/value application configuration.
 */
export const settingRepository = {
  async getAll(): Promise<SettingDocument[]> {
    return SettingModel.find().sort({ key: 1 });
  },

  async get(key: string): Promise<SettingDocument | null> {
    return SettingModel.findOne({ key });
  },

  async getValue(key: string): Promise<unknown> {
    const doc = await SettingModel.findOne({ key }).lean();
    if (doc) return doc.value;
    return (DEFAULT_SETTINGS as Record<string, unknown>)[key] ?? null;
  },

  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    const docs = await SettingModel.find({ key: { $in: keys } }).lean();
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      const doc = docs.find((d) => d.key === key);
      out[key] = doc ? doc.value : (DEFAULT_SETTINGS as Record<string, unknown>)[key] ?? null;
    }
    return out;
  },

  async set(key: string, value: unknown, group = 'general', description = ''): Promise<void> {
    await SettingModel.updateOne(
      { key },
      { $set: { value, group, description } },
      { upsert: true }
    );
  },

  async setMany(entries: Array<{ key: string; value: unknown }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value);
    }
  },
};
