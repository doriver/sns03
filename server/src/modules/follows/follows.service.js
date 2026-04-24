const Follow = require('../../models/Follow');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');

async function follow(followerId, followingId) {
  if (String(followerId) === String(followingId)) {
    throw new AppError('FOLLOW_SELF', 400, 'Cannot follow yourself');
  }
  const target = await User.findOne({ _id: followingId, deletedAt: null });
  if (!target) throw new AppError('USER_NOT_FOUND', 404, 'User not found');

  try {
    await Follow.create({ followerId, followingId });
    await Promise.all([
      User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }),
      User.updateOne({ _id: followingId }, { $inc: { followerCount: 1 } }),
    ]);
    return { following: true };
  } catch (err) {
    if (err.code === 11000) return { following: true };
    throw err;
  }
}

async function unfollow(followerId, followingId) {
  const doc = await Follow.findOneAndDelete({ followerId, followingId });
  if (!doc) return { following: false };
  await Promise.all([
    User.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } }),
    User.updateOne({ _id: followingId }, { $inc: { followerCount: -1 } }),
  ]);
  return { following: false };
}

async function listFollowers(userId, { page = 1, size = 20 }) {
  const skip = (page - 1) * size;
  const [items, total] = await Promise.all([
    Follow.find({ followingId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .populate('followerId', 'nickname profileImage role')
      .lean(),
    Follow.countDocuments({ followingId: userId }),
  ]);
  return { items: items.map((f) => f.followerId), total, page, size };
}

async function listFollowing(userId, { page = 1, size = 20 }) {
  const skip = (page - 1) * size;
  const [items, total] = await Promise.all([
    Follow.find({ followerId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(size)
      .populate('followingId', 'nickname profileImage role')
      .lean(),
    Follow.countDocuments({ followerId: userId }),
  ]);
  return { items: items.map((f) => f.followingId), total, page, size };
}

async function isFollowing(followerId, followingId) {
  return !!(await Follow.findOne({ followerId, followingId }).lean());
}

module.exports = { follow, unfollow, listFollowers, listFollowing, isFollowing };
