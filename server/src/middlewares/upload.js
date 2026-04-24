const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { upload: uploadConfig } = require('../config/env');
const AppError = require('../utils/AppError');

function postStorage() {
  return multer.diskStorage({
    destination(req, file, cb) {
      const now = new Date();
      const dir = path.join(
        uploadConfig.dir,
        'posts',
        String(now.getFullYear()),
        String(now.getMonth() + 1).padStart(2, '0')
      );
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });
}

function profileStorage() {
  return multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(uploadConfig.dir, 'profiles');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${req.user._id}${ext}`);
    },
  });
}

const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

function mimeFilter(req, file, cb) {
  if (allowedMimes.includes(file.mimetype)) return cb(null, true);
  cb(new AppError('FILE_TYPE_INVALID', 415, 'Only jpg, png, webp allowed'));
}

const uploadPost = multer({
  storage: postStorage(),
  limits: { fileSize: uploadConfig.maxSize, files: uploadConfig.maxFiles },
  fileFilter: mimeFilter,
});

const uploadProfile = multer({
  storage: profileStorage(),
  limits: { fileSize: uploadConfig.maxSize, files: 1 },
  fileFilter: mimeFilter,
});

module.exports = { uploadPost, uploadProfile };
