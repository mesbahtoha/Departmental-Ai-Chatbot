import { Request, Response } from 'express';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import userService from './user.service';
import quotaService from '../../../services/quota.service';
import { estimateCostUsd } from '../../../utils/text.utils';

export const userController = {
  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getProfile(req.user!.id);
    if (!user) return fail(res, 404, 'User not found');
    ok(res, { user });
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.updateProfile(req.user!.id, req.body);
    if (!user) return fail(res, 404, 'User not found');
    ok(res, { user });
  }),

  uploadAvatar: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) return fail(res, 400, 'No file uploaded');

    const user = await userService.uploadAvatar(req.user!.id, req.file);
    if (!user) return fail(res, 404, 'User not found');
    ok(res, { user });
  }),

  usage: asyncHandler(async (req: Request, res: Response) => {
    const status = await quotaService.getStatus(req.user!.id, req.user!.role);
    const estimatedDailyCostUsd = estimateCostUsd(status.daily.used);
    ok(res, { usage: { ...status, estimatedDailyCostUsd } });
  }),
};

export default userController;
