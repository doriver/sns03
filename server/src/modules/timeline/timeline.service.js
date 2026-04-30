const Post = require('../../models/Post');
const { getRedis } = require('../../config/redis');

const CACHE_KEY = 'timeline:main';
const CACHE_TTL = 150;

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
    { // 작성자 정보 조인
      $lookup: {
        from: 'users', // posts.authorId → users._id 로 조인
        localField: 'authorId',
        foreignField: '_id',
        pipeline: [{ $project: { nickname: 1, profileImage: 1, role: 1 } }], // 필요한 필드(nickname, profileImage, role)만 가져옴
        as: 'authorArr', // 결과를 배열 authorArr로 저장
      },
    },
    { // 최근 댓글 조인
      $lookup: {
        from: 'comments',
        let: { postId: '$_id' }, // let + $expr을 사용한 서브파이프라인 방식 조인 (조건부 조인 가능) , 단순 $lookup과 달리 댓글 필터링/정렬/제한을 서브파이프라인 안에서 처리
        pipeline: [ 
          { $match: { $expr: { $and: [{ $eq: ['$postId', '$$postId'] }, { $eq: ['$deletedAt', null] }] } } },
          { $sort: { createdAt: -1 } },
          { $limit: 3 },
          {
            $lookup: { // 댓글 작성자도 조인
              from: 'users',
              localField: 'authorId',
              foreignField: '_id',
              pipeline: [{ $project: { nickname: 1, profileImage: 1, role: 1 } }],
              as: 'authorArr',
            },
          },
          {
            $project: { // 최종 출력 필드 정의
              _id: 0,
              id: '$_id', // _id → id 로 리네임
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
      $project: { // 최종 출력 필드 정의
        _id: 0,
        id: '$_id',
        title: 1,
        content: { $substrCP: ['$content', 0, 200] }, // 본문 200자 미리보기
        images: 1,
        viewCount: 1,
        likeCount: 1,
        commentCount: 1,
        score: 1,
        createdAt: 1,
        author: { $arrayElemAt: ['$authorArr', 0] }, // 조인 결과 배열의 첫 번째 원소만 꺼냄
        recentComments: 1,
      },
    },
  ]);

  await redis.set(CACHE_KEY, JSON.stringify(items), 'EX', CACHE_TTL); // 집계 결과를 JSON 문자열로 직렬화해서 Redis에 저장
  return items;
}

module.exports = { getTimeline };
