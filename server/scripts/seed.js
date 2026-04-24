require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sns03';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const User = require('../src/models/User');
  const Post = require('../src/models/Post');
  const Comment = require('../src/models/Comment');

  await User.deleteMany({});
  await Post.deleteMany({});
  await Comment.deleteMany({});
  console.log('Cleared existing data');

  const hash = (pw) => bcrypt.hash(pw, 10);

  const admin = await User.create({
    email: 'admin@sns03.dev',
    passwordHash: await hash('Admin1234'),
    nickname: 'admin',
    role: 'admin',
  });

  const users = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      User.create({
        email: `user${i + 1}@sns03.dev`,
        passwordHash: bcrypt.hashSync(`User${i + 1}1234`, 10),
        nickname: `유저${i + 1}`,
        role: 'user',
      })
    )
  );

  const allUsers = [admin, ...users];
  console.log(`Created ${allUsers.length} users`);

  const posts = [];
  for (let i = 0; i < 20; i++) {
    const author = allUsers[i % allUsers.length];
    const post = await Post.create({
      authorId: author._id,
      title: `테스트 게시글 ${i + 1}`,
      content: `이것은 ${i + 1}번째 테스트 게시글입니다. 내용을 채워 넣었습니다.\n\nLorem ipsum dolor sit amet.`,
      viewCount: Math.floor(Math.random() * 200),
      likeCount: Math.floor(Math.random() * 50),
    });
    posts.push(post);
  }
  console.log(`Created ${posts.length} posts`);

  for (let i = 0; i < 50; i++) {
    const author = allUsers[i % allUsers.length];
    const post = posts[i % posts.length];
    await Comment.create({
      postId: post._id,
      authorId: author._id,
      content: `댓글 ${i + 1}번입니다.`,
    });
    await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
  }
  console.log('Created 50 comments');

  console.log('\n--- 시드 계정 ---');
  console.log('관리자: admin@sns03.dev / Admin1234');
  users.forEach((u, i) => console.log(`유저${i + 1}: user${i + 1}@sns03.dev / User${i + 1}1234`));

  await mongoose.disconnect();
  console.log('\n시드 완료!');
}

seed().catch((e) => { console.error(e); process.exit(1); });
