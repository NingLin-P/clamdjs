'use strict'

/**
 * Module dependencies.
 */

const net = require('net')
const fs = require('fs')
const path = require('path')
const Readable = require('stream').Readable
const Transform = require('stream').Transform

/**
 * Module exports.
 */

module.exports = {
  createScanner,
  ping,
  version,
  isCleanReply
}

/**
 * Create a scanner
 *
 * @param {string} host clamav server's host
 * @param {number} port clamav sever's port
 * @return {object}
 * @public
 */

function createScanner (host, port) {
  if (!host || !port) throw new Error('must provide the host and port that clamav server listen to')

  /**
   * scan a read stream
   * @param {number} [timeout = 5000] the socket's timeout option
   * @param {number} [chunkSize = 64kb] size of the chunk, which send to Clamav server
   * @return {Promise}
   */

  function scanStream (filePath, timeout, chunkSize) {
    if (typeof timeout !== 'number' || timeout < 0) timeout = 5000

    return new Promise(function (resolve, reject) {
      let readFinished = false

      let readStream = fs.createReadStream(filePath, {
        highWaterMark: chunkSize
      })
      .on('error', reject)
      const socket = net.createConnection({
        host,
        port
      }, function () {
        socket.write('zINSTREAM\0')
        // fotmat the chunk
        readStream.pipe(chunkTransform()).pipe(socket)
        readStream
          .on('end', function () {
            readFinished = true
            readStream.destroy()
          })
      })

      let replys = []
      socket.setTimeout(timeout)
      socket
        .on('data', function (chunk) {
          clearTimeout(connectAttemptTimer)
          if (!readStream.isPaused()) readStream.pause()
          replys.push(chunk)
        })
        .on('end', function () {
          clearTimeout(connectAttemptTimer)
          let reply = Buffer.concat(replys)
          if (!readFinished) reject(new Error('Scan aborted. Reply from server: ' + reply))
          else resolve(reply.toString())
        })
        .on('error', reject)

      const connectAttemptTimer = setTimeout(function () {
        socket.destroy(new Error('Timeout connecting to server'));
      }, timeout)
    })
  }

  /**
   * scan a Buffer
   * @param {string} path
   * @param {number} [timeout = 5000] the socket's timeout option
   * @param {number} [chunkSize = 64kb] size of the chunk, which send to Clamav server
   * @return {Promise}
   */

  function scanBuffer (buffer, timeout, chunkSize) {
    if (typeof timeout !== 'number' || timeout < 0) timeout = 5000
    if (typeof chunkSize !== 'number') chunkSize = 64 * 1024

    let start = 0
    const bufReader = new Readable({
      highWaterMark: chunkSize,
      read (size) {
        if (start < buffer.length) {
          let block = buffer.slice(start, start + size)
          this.push(block)
          start += block.length
        } else {
          this.push(null)
        }
      }
    })
    return scanStream(bufReader, timeout)
  }

  /**
   * scan a file
   * @param {string} filePath
   * @param {number} [timeout = 5000] the socket's timeout option
   * @param {number} [chunkSize = 64kb]  size of the chunk, which send to Clamav server
   * @return {Promise}
   */

  function scanFile (filePath, timeout, chunkSize) {
    filePath = path.normalize(filePath)
    if (typeof timeout !== 'number' || timeout < 0) timeout = 5000
    if (typeof chunkSize !== 'number') chunkSize = 64 * 1024

    return scanStream(filePath, timeout, chunkSize)
  }

  /**
   * scan a directory
   * @param {string} rootPath
   * @param {object} [options]
   * @return {Promise}
   */

  function scanDirectory (rootPath, options) {
    // TODO add ignore option
    rootPath = path.normalize(rootPath)
    let opts = options || {}
    let timeout = typeof opts.timeout !== 'number'
      ? 5000
      : opts.timeout
    let chunkSize = opts.chunkSize || 64 * 1024
    let scanningFile = opts.scanningFile || 10
    let detail = opts.detail !== false
    let cont = opts.cont !== false

    return new Promise(function (resolve, reject) {
      // scanning result
      let ScannedFiles = 0
      let Infected = 0
      let EncounterError = 0
      let Result = []
      // scaning queue's state
      let scanning = 0
      // keep track of the files and directories path, which upcoming to scan
      let dirs = []
      let files = []

      function scanDir (pathName) {
        let flist = null
        try {
          flist = fs.readdirSync(pathName)
        } catch (error) {
          if (cont) return done(pathName, null, error.message, 0)
          else return reject(error)
        }
        flist.forEach(function (entry) {
          let stats
          try {
            stats = fs.lstatSync(path.join(pathName, entry))
          } catch (error) {
            if (cont) return done(pathName, null, error.message, 0)
            else return reject(error)
          }
          if (stats.isDirectory() && !stats.isSymbolicLink()) {
            dirs.push(path.join(pathName, entry))
          } else if (stats.isFile() && !stats.isSymbolicLink()) {
            files.push(path.join(pathName, entry))
          }
        })
        // schedul scaning queue after scanned a directory
        schedulScan()
      }

      function scanFileWrap (path) {
        scanning = scanning + 1
        scanFile(path, timeout, chunkSize)
          .then(function (res) {
            done(path, res, null, 1)
          })
          .catch(function (e) {
            done(path, null, e.message, 1)
          })
      }

      function done (file, reply, errorMsg, finished) {
        scanning = scanning - finished
        ScannedFiles = ScannedFiles + 1

        if (reply !== null && !isCleanReply(reply))Infected = Infected + 1
        if (errorMsg !== null)EncounterError = EncounterError + 1
        if (detail) {
          Result.push({
            file,
            reply,
            errorMsg
          })
        } else if (errorMsg !== null || (reply !== null && !isCleanReply(reply))) {
          Result.push({
            file,
            reply,
            errorMsg
          })
        }
        if (files.length !== 0) scanFileWrap(files.shift())
        else if (dirs.length !== 0) scanDir(dirs.shift())
        else if (scanning === 0) {
          resolve({
            ScannedFiles,
            Infected,
            EncounterError,
            Result
          })
        }
      }

      function schedulScan () {
        if (scanning >= scanningFile) return
        if (files.length !== 0) {
          while (scanning < scanningFile && files.length !== 0) {
            scanFileWrap(files.shift())
          }
        } else if (dirs.length !== 0) scanDir(dirs.shift())
        else if (scanning === 0) {
          resolve({
            ScannedFiles,
            Infected,
            EncounterError,
            Result
          })
        }
      }

      let stats = null
      try {
        stats = fs.lstatSync(rootPath)
      } catch (error) {
        if (cont) return done(rootPath, null, error.message, 0)
        else return reject(error)
      }
      if (stats.isDirectory() && !stats.isSymbolicLink()) scanDir(rootPath)
      else if (stats.isFile() && !stats.isSymbolicLink()) scanFileWrap(rootPath)
      else reject(new Error(rootPath + ' is Not a regular file or directory'))
    })
  }

  return {
    scanStream,
    scanBuffer,
    scanFile,
    scanDirectory
  }
}

