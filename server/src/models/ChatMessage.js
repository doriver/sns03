const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, minlength: 1, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

chatMessageSchema.index({ roomId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
