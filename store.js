'use strict'

/**
 * Node modules.
 */
var fs = require('fs')
  , path = require('path')

/**
 * NPM modules.
 */
var crc = require('crc')
  , lineReader = require('line-reader')
  , Promise = require('bluebird')
  , walk = require('walk')
  , unorm = require('unorm')

/**
 * Local modules.
 */
var logger = require('./logger')


/**
 * Singleton Store.
 */
var Store = function Store() {
  if (Store.prototype.store) {
    return Store.prototype.store
  }

  Store.prototype.store = this
  Store.prototype.store.init()
}


/**
 * Initialize the store: perform some sanity checks.
 */
Store.prototype.init = function init() {
  // make sure passwordDir points to a directory
  this.passwordDir = process.env.npm_config_password_store_dir ||
    process.env.PASSWORD_STORE_DIR ||
    process.env.npm_package_config_password_store_dir

  if (!this.passwordDir) {
    throw new Error('No password store directory specified.')
  }

  // expand tilde to $HOME
  if (this.passwordDir.split(path.sep)[0] == '~') {
    this.passwordDir = path.join(process.env.HOME,
      this.passwordDir.split(path.sep).slice(1).join(path.sep))
  }

  if (!path.isAbsolute(this.passwordDir)) {
    this.passwordDir = path.resolve(this.passwordDir)
  }

  var stats = fs.lstatSync(this.passwordDir)
  if (!stats.isDirectory()) {
    throw new Error("'" + this.passwordDir + "' is not a directory.")
  }

  // make sure passwordDir is accessible
  fs.accessSync(this.passwordDir, fs.R_OK | fs.X_OK)

  // make sure passwordDir/.gpg-id is accessible
  this.keyFile = path.join(this.passwordDir, '.gpg-id')
  fs.accessSync(this.keyFile, fs.R_OK)

  logger.info('Reading from "' + this.passwordDir + '".')

  // log current available keys
  var data = fs.readFileSync(this.keyFile, 'ascii')
  var keyIds = data.trim().split('\n')
  logger.info('Store keys: ' + keyIds.join(', ') + '.')
}

/**
 * Build an ascii armored pgp message.
 */
Store.prototype.buildPgpMessage = function buildPgpMessage(data) {
  var pgpMessage = ''
  pgpMessage += '-----BEGIN PGP MESSAGE-----\n\n'
  pgpMessage += data.toString('base64') + '\n'
  pgpMessage += '=' + this.getChecksum(data) + '\n'
  pgpMessage += '-----END PGP MESSAGE-----'

  return pgpMessage
}

/**
 * Calculate the checksum for given data.
 */
Store.prototype.getChecksum = function getChecksum(data) {
  var hash = crc.crc24(data)
  return new Buffer('' +
      String.fromCharCode(hash >> 16) +
      String.fromCharCode((hash >> 8) & 0xFF) +
      String.fromCharCode(hash & 0xFF),
    'ascii').toString('base64')
}

/**
 * Get the file data from a secret's file (.gpg).
 */
Store.prototype.getGpg = function getGpg(relPath, username, done) {
  var secretFilename = username + '.gpg'
  var secretRelPath = path.join(relPath, secretFilename)
  var secretPath = path.resolve(path.join(this.passwordDir, secretRelPath))

  if (path.relative(this.passwordDir, secretPath).substr(0, 2) === '..') {
    logger.debug('Requested secret points to a file located outside the ' +
                 'password store.')

    var e = new Error('No such secret exists.')
    e.status = 400
    throw e
  }

  if (!fs.existsSync(secretPath)) {
    logger.debug('Requested secret points to a file that does not exist: "' +
                 secretPath + '".')

    var e = new Error('No such secret exists.')
    e.status = 400
    throw e
  }

  var stats = fs.lstatSync(secretPath)
  if (!stats.isFile()) {
    logger.debug('Requested secret points to a directory: "' +
                 secretPath + '".')

    var e = new Error('No such secret exists.')
    e.status = 400
    throw e
  }

  // make sure secretPath can be read
  try {
    fs.accessSync(secretPath, fs.R_OK)
  } catch (ex) {
    logger.error('Requested secret could be read: "' + secretPath + '".')

    ex.status = 503
    throw ex
  }

  try {
    var data = fs.readFileSync(secretPath)
    try {
      done(null, data)
    } catch (ex) {
      logger.error('Requested secret could be read: "' + secretPath + '".')

      ex.status = 500
      done(ex)
    }
  } catch (ex) {
    logger.error('Requested secret could be read: "' + secretPath + '".')

    ex.status = 500
    done(ex)
  }
}

/**
 * Get a list of secrets currently on disk.
 */
Store.prototype.getList = function getList(done) {
  var passwordDir = this.passwordDir

  var secrets = []

  var walker = walk.walk(passwordDir, {
    followLinks: false
  })

  logger.debug('Building list of secrets.')

  walker.on('file', function onFile(root, fileStats, next) {
    if (root === passwordDir) {
      // skip everything in the root directory
      logger.debug('Skipping from "./": "' + fileStats.name + '".')

      next()
    } else {
      var domain = path.basename(root)
      var extension = path.extname(fileStats.name)
      var username = path.basename(fileStats.name, extension)
      var relPath = path.relative(passwordDir, root)

      if (extension == '.gpg') {
        logger.debug('Add from "./' + relPath + '": "' + domain + '/' +
                     username + '".')

        // add file to secrets
        secrets.push(
          { domain: domain
          , path: relPath
          , username: username
          , username_normalized: unorm.nfkd(username)
                                   .replace(/[^\u0000-\u00FF]/g, '')
          })
      } else {
        logger.debug('Skip from "./' + relPath + '": "' +
                     fileStats.name + '".')
      }

      next()
    }
  })

  walker.on('end', function onFinished() {
    // sort case insensitive and accent insensitive
    secrets = secrets.sort(function compareSecret(secret1, secret2) {
      return (secret1.domain.localeCompare(secret2.domain) ||
              secret1.username_normalized
                .localeCompare(secret2.username_normalized))
    })

    done(secrets)
  })
}

Store.prototype.validateKey = function validateKey(longKeyId, done) {
  if (longKeyId.length != 16) {
    var e = new Error('Please provide a proper keyId.')
    e.status = 400
    throw e
  } else {
    // validate variations also
    var longKeyId0 = '0' + longKeyId
    var longKeyId0x = '0x' + longKeyId
    var shortKeyId = longKeyId.substr(-8)
    var shortKeyId0 = '0' + shortKeyId
    var shortKeyId0x = '0x' + shortKeyId
    var keys = [ longKeyId
               , longKeyId0
               , longKeyId0x
               , shortKeyId
               , shortKeyId0
               , shortKeyId0x
               ]

    logger.debug('Validating key from request and all its variations: "' +
                 keys.slice(1).join(', ') + '".')

    var isAuthenticated = false
    var eachLine = Promise.promisify(lineReader.eachLine)
    eachLine(this.keyFile, function handleLine(line) {
      isAuthenticated = (keys.indexOf(line) !== -1)

      logger.debug('Key "' + line + '" ' +
                   (isAuthenticated ? 'is a match' : 'is not a match'))

      return !isAuthenticated
    }).then(function onFulfilled() {
      done(isAuthenticated)
    }, function onRejected(reason) {
      throw new Error(reason)
    })
  }
}

module.exports = new Store()
