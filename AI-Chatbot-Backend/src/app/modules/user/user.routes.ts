import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { validate } from '../../../middleware/validate.middleware';
import userController from './user.controller';
import { updateProfileSchema } from './user.validation';
import { uploadAvatar } from '../../../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/me', userController.me);
router.patch('/me', validate(updateProfileSchema), userController.updateProfile);
router.post('/me/avatar', uploadAvatar.single('avatar'), userController.uploadAvatar);
router.get('/me/usage', userController.usage);

export default router;
