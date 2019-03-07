Clamdjs
===
A ClamAV client on node.js
---

The library will uses TCP socket communicate with `clamd` (ClamAV daemon) through some commands

Clamd protocol is explained here:
http://linux.die.net/man/8/clamd

----
## Provide
- Scan `Stream` and `Buffer`
- Scan `local File` and `local Directory`
- Check the daemon’s state
- Get the version detail of the running ClamAV program

----
## Installation

```sh
$ npm install clamdjs
```
----
### API
```js
const clamd = require('clamdjs')
const scanner = clamd.createScanner(host, port)
```
## scanner.scanStream(stream, [timeout])
```js
scanner.scanStream(stream, 3000)
       .then(function (reply) {
           console.log(reply) 
           // print some thing like
           // 'stream: OK', if not infected
           // `stream: ${virus} FOUND`, if infected
       })
       .catch(handler)
```
**Returns a promise, which will resovle with the reply from the ClamAV server**
- `stream (Object)` - read stream object 
- `timeout (Number)` - use to set the socket's timeout option, default `5000`

## scanner.scanBuffer(buffer, [timeout], [chunkSize])
```js
scanner.scanBuffer(buffer, 3000, 1024 * 1024)
       .then(function (reply) {
           console.log(reply) 
           // print some thing like
           // 'stream: OK', if not infected
           // `stream: ${virus} FOUND`, if infected
       })
       .catch(handler)
```
**Returns a promise, which will resovle with the reply from the ClamAV server**
- `buffer (Object)`
- `timeout (Number)` - use to set the socket's timeout option, default `5000`
- `chunkSize (Number)` - size of the chunk, which will send to ClamAV server, default `64 * 1024`

## scanner.scanFile(path, [timeout], [chunkSize])
```js
scanner.scanFile(path, 3000, 1024 * 1024)
       .then(function (reply) {
           console.log(reply) 
           // print some thing like
           // 'stream: OK', if not infected
           // `stream: ${virus} FOUND`, if infected
       })
       .catch(handler)
```
**Returns a promise, which will resovle with the reply from the ClamAV server**
- `path (String)` - file path, will be pass to path.normalize() first
- `timeout (Number)` - use to set the socket's timeout option, default `5000`
- `chunkSize (Number)` - size of the chunk, which will send to ClamAV server, default `64 * 1024`

## scanner.scanDirectory(rootPath, [options])
```js
let options = {
    timeout: 5000,
    chunkSize: 64 * 1024,
    scanningFile: 10,
    detail: true,
    cont: true
}
scanner.scanDirectory(rootPath, options)
       .then(function (reply) {
           console.log(reply) 
           /* print some thing like
           {
                ScannedFiles: 11,
                Infected: 3,
                EncounterError: 1,
                Result:[...]
           }
           */
       })
       .catch(handler)
```
**Returns a promise, which will resovle with a object which contained the scan summary**

- `rootPath (String)` - directory path, will be pass to path.normalize() first
- `options (Object)`
  - `timeout (Number)` - use to set the socket's timeout option, default `5000`
  - `chunkSize (Number)` - size of the chunk, which will send to ClamAV server, default `64 * 1024`
  - `scanningFile (Number)` - the number of file will scan concurrently, should not be greater than the file table limit in node.js, default `10`
  - `detail (Boolean)` - if `true` the output object will contain the scan summary and all scaned files's scan result no matter infected or not, if `false` the output object will contain the scan summary and scan result of infected files and file that encountered error when scanning, default `true`
  - `cont (Boolean)` - when scanning a path and an Error throw, if `true`, will move on to scan next path, if `false`, will stop scanning and return a rejected promise, default `true`

## clamd.ping()
**Returns true if clamd daemon alive**

## clamd.version()
**Returns clamav version information**

## clamd.isCleanReply(reply)
**Returns true if the reply of a scan means OK, false if means infected**