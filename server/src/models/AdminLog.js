const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  targetType: { type: String, enum: ['user', 'post', 'comment'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reason: { type: String, default: null },
  at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AdminLog', adminLogSchema);
