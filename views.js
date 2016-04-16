'use strict'

/**
 * NPM modules.
 */
var openpgp = require('openpgp')

/**
 * Local modules.
 */
var logger = require('./logger')
  , store = require('./store')


module.exports = function routes(router) {
  router.post('/secrets', function getListView(req, res) {

    store.getList(function getList(secrets) {
      res.writeHead(200, {'Content-Type': 'application/json'})

      var data = JSON.stringify(secrets)
      var publicKey = req.body.publicKey

      openpgp.encrypt(
        { data: data
          , publicKeys: openpgp.key.readArmored(publicKey).keys
        })
        .then(function sendPgpResponse(armored) {
          var pgpMessage = armored.data
          res.writeHead(200, {'Content-Type': 'application/json'})
          res.end(JSON.stringify({response: pgpMessage}, null, 2))
        })
    })
  })

  router.post('/secret', function getGpgView(req, res, next) {
    // retrieve path + username from request
    var relPath = req.body.path
    var username = req.body.username
    if (typeof relPath === typeof void 0 ||
        typeof username === typeof void 0) {

      if (typeof relPath === typeof void 0) {
        logger.debug('Request body does not have a path')
      } else if (typeof username === typeof void 0) {
        logger.debug('Request body does not have a username')
      }

      var e = new Error('Invalid secret requested.')
      e.status = 400
      throw e
    }

    store.getGpg(relPath, username, function getGpg(err, data) {
      if (!err) {
        var pgpMessage = store.buildPgpMessage(data)
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(JSON.stringify({response: pgpMessage}, null, 2))
      } else {
        next(err)
      }
    })
  })
}
