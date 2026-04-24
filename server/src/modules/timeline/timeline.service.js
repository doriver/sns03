const Post = require('../../models/Post');
const { getRedis } = require('../../config/redis');

const CACHE_KEY = 'timeline:main';
const CACHE_TTL = 60;

async function getTimeline() {
  const redis = getRedis();
  const cached = await redis.get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const items = await Post.aggregate([
    { $match: { deletedAt: null, hidden: false, createdAt: { $gte: since } } },
    { $addFields: { score: { $add: [{ $multiply: ['$viewCount', 0.7] }, { $multiply: ['$likeCount', 0.3] }] } } },
    { $sort: { score: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: 'authorId',
        foreignField: '_id',
        pipeline: [{ $project: { nickname: 1, profileImage: 1, role: 1 } }],
        as: 'authorArr',
      },
    },
    {
      $lookup: {
        from: 'comments',
        let: { postId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$postId', '$$postId'] }, { $eq: ['$deletedAt', null] }] } } },
          { $sort: { createdAt: -1 } },
          { $limit: 3 },
          {
            $lookup: {
              from: 'users',
              localField: 'authorId',
              foreignField: '_id',
              pipeline: [{ $project: { nickname: 1, profileImage: 1, role: 1 } }],
              as: 'authorArr',
            },
          },
          {
            $project: {
              _id: 0,
              id: '$_id',
              content: 1,
              createdAt: 1,
              author: { $arrayElemAt: ['$authorArr', 0] },
            },
          },
        ],
        as: 'recentComments',
      },
    },
    {
      $project: {
        _id: 0,
        id: '$_id',
        title: 1,
        content: { $substrCP: ['$content', 0, 200] },
        images: 1,
        viewCount: 1,
        likeCount: 1,
        commentCount: 1,
        score: 1,
        createdAt: 1,
        author: { $arrayElemAt: ['$authorArr', 0] },
        recentComments: 1,
      },
    },
  ]);

  await redis.set(CACHE_KEY, JSON.stringify(items), 'EX', CACHE_TTL);
  return items;
}

module.exports = { getTimeline };
