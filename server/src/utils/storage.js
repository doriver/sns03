const fs = require('fs');
const path = require('path');
const { upload: uploadConfig } = require('../config/env');

function publicUrl(filePath) {
  const rel = path.relative(path.resolve(uploadConfig.dir), path.resolve(filePath));
  return `${uploadConfig.publicUrl}/${rel.replace(/\\/g, '/')}`;
}

function remove(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore missing file
  }
}

module.exports = { publicUrl, remove };
