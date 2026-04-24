const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

likeSchema.index({ postId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
