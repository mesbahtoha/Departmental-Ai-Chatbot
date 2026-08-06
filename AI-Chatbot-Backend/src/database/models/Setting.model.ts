import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * Key-value application settings (editable from the admin panel).
 */
const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    group: { type: String, default: 'general' },
    description: { type: String, default: '' },
  },
  { timestamps: true, collection: 'settings' }
);

export type SettingDocument = InferSchemaType<typeof settingSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const SettingModel = mongoose.model('Setting', settingSchema);
