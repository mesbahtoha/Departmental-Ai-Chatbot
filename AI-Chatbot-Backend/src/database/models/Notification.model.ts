import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * In-app notification. Persisted for history and pushed in real time over
 * Server-Sent Events; the client also polls as a serverless-safe fallback.
 */
const notificationSchema = new Schema(
  {
    recipientId: { type: Schema.Types.ObjectId, required: true, index: true },
    recipientRole: { type: String, default: '' },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', default: null, index: true },
    type: {
      type: String,
      enum: [
        'school',
        'user',
        'question',
        'question_set',
        'assessment',
        'submission',
        'material',
        'book',
        'system',
      ],
      default: 'system',
      index: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, default: '', maxlength: 1000 },
    link: { type: String, default: '' },
    meta: { type: Schema.Types.Mixed, default: null },
    readAt: { type: Date, default: null, index: true },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'notifications' }
);

notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const NotificationModel = mongoose.model('Notification', notificationSchema);
