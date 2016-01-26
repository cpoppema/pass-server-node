'use strict'

module.exports = function ErrorMiddleware() {
  return function handle(err, req, res, next) {
    if (err) {
      if (!err.status) err.status = 500
      res.writeHead(err.status, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({
        error: err.message
      }, null, 2))
    } else {
      next()
    }
  }
}
