'use strict'

/**
 * NPM modules.
 */
var openpgp = require('openpgp')

/**
 * Local modules.
 */
var logger = require('./logger')


module.exports = function AuthenticationMiddleware() {
  return function handle(req, res, next) {
    // read publicKey from body
    var publicKey = req.body.publicKey
    if (typeof publicKey === typeof void 0) {
      logger.debug('Request body does not have a publicKey')

      var e = new Error('Please provide a public key.')
      e.status = 400
      next(e)
    } else {
      var publicKey = openpgp.key.readArmored(publicKey).keys[0]
      if (typeof publicKey === typeof void 0) {
        logger.debug('Request body contains a public key that could not be ' +
                     'parsed correctly.')

        var e = new Error('Invalid publicKey.')
        e.status = 401
        next(e)
      } else {
        // let the store validate
        var store = require('./store')
        try {
          var longKeyId = publicKey.primaryKey.getKeyId().toHex().toUpperCase()

          logger.info('Request body contains a public key with id "' +
                      longKeyId + '".')

          store.validateKey(longKeyId, function validated(isAuthenticated) {
            if (!isAuthenticated) {
              logger.warn('Unauthorized access attempt: no key id matching "' +
                          longKeyId + '" was found in "' + store.keyFile + '".')

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
