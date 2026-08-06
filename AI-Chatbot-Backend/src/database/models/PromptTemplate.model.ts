import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * Configurable prompt templates (admin-managed system prompts).
 */
const promptTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    key: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    content: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'prompttemplates' }
);

export type PromptTemplateDocument = InferSchemaType<typeof promptTemplateSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const PromptTemplateModel = mongoose.model('PromptTemplate', promptTemplateSchema);
