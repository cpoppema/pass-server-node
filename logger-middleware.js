'use strict'

/**
 * Local modules.
 */
var logger = require('./logger')


module.exports = function LoggerMiddleware() {
  return function handle(req, res, next) {
    var end = res.end

    res.end = function logRequest() {
      // log this with every request
      var requestData =
        [ '"' + req.method + ' ' + req.url + '"'
        , res.statusCode
        , '"' + req.headers['user-agent'] + '"'
        ].join(' ')

      // use different levels for different status codes
      if (res.statusCode >= 500) {
        logger.error(requestData)
      } else if (res.statusCode == 400) {
        logger.warn(requestData)
      } else {
        logger.info(requestData)
      }

      // useful information when building against this server
      if (req.headers['content-type'] !== 'application/json') {
        logger.debug('Request with incorrect content-type: "' +
                     req.headers['content-type'] + '" is not ' +
                     '"application/json".')
      }

      end.apply(res, arguments)
    }

    next()
  }
}
