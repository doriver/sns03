const User = require('../../models/User');
const Post = require('../../models/Post');
const Comment = require('../../models/Comment');
const AdminLog = require('../../models/AdminLog');
const AppError = require('../../utils/AppError');
const { revokeAllRefreshTokens } = require('../auth/token.service');
const { getRedis } = require('../../config/redis');

async function log(adminId, action, targetType, targetId, reason = null) {
  await AdminLog.create({ adminId, action, targetType, targetId, reason });
}

async function listUsers({ search, role, page = 1, size = 20, sort = '-createdAt' }) {
  const q = {};
  if (search) q.$or = [{ nickname: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
  if (role) q.role = role;

  const skip = (page - 1) * size;
  const [items, total] = await Promise.all([
    User.find(q).sort(sort).skip(skip).limit(size).lean(),
    User.countDocuments(q),
  ]);
  return { items, total, page, size, totalPages: Math.ceil(total / size) };
}

async function changeRole(adminId, userId, newRole, reason) {
  if (String(adminId) === String(userId)) {
    throw new AppError('ADMIN_SELF_DEMOTE', 400, 'Cannot change own role');
  }
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw new AppError('USER_NOT_FOUND', 404, 'User not found');

  if (newRole === 'popular') {
    if (user.followerCount < 10) {
      throw new AppError('ADMIN_POPULAR_CONDITION', 400, 'User must have at least 10 followers');
    }
  }

  user.role = newRole;
  await user.save();
  await log(adminId, `role_changed:${newRole}`, 'user', userId, reason);
  return user;
}

async function banUser(adminId, userId, reason, forceDelete = false) {
  if (String(adminId) === String(userId)) {
    throw new AppError('ADMIN_SELF_BAN', 400, 'Cannot ban yourself');
  }
  const user = await User.findById(userId);
  if (!user || user.deletedAt) throw new AppError('USER_NOT_FOUND', 404, 'User not found');

  user.bannedAt = new Date();
  user.banReason = reason;
  if (forceDelete) {
    user.deletedAt = new Date();
    user.nickname = `deleted_${user._id}`;
  }
  await user.save();
  await revokeAllRefreshTokens(String(userId));
  await log(adminId, forceDelete ? 'force_delete' : 'ban', 'user', userId, reason);
  return user;
}

async function togglePostHidden(adminId, postId) {
  const post = await Post.findOne({ _id: postId, deletedAt: null });
  if (!post) throw new AppError('POST_NOT_FOUND', 404, 'Post not found');
  post.hidden = !post.hidden;
  await post.save();
  await log(adminId, post.hidden ? 'post_hidden' : 'post_unhidden', 'post', postId);
  return post;
}

async function deletePost(adminId, postId) {
  const post = await Post.findOne({ _id: postId, deletedAt: null });
  if (!post) throw new AppError('POST_NOT_FOUND', 404, 'Post not found');
  post.deletedAt = new Date();
  await post.save();
  await log(adminId, 'post_deleted', 'post', postId);
}

async function deleteComment(adminId, commentId) {
  const comment = await Comment.findOne({ _id: commentId, deletedAt: null });
  if (!comment) throw new AppError('COMMENT_NOT_FOUND', 404, 'Comment not found');
  comment.deletedAt = new Date();
  await comment.save();
  await Post.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });
  await log(adminId, 'comment_deleted', 'comment', commentId);
}

async function getStats() {
  const redis = getRedis();
  const today = new Date().toISOString().slice(0, 10);

  const [userCount, postCount, commentCount, dau] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    Post.countDocuments({ deletedAt: null }),
    Comment.countDocuments({ deletedAt: null }),
    redis.scard(`dau:${today}`),
  ]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [userTrend, postTrend] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Post.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo }, deletedAt: null } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return { userCount, postCount, commentCount, dau, userTrend, postTrend };
}

module.exports = { listUsers, changeRole, banUser, togglePostHidden, deletePost, deleteComment, getStats };
