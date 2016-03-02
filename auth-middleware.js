'use strict'

/**
 * NPM modules.
 */
var openpgp = require('openpgp')


module.exports = function AuthenticationMiddleware() {
  return function handle(req, res, next) {
    // read publicKey from body
    var publicKey = req.body.publicKey
    if (typeof publicKey === typeof void 0) {
      var e = new Error('Please provide a publicKey.')
      e.status = 400
      next(e)
    } else {
      var publicKey = openpgp.key.readArmored(publicKey).keys[0]
      if (typeof publicKey === typeof void 0) {
        var e = new Error('Invalid publicKey.')
        e.status = 401
        next(e)
      } else {
        // let the store validate
        var store = require('./store')
        try {
          var longKeyId = publicKey.primaryKey.getKeyId().toHex().toUpperCase()

          store.validateKey(longKeyId, function validated(isAuthenticated) {
            if (!isAuthenticated) {
              var e = new Error('Invalid publicKey.')
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
}