/**
 * Check the daemon’s state
 *
 * @param {string} host clamav server's host
 * @param {number} port clamav sever's port
 * @param {number} [timeout = 5000] the socket's timeout option
 * @return {boolean}
 * @public
 */

function ping (host, port, timeout) {
  if (!host || !port) throw new Error('must provide the host and port that clamav server listen to')
  if (typeof timeout !== 'number' || timeout < 0) timeout = 5000

  return _command(host, port, timeout, 'zPING\0')
    .then(function (res) {
      return res.equals(Buffer.from('PONG\0'))
    })
}

/**
 * Get clamav version detail.
 *
 * @param {string} host clamav server's host
 * @param {number} port clamav sever's port
 * @param {number} [timeout = 5000] pass to sets the socket's timeout optine
 * @return {string}
 * @public
 */

function version (host, port, timeout) {
  if (!host || !port) throw new Error('must provide the host and port that clamav server listen to')
  if (typeof timeout !== 'number' || timeout < 0) timeout = 5000

  return _command(host, port, timeout, 'zVERSION\0')
    .then(function (res) {
      return res.toString()
    })
}

/**
 * Check the reply mean the file infect or not
 *
 * @param {*} reply get from the scanner
 * @return {boolean}
 * @public
 */

function isCleanReply (reply) {
  return reply.includes('OK') && !reply.includes('FOUND')
}

/**
 * transform the chunk from read stream to the fotmat that clamav server expect
 *
 * @return {object} stream.Transform
 */
function chunkTransform () {
  return new Transform(
    {
      transform (chunk, encoding, callback) {
        const length = Buffer.alloc(4)
        length.writeUInt32BE(chunk.length, 0)
        this.push(length)
        this.push(chunk)
        callback()
      },

      flush (callback) {
        const zore = Buffer.alloc(4)
        zore.writeUInt32BE(0, 0)
        this.push(zore)
        callback()
      }
    })
}

/**
 * helper function for single command function like ping() and version()
 * @param {string} host
 * @param {number} port
 * @param {number} timeout
 * @param {string} command will send to clamav server, either 'zPING\0' or 'zVERSION\0'
 */
function _command (host, port, timeout, command) {
  return new Promise(function (resolve, reject) {
    const client = net.createConnection({
      host,
      port
    }, function () {
      client.write(command)
    })
    client.setTimeout(timeout)
    let replys = []
    client
      .on('data', function (chunk) {
        replys.push(chunk)
      })
      .on('end', function () {
        resolve(Buffer.concat(replys))
      })
      .on('error', reject)
  })
}
