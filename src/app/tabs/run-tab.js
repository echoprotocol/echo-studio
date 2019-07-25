var $ = require('jquery')
var yo = require('yo-yo')
var EventManager = require('../../lib/events')
var Card = require('../ui/card')
var css = require('./styles/run-tab-styles')

var Settings = require('./runTab/model/settings.js')
var SettingsUI = require('./runTab/settings.js')

var DropdownLogic = require('./runTab/model/dropdownlogic.js')
var ContractDropdownUI = require('./runTab/contractDropdown.js')
var UniversalDAppUI = require('../ui/universal-dapp-ui')

var Recorder = require('./runTab/model/recorder.js')
var RecorderUI = require('./runTab/recorder.js')

const executionContext = require('../../execution-context')

import { ViewPlugin } from '@remixproject/engine'
import * as packageJson from '../../../package.json'

const profile = {
  name: 'run',
  displayName: 'Deploy & run transactions',
  methods: [],
  events: [],
  icon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAxNi4wLjAsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+DQo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzFfY29weSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4Ig0KCSB5PSIwcHgiIHdpZHRoPSI3NDIuNTQ1cHgiIGhlaWdodD0iNjc2Ljg4NnB4IiB2aWV3Qm94PSIwIC0wLjIwNCA3NDIuNTQ1IDY3Ni44ODYiDQoJIGVuYWJsZS1iYWNrZ3JvdW5kPSJuZXcgMCAtMC4yMDQgNzQyLjU0NSA2NzYuODg2IiB4bWw6c3BhY2U9InByZXNlcnZlIj4NCjxnPg0KCTxwb2x5Z29uIHN0cm9rZT0iI0ZGRkZGRiIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIiBwb2ludHM9IjI5NS45MTEsMC43MTEgNDg4LjkxMSwzMDQuMTg2IDQ4OC45MTEsMzk3LjE4MSAyOTMuOTExLDY3Ni41NTYgDQoJCTc0MS43ODYsMzQ5Ljk0MyAJIi8+DQoJPHBvbHlnb24gc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHBvaW50cz0iNDE3LjA4Myw0MDYuNTg5IDIwOS43OTEsNTE5LjQ5NCAxLjg0Niw0MDYuMjM0IDIwOS43OTEsNjc1Ljg2MyAJIi8+DQoJPHBvbHlnb24gc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHBvaW50cz0iNDE3LjA4MywzMTguNzA3IDIwOS43OTEsMC43MTEgMS44NDYsMzE4LjQyOCAyMDkuNzkxLDQzMS42ODkgCSIvPg0KPC9nPg0KPC9zdmc+DQo=',
  description: 'execute and save transactions',
  kind: 'run',
  location: 'sidePanel',
  documentation: 'https://remix-ide.readthedocs.io/en/latest/run.html',
  version: packageJson.version
}

class RunTab extends ViewPlugin {

  constructor (udapp, config, fileManager, editor, filePanel, compilersArtefacts, networkModule, mainView) {
    super(profile)
    this.event = new EventManager()
    this.config = config
    this.udapp = udapp
    this.fileManager = fileManager
    this.editor = editor
    this.logCallback = (msg) => { mainView.getTerminal().logHtml(msg) }
    this.filePanel = filePanel
    this.compilersArtefacts = compilersArtefacts
    this.networkModule = networkModule
  }

  onActivationInternal () {
    this.udappUI = new UniversalDAppUI(this.udapp, this.logCallback)
    this.udapp.resetAPI({
      getWifNode: (cb) => {
        try {
          cb(null, document.querySelector('#wifInput'))
        } catch (error) {
          return cb(error)
        }
      },
      getAddress: (cb) => {
        cb(null, $('#txorigin').val())
      },
      getValue: (cb) => {
        try {
          var number = document.querySelector('#value').value
          cb(null, number)
        } catch (e) {
          cb(e)
        }
      },
      getGasLimit: (cb) => {
        cb(null, $('#gasLimit').val())
      },
      getAmountAsset: (cb) => {
        const asset = $('#amountassets').val()
        if (!asset) {
          return cb('Amount asset is not found.')
        }
        cb(null, asset.split(' ')[0])
      },
      getFeeAsset: (cb) => {
        const asset = $('#feeassets').val()
        if (!asset) {
          return cb('Fee asset is not found.')
        }
        cb(null, asset.split(' ')[0])
      },
      getEthAccuracy: (cb) => {
        const asset = $('#ethAccuracy').is(':checked')
        cb(null, asset)
      }
    })
  }

  renderContainer () {
    this.container = yo`<div class="${css.runTabView} p-3" id="runTabView" ></div>`

    var el = yo`
    <div class="list-group list-group-flush">
      ${this.settingsUI.render()}
      ${this.contractDropdownUI.render()}      
      ${this.instanceContainer}
    </div>
    `
    this.container.appendChild(el)
    return this.container
  }

