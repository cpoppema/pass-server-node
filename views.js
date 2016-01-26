'use strict'

var store = require('./store')


module.exports = function routes(router) {
  router.post('/secrets', function getListView(req, res) {

    store.getList(function getList(secrets) {
      res.writeHead(200, {'Content-Type': 'application/json'})
      res.end(JSON.stringify(secrets, null, 2))
    })
  })

  router.post('/secret', function getGpgView(req, res, next) {
    // retrieve path + username from request
    var relPath = req.body.path
    var username = req.body.username
    if (typeof relPath === typeof void 0 ||
        typeof username === typeof void 0) {
      var e = new Error('Invalid secret requested.')
      e.status = 400
      throw e
    }

    store.getGpg(relPath, username, function getGpg(err, data) {
      if (!err) {
        var pgpMessage = store.buildPgpMessage(data)
        res.writeHead(200, {'Content-Type': 'text/plain'})
        res.end(pgpMessage)
      } else {
        next(err)
      }
    })
  })
}
