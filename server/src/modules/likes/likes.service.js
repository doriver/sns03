const Like = require('../../models/Like');
const Post = require('../../models/Post');
const AppError = require('../../utils/AppError');

async function toggle(postId, userId) {
  const post = await Post.findOne({ _id: postId, deletedAt: null });
  if (!post) throw new AppError('POST_NOT_FOUND', 404, 'Post not found');

  const existing = await Like.findOneAndDelete({ postId, userId });
  if (existing) {
    await Post.updateOne({ _id: postId }, { $inc: { likeCount: -1 } });
    return { liked: false };
  }

  try {
    await Like.create({ postId, userId });
    await Post.updateOne({ _id: postId }, { $inc: { likeCount: 1 } });
    return { liked: true };
  } catch (err) {
    if (err.code === 11000) return { liked: true };
    throw err;
  }
}

async function hasLiked(postId, userId) {
  const like = await Like.findOne({ postId, userId }).lean();
  return !!like;
}

module.exports = { toggle, hasLiked };
