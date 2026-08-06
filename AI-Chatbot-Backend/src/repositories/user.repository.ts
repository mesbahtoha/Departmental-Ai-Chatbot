import { FilterQuery, Types } from 'mongoose';
import { UserModel, UserDocument } from '../database/models/User.model';

/**
 * User repository - typed data access for the user aggregate.
 */
export const userRepository = {
  async findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return UserModel.findById(id);
  },

  async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase().trim() });
  },

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  },

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role?: 'user' | 'admin';
  }): Promise<UserDocument> {
    return UserModel.create(data);
  },

  async update(
    id: string | Types.ObjectId,
    data: Partial<
      Pick<UserDocument, 'name' | 'avatarUrl' | 'isActive' | 'role' | 'lastLoginAt' | 'email'>
    >
  ): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  },

  async findPaginated(
    filter: FilterQuery<UserDocument> = {},
    page: number,
    limit: number,
    sort: Record<string, 1 | -1> = { createdAt: -1 }
  ): Promise<{ items: UserDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      UserModel.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
      UserModel.countDocuments(filter),
    ]);
    return { items, total };
  },

  async count(filter: FilterQuery<UserDocument> = {}): Promise<number> {
    return UserModel.countDocuments(filter);
  },

  async delete(id: string | Types.ObjectId): Promise<void> {
    await UserModel.deleteOne({ _id: id });
  },

  async setResetToken(
    id: string | Types.ObjectId,
    tokenHash: string,
    expiresAt: Date
  ): Promise<void> {
    await UserModel.updateOne(
      { _id: id },
      { $set: { resetPasswordToken: tokenHash, resetPasswordExpires: expiresAt } }
    );
  },

  async findByResetToken(tokenHash: string): Promise<UserDocument | null> {
    return UserModel.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+passwordHash');
  },

  async clearResetToken(id: string | Types.ObjectId): Promise<void> {
    await UserModel.updateOne(
      { _id: id },
      { $set: { resetPasswordToken: null, resetPasswordExpires: null } }
    );
  },
};
