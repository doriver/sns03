const User = require('../../models/User');
const AppError = require('../../utils/AppError');
const { publicUrl, remove } = require('../../utils/storage');
const path = require('path');
const { upload: uploadConfig } = require('../../config/env');

async function getMe(userId) {
  const user = await User.findById(userId).lean();
  if (!user || user.deletedAt) throw new AppError('USER_NOT_FOUND', 404, 'User not found');
  return user;
}

async function getPublicProfile(userId) {
  const user = await User.findOne({ _id: userId, deletedAt: null }).lean();
  if (!user) throw new AppError('USER_NOT_FOUND', 404, 'User not found');
  return user;
}

async function updateMe(userId, { nickname, file }) {
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw new AppError('USER_NOT_FOUND', 404, 'User not found');

  if (nickname && nickname !== user.nickname) {
    const dup = await User.findOne({ nickname, _id: { $ne: userId } }).lean();
    if (dup) throw new AppError('USER_DUPLICATE', 409, 'Nickname already exists');
    user.nickname = nickname;
  }

  if (file) {
    if (user.profileImage) {
      const rel = user.profileImage.replace(uploadConfig.publicUrl + '/', '');
      remove(path.join(uploadConfig.dir, rel));
    }
    user.profileImage = publicUrl(file.path);
  }

  await user.save();
  return user;
}

async function deleteMe(userId) {
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw new AppError('USER_NOT_FOUND', 404, 'User not found');
  user.deletedAt = new Date();
  user.nickname = `deleted_${user._id}`;
  await user.save();
}

module.exports = { getMe, getPublicProfile, updateMe, deleteMe };
