const yo = require('yo-yo')
const remixLib = require('remix-lib')
const EventManager = remixLib.EventManager
const css = require('../styles/run-tab-styles')
const copyToClipboard = require('../../ui/copy-to-clipboard')
const modalDialogCustom = require('../../ui/modal-dialog-custom')
const addTooltip = require('../../ui/tooltip')
const helper = require('../../../lib/helper.js')
const globalRegistry = require('../../../global/registry')

class SettingsUI {

  constructor (settings, networkModule) {
    this.settings = settings
    this.event = new EventManager()
    this._components = {}

    this.settings.event.register('connectToNetwork', (name, id) => {
      this.netUI.innerHTML = `${name} (${id || '-'}) network`
      this._clearAccountsAndAssets()
      this.updateNetwork()
      this.restartUpdatingInterval()
    })

    this.settings.event.register('transactionExecuted', (error, from, to, data, lookupOnly, txResult) => {
      if (error) return
      if (!lookupOnly) this.el.querySelector('#value').value = '0'
      this.updateAccountBalances()
    })
    this._components = {
      registry: globalRegistry,
      networkModule: networkModule
    }
    this._components.registry = globalRegistry
    this._deps = {
      config: this._components.registry.get('config').api
    }

    this.accountListCallId = 0
    this.loadedAccounts = {}
    this.loadAssetTypes = {}

    this.updatingInterval = null
  }

  render () {
    this.netUI = yo`<span class="${css.network} badge badge-secondary"></span>`

    var environmentEl = yo`
      <div class="${css.crow}">
        <div id="selectExEnv" class="${css.col1_1}">
          Environment
        </div>
        <div class=${css.environment}>
          <select id="selectExEnvOptions" class="form-control ${css.select}">
            <option id="injected-mode"
              title="Execution environment has been provided by Bridge or similar provider."
              value="injected" name="executionContext"> Echo Bridge
            </option>
            <option id="echojslib-mode"
              title="Execution environment connects to node at localhost (or via ыыы if available), transactions will be sent to the network and can cause loss of money or worse!
              If this page is served via https and you access your node via http, it might not work. In this case, try cloning the repository and serving it via http."
              value="echojslib" name="executionContext"> Echojslib Provider
            </option>
          </select>
          <a href="https://github.com/echoprotocol" target="_blank"><i class="${css.infoDeployAction} fas fa-info"></i></a>
        </div>
      </div>
    `
    const networkEl = yo`
    <div class="${css.crow}">
        <div class="${css.col1_1}">
        </div>
        <div class="${css.environment}">
          ${this.netUI}
        </div>
      </div>
    `
    const accountEl = yo`
      <div class="${css.crow}">
        <div class="${css.col1_1}">
          Account
        </div>
        <div class=${css.account}>
          <select name="txorigin" class="form-control ${css.select}" id="txorigin" onchange=${() => {
            this.fillAccountsList()
          }}></select>
          ${copyToClipboard(() => document.querySelector('#runTabView #txorigin').value)}
        </div>
      </div>
    `
    // <i id="remixRunSignMsg" class="fas fa-edit ${css.icon}" aria-hidden="true" onclick=${this.signMessage.bind(this)} title="Sign a message using this account key"></i>
    const assetEl = yo`
      <div class="${css.crow}">
        <div class="${css.col1_1}">
          Asset
        </div>
        <div class=${css.asset}>
          <select name="assets" class="form-control ${css.select}" id="assets" ></select>
        </div>
      </div>
    `

    const valueEl = yo`
      <div class="${css.crow}">
        <div class="${css.col1_1}">Value</div>
        <div class="${css.gasValueContainer}">
          <input type="text" class="form-control ${css.gasNval} ${css.col2}" id="value" value="0" title="Enter the value and choose the unit">
        </div>
      </d
    `

    const el = yo`
      <div class="${css.settings}">
        ${environmentEl}
        ${networkEl}
        ${accountEl}
        ${assetEl}
        ${valueEl}
      </div>
    `
    var selectExEnv = environmentEl.querySelector('#selectExEnvOptions')
    this.setDropdown(selectExEnv)

    this.settings.event.register('contextChanged', (context, silent) => {
      this.setFinalContext()
    })

    this.restartUpdatingInterval()

    this.el = el

    return el
  }

