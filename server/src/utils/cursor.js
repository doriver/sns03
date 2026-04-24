const { Types } = require('mongoose');

function encodeCursor(doc) {
  return Buffer.from(JSON.stringify({ id: doc._id, createdAt: doc.createdAt })).toString('base64url');
}

function decodeCursor(cursor) {
  try {
    const { id, createdAt } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return { _id: new Types.ObjectId(id), createdAt: new Date(createdAt) };
  } catch {
    return null;
  }
}

module.exports = { encodeCursor, decodeCursor };
