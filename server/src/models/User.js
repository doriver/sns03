const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { bcryptCost } = require('../config/env');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    nickname: { type: String, required: true, unique: true, trim: true },
    role: { type: String, enum: ['user', 'popular', 'admin'], default: 'user' },
    profileImage: { type: String, default: null },
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    bannedAt: { type: Date, default: null },
    banReason: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, bcryptCost);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    nickname: this.nickname,
    profileImage: this.profileImage,
    role: this.role,
    followerCount: this.followerCount,
    followingCount: this.followingCount,
    createdAt: this.createdAt,
  };
};

userSchema.methods.toPrivateJSON = function () {
  return {
    ...this.toPublicJSON(),
    email: this.email,
  };
};

module.exports = mongoose.model('User', userSchema);
