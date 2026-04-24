function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

function fail(res, code, message, status = 400, details = []) {
  return res.status(status).json({ ok: false, error: { code, message, details } });
}

module.exports = { ok, fail };