  renderInstanceContainer () {
    this.instanceContainer = yo`<div class="${css.instanceContainer}"></div>`

    const instanceContainerTitle = yo`
      <div class=${css.instanceContainerTitle}
        title="Autogenerated generic user interfaces for interaction with deployed contracts">
        Deployed Contracts
        <i class="${css.clearinstance} ${css.icon} far fa-trash-alt" onclick=${() => this.event.trigger('clearInstance', [])}
          title="Clear instances list and reset recorder" aria-hidden="true">
        </i>
      </div>`

    this.noInstancesText = yo`
      <div class="${css.noInstancesText}">
        Currently you have no contract instances to interact with.
      </div>`

    this.event.register('clearInstance', () => {
      this.instanceContainer.innerHTML = '' // clear the instances list
      this.instanceContainer.appendChild(instanceContainerTitle)
      this.instanceContainer.appendChild(this.noInstancesText)
    })

    this.instanceContainer.appendChild(instanceContainerTitle)
    this.instanceContainer.appendChild(this.noInstancesText)
  }

  renderSettings (udapp) {
    var settings = new Settings(udapp)
    this.settingsUI = new SettingsUI(settings, this.networkModule)

    this.settingsUI.event.register('clearInstance', () => {
      this.event.trigger('clearInstance', [])
    })
  }

  renderDropdown (udappUI, fileManager, compilersArtefacts, config, editor, udapp, filePanel, logCallback) {
    var dropdownLogic = new DropdownLogic(fileManager, compilersArtefacts, config, editor, udapp, filePanel, this)
    this.contractDropdownUI = new ContractDropdownUI(dropdownLogic, logCallback)

    this.contractDropdownUI.event.register('clearInstance', () => {
      var noInstancesText = this.noInstancesText
      if (noInstancesText.parentNode) { noInstancesText.parentNode.removeChild(noInstancesText) }
    })
    this.contractDropdownUI.event.register('newContractABIAdded', (abi, address) => {
      this.instanceContainer.appendChild(udappUI.renderInstanceFromABI(abi, address, address))
    })
    this.contractDropdownUI.event.register('newContractInstanceAdded', (contractObject, address, value, txId) => {
      this.instanceContainer.appendChild(udappUI.renderInstance(contractObject, address, value, txId))
    })
  }

  renderRecorder (udapp, udappUI, fileManager, config, logCallback) {
    this.recorderCount = yo`<span>0</span>`

    var recorder = new Recorder(udapp, fileManager, config)
    recorder.event.register('recorderCountChange', (count) => {
      this.recorderCount.innerText = count
    })
    this.event.register('clearInstance', recorder.clearAll.bind(recorder))

    this.recorderInterface = new RecorderUI(recorder, logCallback)

    this.recorderInterface.event.register('newScenario', (abi, address, contractName) => {
      var noInstancesText = this.noInstancesText
      if (noInstancesText.parentNode) { noInstancesText.parentNode.removeChild(noInstancesText) }
      this.instanceContainer.appendChild(udappUI.renderInstanceFromABI(abi, address, contractName))
    })

    this.recorderInterface.render()
  }

  renderRecorderCard () {
    const collapsedView = yo`
      <div class=${css.recorderCollapsedView}>
        <div class="${css.recorderCount} badge badge-pill badge-primary">${this.recorderCount}</div>
      </div>`

    const expandedView = yo`
      <div class=${css.recorderExpandedView}>
        <div class=${css.recorderDescription}>
          All transactions (deployed contracts and function executions) in this environment can be saved and replayed in
          another environment. e.g Transactions created in Javascript VM can be replayed in the Injected Web3.
        </div>
        <div class="${css.transactionActions}">
          ${this.recorderInterface.recordButton}
          ${this.recorderInterface.runButton}
          </div>
        </div>
      </div>`

    this.recorderCard = new Card({}, {}, { title: 'Transactions recorded:', collapsedView: collapsedView })
    this.recorderCard.event.register('expandCollapseCard', (arrow, body, status) => {
      body.innerHTML = ''
      status.innerHTML = ''
      if (arrow === 'down') {
        status.appendChild(collapsedView)
        body.appendChild(expandedView)
      } else if (arrow === 'up') {
        status.appendChild(collapsedView)
      }
    })
  }

  render () {
    this.onActivationInternal()
    executionContext.init(this.config)
    this.udapp.resetEnvironment()
    this.renderInstanceContainer()
    this.renderSettings(this.udapp)
    this.renderDropdown(this.udappUI, this.fileManager, this.compilersArtefacts, this.config, this.editor, this.udapp, this.filePanel, this.logCallback)
    this.renderRecorder(this.udapp, this.udappUI, this.fileManager, this.config, this.logCallback)
    this.renderRecorderCard()
    return this.renderContainer()
  }

}

module.exports = RunTab
