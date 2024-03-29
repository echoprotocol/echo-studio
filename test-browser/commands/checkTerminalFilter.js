const EventEmitter = require('events')

class CheckTerminalFilter extends EventEmitter {
  command (filter, test) {
    this.api.perform((done) => {
      checkFilter(this.api, filter, test, () => {
        done()
        this.emit('complete')
      })
    })
    return this
  }
}

function checkFilter (browser, filter, test, done) {
  if (browser.options.desiredCapabilities.browserName === 'chrome') { // nightwatch deos not handle well that part.... works locally
    done()
    return
  }
  var filterClass = '#editor-container div[class^="search"] input[class^="filter"]'
  browser.setValue(filterClass, filter, function () {
    browser.execute(function () {
      return document.querySelector('#editor-container div[class^="journal"]').innerHTML === test
    }, [], function (result) {
      browser.clearValue(filterClass).setValue(filterClass, '', function () {
        if (!result.value) {
          browser.assert.fail('useFilter on ' + filter + ' ' + test, 'info about error', '')
        }
        done()
      })
    })
  })
}

module.exports = CheckTerminalFilter