  restartUpdatingInterval () {
    if (this.updatingInterval) {
      clearInterval(this.updatingInterval)
    }

    this.updatingInterval = setInterval(() => {
      this.updateNetwork()
    }, 10000)
  }

  setDropdown (selectExEnv) {
    this.selectExEnv = selectExEnv

    this.settings.event.register('addProvider', (network) => {
      selectExEnv.appendChild(yo`<option
        title="Manually added environment: ${network.url}"
        value="${network.name}"
        name="executionContext"
      >
        ${network.name}
      </option>`)
      addTooltip(`${network.name} [${network.url}] added`)
    })

    this.settings.event.register('removeProvider', (name) => {
      var env = selectExEnv.querySelector(`option[value="${name}"]`)
      if (env) {
        selectExEnv.removeChild(env)
        addTooltip(`${name} removed`)
      }
    })

    selectExEnv.addEventListener('change', (event) => {
      let context = selectExEnv.options[selectExEnv.selectedIndex].value
      this.settings.changeExecutionContext(context, () => {
        modalDialogCustom.confirm('External node request', 'Are you sure you want to connect to an echo node?', () => {
          modalDialogCustom.prompt('External node request', 'Echo Provider Endpoint', 'wss://devnet.echo-dev.io/ws', (target) => {
            this.settings.setProviderFromEndpoint(target, context, (alertMsg) => {
              if (alertMsg) {
                modalDialogCustom.alert(alertMsg)
              }
            }, this.setFinalContext.bind(this))
          }, this.setFinalContext.bind(this))
        }, this.setFinalContext.bind(this))
      }, (alertMsg) => {
        modalDialogCustom.alert(alertMsg)
      }, this.setFinalContext.bind(this))
    })

    selectExEnv.value = this.settings.getProvider()
  }

  setWifInput () {
    const settings = document.querySelector(`.${css.settings}`)
    const toInsertAfterNode = settings.childNodes[1]

    const wifInput = yo`
      <div class="${css.crow}" id="wifBlock">
        <div class="${css.col1_1}">
          WIF
        </div>
        <div class=${css.wif}>
          <input type="text" oninput=${() => { this.getInfoByWif() }} class="form-control ${css.wifInput} ${css.col2}" id="wifInput" title="Enter the value and choose the unit">
        </div>
      </div>
    `
    settings.insertBefore(wifInput, toInsertAfterNode.nextSibling)
  }

  removeWifInput () {
    const settings = document.querySelector(`.${css.settings}`)
    const nodeToDelete = document.querySelector('#wifBlock')

    if (nodeToDelete) {
      settings.removeChild(nodeToDelete)
    }
  }

  setFinalContext () {
    // set the final context. Cause it is possible that this is not the one we've originaly selected
    const provider = this.settings.getProvider()

    if (!this.settings.isExternalEchoConnected() || provider !== 'echojslib') {
      this.removeWifInput()
    } else if (!document.querySelector('#wifBlock')) {
      this.setWifInput()
    }

    this.selectExEnv.value = provider
    this.event.trigger('clearInstance', [])
  }

  signMessage () {
    this.settings.getAccounts((err, accounts) => {
      if (err) {
        return addTooltip(`Cannot get account list: ${err}`)
      }

      var signMessageDialog = { 'title': 'Sign a message', 'text': 'Enter a message to sign', 'inputvalue': 'Message to sign' }
      var $txOrigin = this.el.querySelector('#txorigin')
      if (!$txOrigin.selectedOptions[0] && (this.settings.isInjectedEchojslib() || this.settings.isEchojslibProvider())) {
        return addTooltip(`Account list is empty, please make sure the current provider is properly connected to remix`)
      }

      var account = $txOrigin.selectedOptions[0].value

      var promptCb = (passphrase) => {
        modalDialogCustom.promptMulti(signMessageDialog, (message) => {
          this.settings.signMessage(message, account, passphrase, (err, msgHash, signedData) => {
            if (err) {
              return addTooltip(err)
            }
            modalDialogCustom.alert(yo`
              <div>
                <b>hash:</b><br>
                <span id="remixRunSignMsgHash">${msgHash}</span>
                <br><b>signature:</b><br>
                <span id="remixRunSignMsgSignature">${signedData}</span>
              </div>
            `)
          })
        }, false)
      }

      if (this.settings.isEchojslibProvider()) {
        return modalDialogCustom.promptPassphrase(
          'Passphrase to sign a message',
          'Enter your passphrase for this account to sign the message',
          '',
          promptCb,
          false
        )
      }
      promptCb()
    })
  }

