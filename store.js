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
  // make sure password_store_dir points to a directory
  this.passwordDir = process.env.npm_config_password_store_dir ||
    process.env.PASSWORD_STORE_DIR ||
    process.env.npm_package_config_password_store_dir

  if (!this.passwordDir) {
    throw new Error('No password store directory specified.')
  }

  if (this.passwordDir.split(path.sep)[0] == '~') {
    this.passwordDir = path.join(process.env.HOME,
      this.passwordDir.split(path.sep).slice(1).join(path.sep))
  }

  var stats = fs.lstatSync(this.passwordDir)
  if (!stats.isDirectory()) {
    throw new Error("'" + this.passwordDir + "' is not a directory.")
  }

  // make sure PASSWORD_STORE_DIR is accessible
  fs.accessSync(this.passwordDir, fs.R_OK | fs.X_OK)

  // make sure PASSWORD_STORE_DIR/.gpg-id is accessible
  this.keyFile = path.join(this.passwordDir, '.gpg-id')
  fs.accessSync(this.keyFile, fs.R_OK)
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

  try {
    var stats = fs.lstatSync(secretPath)
    if (path.relative(this.passwordDir, secretPath).substr(0, 2) === '..' ||
        !stats.isFile()) {
      var e = new Error('No such secret exists.')
      e.status = 400
      throw e
    }
  } catch (e) {
    var e = new Error('No such secret exists.')
    e.status = 400
    throw e
  }

  // make sure secretPath is accessible
  try {
    fs.accessSync(secretPath, fs.R_OK)
  } catch (e) {
    e.status = 503
    throw e
  }

  try {
    var data = fs.readFileSync(secretPath)
    try {
      done(null, data)
    } catch (e) {
      e.status = 500
      done(e)
    }
  } catch (e) {
    e.status = 500
    done(e)
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

  walker.on('file', function onFile(root, fileStats, next) {
    if (root === passwordDir) {
      // skip everything in the root directory
      next()
    } else {
      var domain = path.basename(root)
      var extension = path.extname(fileStats.name)
      var username = path.basename(fileStats.name, extension)
      var relPath = path.relative(passwordDir, root)

      // skip everything without a domain
      if (domain) {
        // add file to secrets
        secrets.push(
          { domain: domain
          , path: relPath
          , username: username
          , username_normalized: unorm.nfkd(username)
          })
      }

      next()
    }
  })

  walker.on('errors', function onError(root, nodeStatsArray, next) {
    console.log('error', nodeStatsArray)
    next()
  })

  walker.on('end', function onFinished() {
    // sort case insensitive and accent insensitive
    secrets = secrets.sort(function compareSecret(secret1, secret2) {
      return (secret1.domain.localeCompare(secret2.domain) ||
              unorm.nfkd(secret1.username)
                .localeCompare(unorm.nfkd(secret2.username)))
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
    // try both the long and short key id
    var shortKeyId = longKeyId.substr(-8)

    var isAuthenticated = false
    var eachLine = Promise.promisify(lineReader.eachLine)
    eachLine(this.keyFile, function handleLine(line) {
      isAuthenticated = (line === longKeyId || line === shortKeyId)
      return !isAuthenticated
    }).then(function onFulfilled() {
      done(isAuthenticated)
    }, function onRejected(reason) {
      throw new Error(reason)
    })
  }
}

module.exports = new Store()
