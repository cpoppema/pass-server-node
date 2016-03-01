'use strict'

/**
 * NPM modules.
 */
var bodyParser = require('body-parser')
  , connect = require('connect')
  , connectRoute = require('connect-route')

/**
 * Local modules.
 */
var authMiddleware = require('./auth-middleware')
  , errorMiddleware = require('./error-middleware')
  , views = require('./views')


var app = connect()

/**
 * Parse the incoming request body as json.
 */
app.use(bodyParser.json())

/**
 * Authentication
 */
app.use(authMiddleware())

/**
 * Routing.
 */

app.use(connectRoute(views))

/**
 * Error handling.
 */

app.use(errorMiddleware())

/**
 * Server start.
 */

app.listen(process.env.npm_config_port ||
           process.env.PORT ||
           process.env.npm_package_config_port)
