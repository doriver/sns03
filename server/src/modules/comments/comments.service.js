const Comment = require('../../models/Comment');
const Post = require('../../models/Post');
const AppError = require('../../utils/AppError');

async function list(postId, { page = 1, size = 20 }) {
  const post = await Post.findOne({ _id: postId, deletedAt: null }).lean();
  if (!post) throw new AppError('POST_NOT_FOUND', 404, 'Post not found');

  const skip = (page - 1) * size;
  const [items, total] = await Promise.all([
    Comment.find({ postId, deletedAt: null })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(size)
      .populate('authorId', 'nickname profileImage role')
      .lean(),
    Comment.countDocuments({ postId, deletedAt: null }),
  ]);

  return {
    items: items.map(formatComment),
    total,
    page,
    size,
    totalPages: Math.ceil(total / size),
  };
}

async function create(postId, authorId, content) {
  const post = await Post.findOne({ _id: postId, deletedAt: null });
  if (!post) throw new AppError('POST_NOT_FOUND', 404, 'Post not found');

  const comment = await Comment.create({ postId, authorId, content });
  await Post.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });
  return comment;
}

async function update(commentId, userId, role, content) {
  const comment = await Comment.findOne({ _id: commentId, deletedAt: null });
  if (!comment) throw new AppError('COMMENT_NOT_FOUND', 404, 'Comment not found');
  if (role !== 'admin' && String(comment.authorId) !== String(userId)) {
    throw new AppError('COMMENT_FORBIDDEN', 403, 'Not authorized');
  }
  comment.content = content;
  await comment.save();
  return comment;
}

async function softDelete(commentId, userId, role) {
  const comment = await Comment.findOne({ _id: commentId, deletedAt: null });
  if (!comment) throw new AppError('COMMENT_NOT_FOUND', 404, 'Comment not found');
  if (role !== 'admin' && String(comment.authorId) !== String(userId)) {
    throw new AppError('COMMENT_FORBIDDEN', 403, 'Not authorized');
  }
  comment.deletedAt = new Date();
  await comment.save();
  await Post.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });
}

function formatComment(c) {
  const author = c.authorId;
  return {
    id: c._id,
    content: c.content,
    postId: c.postId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    author: author
      ? { id: author._id, nickname: author.nickname, profileImage: author.profileImage, role: author.role }
      : { nickname: '탈퇴한 사용자' },
  };
}

module.exports = { list, create, update, softDelete };
