const path = require('path');
const { Types } = require('mongoose');
const Post = require('../../models/Post');
const AppError = require('../../utils/AppError');
const { encodeCursor, decodeCursor } = require('../../utils/cursor');
const { getRedis } = require('../../config/redis');
const { publicUrl, remove } = require('../../utils/storage');
const { upload: uploadConfig } = require('../../config/env');
const logger = require('../../config/logger');

async function create({ authorId, title, content, files }) {
  const images = (files || []).map((f) => publicUrl(f.path));
  const post = await Post.create({ authorId, title, content, images });
  return post;
}

async function listByCursor({ cursor, limit = 20, authorId } = {}) {
  const q = { deletedAt: null, hidden: false };
  if (authorId) {
    try { q.authorId = new Types.ObjectId(authorId); } catch { /* invalid id, no filter */ }
  }

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      q.$or = [
        { createdAt: { $lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, _id: { $lt: decoded._id } },
      ];
    }
  }

  const items = await Post.find(q)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .populate('authorId', 'nickname profileImage role')
    .lean();

  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;

  return { items: items.map(formatPost), nextCursor, hasMore };
}

async function getById(postId, viewerIdOrIp) {
  const post = await Post.findOne({ _id: postId, deletedAt: null })
    .populate('authorId', 'nickname profileImage role')
    .lean();
  if (!post) throw new AppError('POST_NOT_FOUND', 404, 'Post not found');

  incrementView(postId, viewerIdOrIp).catch((e) => logger.warn('viewCount error', { err: e.message }));

  return formatPost(post);
}

async function incrementView(postId, key) {
  const redis = getRedis();
  const rKey = `view:${postId}:${key}`;
  const isNew = await redis.set(rKey, 1, 'EX', 600, 'NX');
  if (isNew) {
    await Post.updateOne({ _id: postId }, { $inc: { viewCount: 1 } });
  }
}

async function update(postId, userId, role, { title, content, files, removeImages }) {
  const post = await Post.findOne({ _id: postId, deletedAt: null });
  if (!post) throw new AppError('POST_NOT_FOUND', 404, 'Post not found');
  if (role !== 'admin' && String(post.authorId) !== String(userId)) {
    throw new AppError('POST_FORBIDDEN', 403, 'Not authorized');
  }

  if (title !== undefined) post.title = title;
  if (content !== undefined) post.content = content;

  if (files && files.length > 0) {
    const newImages = files.map((f) => publicUrl(f.path));
    post.images = [...post.images, ...newImages].slice(0, 3);
  }

  if (removeImages && Array.isArray(removeImages)) {
    removeImages.forEach((url) => {
      const rel = url.replace(uploadConfig.publicUrl + '/', '');
      remove(path.join(uploadConfig.dir, rel));
    });
    post.images = post.images.filter((img) => !removeImages.includes(img));
  }

  await post.save();
  return post;
}

async function softDelete(postId, userId, role) {
  const post = await Post.findOne({ _id: postId, deletedAt: null });
  if (!post) throw new AppError('POST_NOT_FOUND', 404, 'Post not found');
  if (role !== 'admin' && String(post.authorId) !== String(userId)) {
    throw new AppError('POST_FORBIDDEN', 403, 'Not authorized');
  }
  post.deletedAt = new Date();
  await post.save();
}

function formatPost(post) {
  const author = post.authorId;
  return {
    id: post._id,
    title: post.title,
    content: post.content,
    images: post.images,
    viewCount: post.viewCount,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    hidden: post.hidden,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: author
      ? { id: author._id, nickname: author.nickname, profileImage: author.profileImage, role: author.role }
      : { nickname: '탈퇴한 사용자' },
  };
}

async function listByPage({ page = 1, limit = 20, authorId } = {}) {
  const q = { deletedAt: null, hidden: false };
  if (authorId) {
    try { q.authorId = new Types.ObjectId(authorId); } catch { /* invalid id */ }
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Post.find(q)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate('authorId', 'nickname profileImage role')
      .lean(),
    Post.countDocuments(q),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;
  const safePage = Math.min(page, totalPages);

  return { items: items.map(formatPost), total, page: safePage, totalPages };
}

module.exports = { create, listByCursor, listByPage, getById, update, softDelete };
