'use strict'

module.exports = function AuthenticationMiddleware() {
  return function handle(req, res, next) {
    // read keyId from body
    var longKeyId = req.body.keyId
    if (typeof longKeyId === typeof void 0) {
      var e = new Error('Please provide a keyId.')
      e.status = 400
      next(e)
    } else {
      // let the store validate
      var store = require('./store')
      try {
        store.validateKey(longKeyId, function validated(isAuthenticated) {
          if (!isAuthenticated) {
            var e = new Error('Invalid keyId.')
            e.status = 401
            next(e)
          } else {
            // continue
            next()
          }
        })
      } catch (e) {
        // error raised in the store
        if (!e.status) e.status = 500
        next(e)
      }
    }
  }
}
