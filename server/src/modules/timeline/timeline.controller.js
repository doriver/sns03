const { ok } = require('../../utils/response');
const timelineService = require('./timeline.service');

async function getTimeline(req, res) {
  const items = await timelineService.getTimeline();
  return ok(res, { items });
}

module.exports = { getTimeline };
