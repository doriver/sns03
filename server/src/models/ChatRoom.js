const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 30 },
    description: { type: String, default: '', maxlength: 200 },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    capacity: { type: Number, required: true, min: 2, max: 50 },
    participantCount: { type: Number, default: 1 },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

chatRoomSchema.index({ closedAt: 1, createdAt: -1 });
chatRoomSchema.index({ ownerId: 1, closedAt: 1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
