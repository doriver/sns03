const mongoose = require('mongoose');

const chatParticipationSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, required: true },
    leftAt: { type: Date, default: null },
  },
  { timestamps: false }
);

chatParticipationSchema.index({ roomId: 1, userId: 1, joinedAt: -1 });

module.exports = mongoose.model('ChatParticipation', chatParticipationSchema);
