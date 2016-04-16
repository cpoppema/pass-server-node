'use strict'
/**
 * Node modules.
 */
var fs = require('fs')
  , path = require('path')

/**
 * NPM modules.
 */
var dateFormat = require('dateformat')
var winston = require('winston')


/**
 * Singleton Logger.
 */
var Logger = function Logger(app) {
  if (Logger.prototype.logger) {
    return Logger.prototype.logger
  }

  Logger.prototype.logger = this
  Logger.prototype.logger.init(app)
}


/**
 * Functions to help formatting messages for winston.
 */
function getLogTimestamp() {
  return dateFormat(new Date(), 'dd/mmm/yyyy HH:MM:ss')
}

function formatLogMessage(options) {
  return '[' + options.timestamp() + ']'
    + ' ' + options.level.toUpperCase()
    + ' ' + options.message
}


/**
 * Initialize logging: make sure logs can be written or only setup the console.
 */
Logger.prototype.init = function init(app) {
  // configure set of levels
  winston.setLevels(
    { error: 0
    , warn: 1
    , info: 2
    , debug: 4
    })

  // set level according to configuration
  var logLevel = process.env.npm_config_log_level ||
    process.env.LOG_LEVEL ||
    process.env.npm_package_config_log_level

  if (!winston.levels.hasOwnProperty(logLevel.toLowerCase())) {
    var logLevels = Object.keys(winston.levels)
    throw new Error('"' + logLevel + '" is not a valid log level, pick ' +
                    'from: "' + logLevels.reverse().join(', ') + '"')
  }

  logLevel = logLevel.toLowerCase()

  // configure loggers
  var logContainers =
    { error: {}
    , server: {}
    }

  // make sure lgoDir points to a directory - if set at all
  var logDir = ''
  if (typeof process.env.npm_config_log_dir != typeof void 0) {
    logDir = process.env.npm_config_log_dir
  } else if (typeof process.env.LOG_DIR != typeof void 0) {
    logDir = process.env.LOG_DIR
  } else if (typeof process.env.npm_package_config_log_dir != typeof void 0) {
    logDir = process.env.npm_package_config_log_dir
  }

  if (logDir) {
    // expand tilde to $HOME
    if (logDir.split(path.sep)[0] == '~') {
      logDir = path.join(process.env.HOME,
        logDir.split(path.sep).slice(1).join(path.sep))
    }

    fs.existsSync(logDir) || fs.mkdirSync(logDir)

    if (!path.isAbsolute(logDir)) {
      logDir = path.resolve(logDir)
    }

    var logDirStats = fs.lstatSync(logDir)
    if (!logDirStats.isDirectory()) {
      throw new Error('"' + logDir + '" is not a directory.')
    }

    // make sure files can be either created or rotated
    fs.accessSync(logDir, fs.R_OK | fs.W_OK | fs.X_OK)

    // make sure there are log files to write to, by checking permissions or
    // creating them
    var errorLogFile = path.join(logDir, 'error.log')
    var globalLogFile = path.join(logDir, 'server.log')
    if (!fs.existsSync(errorLogFile) ||
        !fs.existsSync(globalLogFile)) {
      // create log files
      if (!fs.existsSync(errorLogFile)) {
        fs.closeSync(fs.openSync(errorLogFile, 'w'))
      }
      if (!fs.existsSync(globalLogFile)) {
        fs.closeSync(fs.openSync(globalLogFile, 'w'))
      }
    } else {
      // if both files already exist, make sure they are writable files
      var errorLogFileStats = fs.lstatSync(errorLogFile)
      if (!errorLogFileStats.isFile()) {
        throw new Error('"' + errorLogFile + '" is not a file.')
      }
      var globalLogFileStats = fs.lstatSync(globalLogFile)
      if (!globalLogFileStats.isFile()) {
        throw new Error('"' + globalLogFile + '" is not a file.')
      }

      fs.accessSync(errorLogFile, fs.W_OK)
      fs.accessSync(globalLogFile, fs.W_OK)
    }

    // add file loggers
    logContainers.error['file'] =
      { filename: errorLogFile
      , formatter: formatLogMessage
      , handleExceptions: true
      , humanReadableUnhandledException: true
      , json: false
      , level: 'error'
      , maxFiles: 2
      , maxsize: 1024 * 1024  // 1 MB
      , tailable: true
      , timestamp: getLogTimestamp
      }
    logContainers.server['file'] =
      { filename: globalLogFile
      , formatter: formatLogMessage
      , json: false
      , level: logLevel
      , maxFiles: 2
      , maxsize: 1024 * 1024  // 1 MB
      , tailable: true
      , timestamp: getLogTimestamp
      }
  }

  // add console loggers
  logContainers.server['console'] =
    { json: false
    , level: logLevel
    , timestamp: getLogTimestamp
    , formatter: formatLogMessage
    }
  logContainers.error['console'] =
    { json: false
    , level: 'error'
    , timestamp: getLogTimestamp
    , formatter: formatLogMessage
    }

  // configure logger containers
  winston.loggers.add('server', logContainers.server)
  winston.loggers.add('error', logContainers.error)

  // add log functions for levels
  for (var level in winston.levels) {
    function log(level) {
      return function log(message) {
        var logger = 'server'
        if (level == 'error') {
          logger = 'error'
        }
        winston.loggers.get(logger).log(level, message)
      }
    }

    this[level] = log(level)
  }
}

module.exports = new Logger()
