import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * Refresh token store (hashed) for secure session rotation.
 */
const refreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true, collection: 'refreshtokens' }
);

export type RefreshTokenDocument = InferSchemaType<typeof refreshTokenSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
};

export const RefreshTokenModel = mongoose.model('RefreshToken', refreshTokenSchema);
