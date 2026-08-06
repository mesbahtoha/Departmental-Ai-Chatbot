import multer from 'multer';

const NOTICE_ALLOWED = [
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'image/bmp',
];

const AVATAR_ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'image/bmp',
];

const noticeFileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  if (NOTICE_ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, TXT, JPEG, PNG, WEBP, JPG and BMP files are allowed'));
  }
};

const avatarFileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  if (AVATAR_ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WEBP, JPG, BMP) are allowed'));
  }
};

/** Multipart upload for notices (file + fields). */
export const uploadNoticeFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: noticeFileFilter,
});

/** Multipart upload for avatars. */
export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: avatarFileFilter,
});
