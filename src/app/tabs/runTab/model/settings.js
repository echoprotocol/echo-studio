var Personal = require('web3-eth-personal')
var remixLib = require('remix-lib')
const addTooltip = require('../../../ui/tooltip')
var EventManager = remixLib.EventManager
var executionContext = remixLib.execution.executionContext

class Settings {

  constructor (udapp) {
    this.udapp = udapp
    this.event = new EventManager()

    this.udapp.event.register('transactionExecuted', (error, from, to, data, lookupOnly, txResult) => {
      this.event.trigger('transactionExecuted', [error, from, to, data, lookupOnly, txResult])
    })

    executionContext.event.register('contextChanged', (context, silent) => {
      this.event.trigger('contextChanged', [context, silent])
    })

    executionContext.event.register('addProvider', (network) => {
      this.event.trigger('addProvider', [network])
    })

    executionContext.event.register('removeProvider', (name) => {
      this.event.trigger('removeProvider', [name])
    })

    executionContext.event.register('connectToNetwork', (name, id) => {
      this.event.trigger('connectToNetwork', [name, id])
    })

    this.networkcallid = 0
  }

  changeExecutionContext (context, confirmCb, infoCb, cb) {
    return executionContext.executionContextChange(context, null, confirmCb, infoCb, cb)
  }

  setProviderFromEndpoint (target, context, infoCb, cb) {
    return executionContext.setProviderFromEndpoint(target, context, infoCb, cb)
  }

  getProvider () {
    return executionContext.getProvider()
  }

  getAccountBalances (accountId, cb) {
    return this.udapp.getAccountBalances(accountId, cb)
  }

  updateNetwork (cb) {
    this.networkcallid++
    ((callid) => {
      executionContext.detectNetwork((err, { id, name } = {}) => {
        if (this.networkcallid > callid) return
        this.networkcallid++
        if (err) {
          return cb(err)
        }
        cb(null, {id, name})
      })
    })(this.networkcallid)
  }

  // newAccount (passphraseCb, cb) {
  //   return this.udapp.newAccount('', passphraseCb, cb)
  // }

  getAccounts (cb) {
    return this.udapp.getAccounts(cb);
  }

  getInfoByWif(wif) {
    return this.udapp.getInfo(wif);
  }

  validateWif(wif) {
    return this.udapp.validateWif(wif);
  }

  isEchojslibProvider () {
    var isInjected = executionContext.getProvider() === 'injected'
    return !isInjected
  }

  isInjectedEchojslib () {
    return executionContext.getProvider() === 'injected'
  }

  isExternalEchoConnected() {
    return executionContext.isExternalEchoConnected()
  }

  signMessage (message, account, passphrase, cb) {
    var isInjected = executionContext.getProvider() === 'injected'

    if (isInjected) {
      const hashedMsg = executionContext.web3().sha3(message)
      try {
        addTooltip('Please check your provider to approve')
        executionContext.web3().eth.sign(account, hashedMsg, (error, signedData) => {
          cb(error.message, hashedMsg, signedData)
        })
      } catch (e) {
        cb(e.message)
      }
      return
    }

    const hashedMsg = executionContext.web3().sha3(message)
    try {
      var personal = new Personal(executionContext.web3().currentProvider)
      personal.sign(hashedMsg, account, passphrase, (error, signedData) => {
        cb(error.message, hashedMsg, signedData)
      })
    } catch (e) {
      cb(e.message)
    }
  }

}

module.exports = Settings
