/* eslint-env mocha */
const Clamav = require('../index')

describe('test clamav server', function () {
  describe('#ping()', function () {
    it('should respond true', function (done) {
      Clamav.ping('localhost', 3310)
        .then(function () { done() })
        .catch(done)
    })
  })

  describe('#version()', function (done) {
    it('should respond clamav version detail', function (done) {
      Clamav.version('localhost', 3310)
        .then(function (res) {
          if (res) done()
          else done(new Error('get empty response'))
        })
        .catch(done)
    })
  })
})
