/* eslint-env mocha */
const Clamav = require('../index')
const scanner = Clamav.createScanner('localhost', 3310)

describe('Scanner', function () {
  describe('#scanBuffer()', function () {
    it('should respond OK with random bytes', function (done) {
      let randomBytes = Buffer.from('ygvcukqfr4ki')
      scanner.scanBuffer(randomBytes).then((res) => {
        if (Clamav.isCleanReply(res)) done()
        else done(new Error('should not respond FOUND with random bytes'))
      }).catch(done)
    })

    it('should respond FOUND with positive bytes', function (done) {
      // http://www.eicar.org/86-0-Intended-use.html
        let EICAR = Buffer.from('X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*') //eslint-disable-line
      scanner.scanBuffer(EICAR).then((res) => {
        if (Clamav.isCleanReply(res)) done(new Error('should not respond OK with positive bytes'))
        else done()
      }).catch(done)
    })

    it('should throw error with exceeded size stream', function (done) {
      // 2 * 1024 * 1024 bytes should bigger than the StreamMaxLength config in clamav server
      let exceededSizeStream = Buffer.alloc(2 * 1024 * 1024)
      scanner.scanBuffer(exceededSizeStream).then((res) => {
        done(new Error('sholud throw an error with exceeded size stream'))
        /* eslint-disable handle-callback-err */
      }).catch(err => done())
    })

    it('should respond OK with 0 byte', function (done) {
      scanner.scanBuffer(Buffer.alloc(0)).then((res) => {
        if (Clamav.isCleanReply(res)) done()
        else done(new Error('should not respond FOUND with zore byte'))
      }).catch(done)
    })
  })
})