  updateNetwork () {
    if (this.settings.isInjectedEchojslib()) {
      this.fillAccountsList()
    } else {
      this.updateAccountBalances()
    }
  }

  async getInfoByWif () {
    try {
      const txOrigin = this.el.querySelector('#txorigin')

      this._clearAccountsAndAssets()

      const wifInput = document.querySelector('#wifInput')
      const wif = wifInput.value
      const isValidWif = this.settings.validateWif(wif)

      if (isValidWif) {
        const info = await this.settings.getInfoByWif(wif)

        txOrigin.appendChild(yo`<option value="${info[0][0]}" >${info[0][0]}</option>`)
        this.updateAccountBalances()
      }
    } catch (error) {
      console.warn(error)
    }
  }

  // TODO: unclear what's the goal of accountListCallId, feels like it can be simplified
  fillAccountsList () {
    if (!this.el) return
    this.accountListCallId++
    let callid = this.accountListCallId
    let txOrigin = this.el.querySelector('#txorigin')
    this.settings.getAccounts((err, accounts) => {
      if (this.accountListCallId > callid || !accounts.length) return
      this.accountListCallId++
      if (err) { addTooltip(`Cannot get account list: ${err}`) }
      for (let loadedaddress in this.loadedAccounts) {
        if (accounts.findIndex((account) => account.id === loadedaddress) === -1) {
          const rmElement = txOrigin.querySelector('option[value="' + loadedaddress + '"]')
          if (rmElement) {
            txOrigin.removeChild(rmElement)
          }
          delete this.loadedAccounts[loadedaddress]
        }
      }
      for (let i in accounts) {
        let {id, name} = accounts[i]
        if (!this.loadedAccounts[id]) {
          txOrigin.appendChild(yo`<option value="${id}" >${id} ${name ? `(${name})` : null}</option>`)
          this.loadedAccounts[id] = 1
        }
      }
      txOrigin.setAttribute('value', accounts[0].id)
      this.updateAccountBalances()
    })
  }

  updateAccountBalances () {
    if (!this.el) return
    let accountEl = this.el.querySelector('#txorigin')
    if (accountEl.selectedIndex === -1) return
    let assetsEl = this.el.querySelector('#assets')
    assetsEl.innerHTML = ''

    let accountId = accountEl.options[accountEl.selectedIndex].value
    this.settings.getAccountBalances(accountId, (err, results) => {
      if (err) {
        console.warn(err)
        return
      }

      for (let loadAssetType in this.loadAssetTypes) {
        if (!results.find(({assetType}) => assetType === loadAssetType)) {
          assetsEl.removeChild(assetsEl.querySelector('option[value="' + loadAssetType + '"]'))
          delete this.loadedAccounts[loadAssetType]
        }
      }

      results.forEach((element) => {
        const { amount, assetType, precision, symbol } = element
        const value = `${assetType} (${helper.coinBalanceNormalizer(amount, precision)} ${symbol} )`
        if (!this.loadedAccounts[assetType]) {
          assetsEl.appendChild(yo`<option value="${element.assetType}">${value}</option>`)
          this.loadAssetTypes[assetType] = 1
        } else {
          assetsEl.querySelector('option[value="' + assetType + '"]').innerHTML = value
        }
      })
    })
  }

  _clearAccountsAndAssets () {
    let accountEl = this.el.querySelector('#txorigin')
    let assetsEl = this.el.querySelector('#assets')
    accountEl.innerHTML = ''
    assetsEl.innerHTML = ''
    this.loadedAccounts = {}
    this.loadAssetTypes = {}
  }

}

module.exports = SettingsUI
