import { Types } from 'mongoose';
import { AdminModel, AdminDocument } from '../database/models/Admin.model';

/**
 * Admin repository - typed data access for admin accounts.
 */
export const adminRepository = {
  async findById(id: string | Types.ObjectId): Promise<AdminDocument | null> {
    return AdminModel.findById(id);
  },

  async findByEmail(email: string): Promise<AdminDocument | null> {
    return AdminModel.findOne({ email: email.toLowerCase().trim() });
  },

  async findByEmailWithPassword(email: string): Promise<AdminDocument | null> {
    return AdminModel.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  },

  async count(): Promise<number> {
    return AdminModel.countDocuments();
  },

  async updateLastLogin(id: string | Types.ObjectId): Promise<void> {
    await AdminModel.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } });
  },
};
