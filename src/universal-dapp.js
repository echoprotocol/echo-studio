var async = require('async')
var ethJSUtil = require('ethereumjs-util')
var BN = ethJSUtil.BN
var remixLib = require('remix-lib')
var TxRunner = remixLib.execution.txRunner
var txHelper = remixLib.execution.txHelper
var EventManager = remixLib.EventManager
var executionContext = remixLib.execution.executionContext
import { Plugin } from '@remixproject/engine'
import { EventEmitter } from 'events'
import * as packageJson from '../package.json'

const profile = {
  name: 'udapp',
  displayName: 'universal dapp',
  description: 'service - run transaction and access account',
  permission: true,
  version: packageJson.version,
  methods: ['createVMAccount', 'newTransaction', 'sendTransaction', 'getAccounts', 'pendingTransactionsCount']
}

module.exports = class UniversalDApp extends Plugin {

  constructor (registry) {
    super(profile)
    this.events = new EventEmitter()
    this.event = new EventManager()
    this._deps = {
      config: registry.get('config').api
    }

    this._txRunnerAPI = {
      config: this._deps.config,
      detectNetwork: (cb) => {
        executionContext.detectNetwork(cb)
      },
      personalMode: () => {
        return executionContext.getProvider() === 'web3' ? this._deps.config.get('settings/personal-mode') : false
      }
    }
    this.txRunner = new TxRunner({}, this._txRunnerAPI)
    this.accounts = {}
    executionContext.event.register('contextChanged', this.resetEnvironment.bind(this))
  }

  // TODO : event should be triggered by Udapp instead of TxListener
  /** Listen on New Transaction. (Cannot be done inside constructor because txlistener doesn't exist yet) */
  startListening (txlistener) {
    txlistener.event.register('newTransaction', (tx) => {
      this.events.emit('newTransaction', tx)
    })
  }

  resetEnvironment () {
    this.accounts = {}
    // TODO: most params here can be refactored away in txRunner
    this.txRunner = new TxRunner(this.accounts, {
      // TODO: only used to check value of doNotShowTransactionConfirmationAgain property
      config: this._deps.config,
      // TODO: to refactor, TxRunner already has access to executionContext
      detectNetwork: (cb) => {
        executionContext.detectNetwork(cb)
      },
      personalMode: () => {
        return executionContext.getProvider() === 'web3' ? this._deps.config.get('settings/personal-mode') : false
      }
    })
    this.txRunner.event.register('transactionBroadcasted', (txhash) => {
      executionContext.detectNetwork((error, network) => {
        if (error || !network) return
        this.event.trigger('transactionBroadcasted', [txhash, network.name])
      })
    })
  }

  resetAPI (transactionContextAPI) {
    this.transactionContextAPI = transactionContextAPI
  }

  // /**
  //  * Create a VM Account
  //  * @param {{privateKey: string, balance: string}} newAccount The new account to create
  //  */
  // createVMAccount (newAccount) {
  //   const { privateKey, balance } = newAccount
  //   if (executionContext.getProvider() !== 'vm') {
  //     throw new Error('plugin API does not allow creating a new account through web3 connection. Only vm mode is allowed')
  //   }
  //   this._addAccount(privateKey, balance)
  //   const privKey = Buffer.from(privateKey, 'hex')
  //   return '0x' + ethJSUtil.privateToAddress(privKey).toString('hex')
  // }

  // newAccount (password, passwordPromptCb, cb) {
  //   var privateKey
  //   do {
  //     privateKey = crypto.randomBytes(32)
  //   } while (!ethJSUtil.isValidPrivate(privateKey))
  //   this._addAccount(privateKey, '0x56BC75E2D63100000')
  //   cb(null, '0x' + ethJSUtil.privateToAddress(privateKey).toString('hex'));
  // }

  // _addAccount (privateKey, balance) {
  //
  //   if (this.accounts) {
  //     privateKey = Buffer.from(privateKey, 'hex')
  //     const address = ethJSUtil.privateToAddress(privateKey)
  //
  //     // FIXME: we don't care about the callback, but we should still make this proper
  //     let stateManager = executionContext.vm().stateManager
  //     stateManager.getAccount(address, (error, account) => {
  //       if (error) return console.log(error)
  //       account.balance = balance || '0xf00000000000000001'
  //       stateManager.putAccount(address, account, function cb (error) {
  //         if (error) console.log(error)
  //       })
  //     })
  //
  //     this.accounts['0x' + address.toString('hex')] = { privateKey, nonce: 0 }
  //   }
  // }

  getAccounts (cb) {
    return new Promise((resolve, reject) => {
      const provider = executionContext.getProvider()
      switch (provider) {
        case 'injected': {
          executionContext.echojslib().extension.getAccounts().then((accounts) => {
            if (cb) cb(null, accounts)
            return resolve(accounts)
          })
          .catch((error) => {
            if (cb) cb(error, [])
            return reject(error)
          })
        }
      }
    })
  }

  getInfo (wif, cb) {
    const pb = executionContext.echojslib().PrivateKey.fromWif(wif).toPublicKey().toPublicKeyString()
    return executionContext.echoConnection().api.getKeyReferences([pb])
  }

  validateWif (wif) {
    return executionContext.echojslib().validators.isHex(wif)
  }

  getAccountBalances (accountId, cb) {
    executionContext.getEchoApi().getFullAccounts([accountId])
    .then((results) => {
      console.log(results)
      if (!results || !results[0]) {
        return cb('Unknown account id')
      }

      const { balances } = results[0]
      const balancesArray = Object.keys(balances).map((assetType) => ({assetType, objectId: balances[assetType]}))

      if (!balancesArray.length) {
        return cb(null, [{
          precision: 8,
          symbol: 'ECHO',
          amount: '0',
          assetType: '1.3.0'
        }])
      }

      Promise.all(balancesArray.map((balanceObject) => {
        return new Promise((resolve) => {
          executionContext.getEchoApi().getObject(balanceObject.objectId)
          .then((result) => ({
            amount: result.balance,
            assetType: balanceObject.assetType
          }))
          .then((result) => {
            executionContext.getEchoApi().getObject(result.assetType)
            .then((assetResult) => resolve({
              ...result,
              symbol: assetResult.symbol,
              precision: assetResult.precision
            }))
          })
          .catch(() => resolve({
            amount: null,
            assetType: balanceObject.assetType
          }))
        })
      }))
      .then((result) => {
        return cb(null, result)
      })
    })
  }

  getBalance (address, cb) {
    address = ethJSUtil.stripHexPrefix(address)

    if (!this.accounts) {
      return cb('No accounts?')
    }

    executionContext.getEchoApi().getAccountBalances(address, ['1.3.0'], true)
    .then((result) => {
      const [item] = result
      cb(null, new BN(item.amount).toString(10))
    })
    .catch((error) => {
      cb(error)
    })
  }

  getBalanceInEther (address, callback) {
    this.getBalance(address, (error, balance) => {
      if (error) {
        callback(error)
      } else {
        callback(null, executionContext.web3().fromWei(balance, 'ether'))
      }
    })
  }

  pendingTransactionsCount () {
    return Object.keys(this.txRunner.pendingTxs).length
  }

  /**
    * deploy the given contract
    *
    * @param {String} data    - data to send with the transaction ( return of txFormat.buildData(...) ).
    * @param {Function} callback    - callback.
    */
  createContract (data, confirmationCb, continueCb, promptCb, callback) {
    this.runTx({data: data, useCall: false}, confirmationCb, continueCb, promptCb, (error, txResult) => {
      // see universaldapp.js line 660 => 700 to check possible values of txResult (error case)
      callback(error, txResult)
    })
  }

  /**
    * call the current given contract
    *
    * @param {String} to    - address of the contract to call.
    * @param {String} data    - data to send with the transaction ( return of txFormat.buildData(...) ).
    * @param {Object} funAbi    - abi definition of the function to call.
    * @param {Function} callback    - callback.
    */
  callFunction (to, data, funAbi, confirmationCb, continueCb, promptCb, callback) {
    this.runTx({to: to, data: data, useCall: funAbi.constant}, confirmationCb, continueCb, promptCb, (error, txResult) => {
      // see universaldapp.js line 660 => 700 to check possible values of txResult (error case)
      callback(error, txResult)
    })
  }

  context () {
    return 'blockchain'
  }

  getABI (contract) {
    return txHelper.sortAbiFunction(contract.abi)
  }

  getFallbackInterface (contractABI) {
    return txHelper.getFallbackInterface(contractABI)
  }

  getInputs (funABI) {
    if (!funABI.inputs) {
      return ''
    }
    return txHelper.inputParametersDeclarationToString(funABI.inputs)
  }

  /**
   * This function send a tx only to javascript VM or testnet, will return an error for the mainnet
   * SHOULD BE TAKEN CAREFULLY!
   *
   * @param {Object} tx    - transaction.
   */
  sendTransaction (tx) {
    return new Promise((resolve, reject) => {
      executionContext.detectNetwork((error, network) => {
        if (error) return reject(error)
        if (network.name === 'Main' && network.id === '1') {
          return reject(new Error('It is not allowed to make this action against mainnet'))
        }
        this.silentRunTx(tx, (error, result) => {
          if (error) return reject(error)
          resolve({
            transactionHash: result.transactionHash,
            status: result.result.status,
            gasUsed: '0x' + result.result.gasUsed.toString('hex'),
            error: result.result.vm.exceptionError,
            return: result.result.vm.return ? '0x' + result.result.vm.return.toString('hex') : '0x',
            createdAddress: result.result.createdAddress ? '0x' + result.result.createdAddress.toString('hex') : undefined
          })
        })
      })
    })
  }

  /**
   * This function send a tx without alerting the user (if mainnet or if gas estimation too high).
   * SHOULD BE TAKEN CAREFULLY!
   *
   * @param {Object} tx    - transaction.
   * @param {Function} callback    - callback.
   */
  silentRunTx (tx, cb) {
    this.txRunner.rawRun(
      tx,
      (network, tx, gasEstimation, continueTxExecution, cancelCb) => { continueTxExecution() },
      (error, continueTxExecution, cancelCb) => { if (error) { cb(error) } else { continueTxExecution() } },
      (okCb, cancelCb) => { okCb() },
      cb
    )
  }

  runTx (args, confirmationCb, continueCb, promptCb, cb) {
    const self = this
    async.waterfall([
      function getGasLimit (next) {
        if (self.transactionContextAPI.getGasLimit) {
          return self.transactionContextAPI.getGasLimit(next)
        }
        next(null, 3000000)
      },
      function queryValue (gasLimit, next) {
        if (args.value) {
          return next(null, args.value, gasLimit)
        }
        if (args.useCall || !self.transactionContextAPI.getValue) {
          return next(null, 0, gasLimit)
        }
        self.transactionContextAPI.getValue(function (err, value) {
          next(err, value, gasLimit)
        })
      },
      function getAccount (value, gasLimit, next) {
        if (args.from) {
          return next(null, args.from, value, gasLimit)
        }
        if (self.transactionContextAPI.getAddress) {
          return self.transactionContextAPI.getAddress(function (err, address) {
            next(err, address, value, gasLimit)
          })
        }
        self.getAccounts(function (err, accounts) {
          let address = accounts[0]

          if (err) return next(err)
          if (!address) return next('No accounts available')
          next(null, address, value, gasLimit)
        })
      },
      function runTransaction (fromAddress, value, gasLimit, next) {
        var tx = { to: args.to, data: args.data.dataHex, useCall: args.useCall, from: fromAddress, value: value, gasLimit: gasLimit, timestamp: args.data.timestamp }
        var payLoad = { funAbi: args.data.funAbi, funArgs: args.data.funArgs, contractBytecode: args.data.contractBytecode, contractName: args.data.contractName, contractABI: args.data.contractABI, linkReferences: args.data.linkReferences }
        var timestamp = Date.now()
        if (tx.timestamp) {
          timestamp = tx.timestamp
        }

        self.event.trigger('initiatingTransaction', [timestamp, tx, payLoad])
        self.txRunner.rawRun(tx, confirmationCb, continueCb, promptCb,
          function (error, result) {
            let eventName = (tx.useCall ? 'callExecuted' : 'transactionExecuted')
            self.event.trigger(eventName, [error, tx.from, tx.to, tx.data, tx.useCall, result, timestamp, payLoad])

            if (error && (typeof (error) !== 'string')) {
              if (error.message) error = error.message
              else {
                try { error = 'error: ' + JSON.stringify(error) } catch (e) {}
              }
            }
            next(error, result)
          }
        )
      }
    ], cb)
  }
}
