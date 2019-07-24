'use strict'
var yo = require('yo-yo')
var copyToClipboard = require('./copy-to-clipboard')

// -------------- styling ----------------------
var csjs = require('csjs-inject')
var remixLib = require('remix-lib')

var EventManager = require('../../lib/events')
var helper = require('../../lib/helper')
var executionContext = require('../../execution-context')
var modalDialog = require('./modal-dialog-custom')
var typeConversion = remixLib.execution.typeConversion
var globlalRegistry = require('../../global/registry')

var css = csjs`
  .log {
    display: flex;
    cursor: pointer;
    align-items: center;
    cursor: pointer;
  }
  .log:hover {
    opacity: 0.8;
  }
  .arrow {
    color: var(--text-info);
    font-size: 20px;
    cursor: pointer;
    display: flex;
    margin-left: 10px;
  }
  .arrow:hover {
    color: var(--secondary);
  }
  .txLog {
  }
  .txStatus {
    display: flex;
    font-size: 20px;
    margin-right: 20px;
    float: left;
  }
  .succeeded {
    color: var(--success);
  }
  .failed {
    color: var(--danger);
  }
  .notavailable {
  }
  .call {
    font-size: 7px;
    border-radius: 50%;
    min-width: 20px;
    min-height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--text-info);
    text-transform: uppercase;
    font-weight: bold;
  }
  .txItem {
    color: var(--text-info);
    margin-right: 5px;
    float: left;
  }
  .txItemTitle {
    font-weight: bold;
  }
  .tx {
    color: var(--text-info);
    font-weight: bold;
    float: left;
    margin-right: 10px;
  }
  .txTable,
  .tr,
  .td {
    border-collapse: collapse;
    font-size: 10px;
    color: var(--text-info);
    border: 1px solid var(--text-info);
  }
  #txTable {
    margin-top: 1%;
    margin-bottom: 5%;
    align-self: center;
    width: 85%;
  }
  .tr, .td {
    padding: 4px;
    vertical-align: baseline;
  }
  .td:first-child {
    min-width: 30%;
    width: 30%;
    align-items: baseline;
    font-weight: bold;
  }
  .tableTitle {
    width: 25%;
  }
  .buttons {
    display: flex;
    margin-left: auto;
  }
  .debug {
    white-space: nowrap;
  }
  .debug:hover {
    opacity: 0.8;
  }`
/**
  * This just export a function that register to `newTransaction` and forward them to the logger.
  *
  */
class TxLogger {
  constructor(eventsDecoder, txListener, terminal) {
    this.event = new EventManager()
    this.seen = {}
    function filterTx(value, query) {
      if (value.length) {
        return helper.find(value, query)
      }
      return false
    }
    this.eventsDecoder = eventsDecoder
    this.txListener = txListener
    this.terminal = terminal
    // dependencies
    this._deps = {
      compilersArtefacts: globlalRegistry.get('compilersartefacts').api
    }

    this.logKnownTX = this.terminal.registerCommand('knownTransaction', (args, cmds, append) => {
      console.log('logKnownTX')
      var data = args[0]
      var el
      if (data.tx.isCall) {
        el = renderCall(this, data)
      } else {
        el = renderKnownTransaction(this, data)
      }
      this.seen[data.tx.hash] = el
      append(el)
    }, { activate: true, filterFn: filterTx })

    this.logUnknownTX = this.terminal.registerCommand('unknownTransaction', (args, cmds, append) => {
      // triggered for transaction AND call
      var data = args[0]
      var el = renderUnknownTransaction(this, data)
      append(el)
    }, { activate: false, filterFn: filterTx })

    this.logEmptyBlock = this.terminal.registerCommand('emptyBlock', (args, cmds, append) => {
      var data = args[0]
      var el = renderEmptyBlock(this, data)
      append(el)
    }, { activate: true })

    this.txListener.event.register('newBlock', (block) => {
      if (!block.transactions || block.transactions && !block.transactions.length) {
        this.logEmptyBlock({ block: block })
      }
    })

    this.txListener.event.register('newTransaction', (tx, receipt) => {
      log(this, tx, receipt)
    })

    this.txListener.event.register('newCall', (tx) => {
      console.log('emit newCall')
      log(this, tx, null)
    })

    this.terminal.updateJournal({ type: 'select', value: 'unknownTransaction' })
    this.terminal.updateJournal({ type: 'select', value: 'knownTransaction' })
  }
}

function debug(e, data, self) {
  e.stopPropagation()
  if (data.tx.isCall && data.tx.envMode !== 'vm') {
    modalDialog.alert('Cannot debug this call. Debugging calls is only possible in JavaScript VM mode.')
  } else {
    self.event.trigger('debuggingRequested', [data.tx.hash])
  }
}

function log(self, tx, receipt) {
  var resolvedTransaction = self.txListener.resolvedTransaction(tx.id)
  console.log('LOG, tx:')
  console.log(tx)
  console.log(1231231231231)
  if (resolvedTransaction) {
    // var compiledContracts = null
    // if (self._deps.compilersArtefacts['__last']) {
    //   compiledContracts = self._deps.compilersArtefacts['__last'].getContracts()
    // }
    // self.eventsDecoder.parseLogs(tx, resolvedTransaction.contractName, compiledContracts, (error, logs) => {
    //   if (!error) {
    self.logKnownTX({ tx: tx, receipt: receipt, resolvedData: resolvedTransaction })
    //   }
    // })
  } else {
    // contract unknown - just displaying raw tx.
    self.logUnknownTX({ tx: tx, receipt: receipt })
  }
}

function renderKnownTransaction(self, data) {
  console.log('renderKnownTransaction renderKnownTransaction renderKnownTransactions')
  console.log(data)
  var from = data.tx.trx.operations[0][1].registrar
  console.log('wdwedwedwedew')
  console.log(data.resolvedData.contractAddress)
  var to = `1.14.${parseInt(data.resolvedData.contractAddress.slice(2), 16)}`
  var contractName = data.resolvedData.contractName + '.' + data.resolvedData.fn
  var obj = {from, to, contractName}
  var txType = 'knownTx'
  var tx = yo`
    <span id="tx${data.tx.id}">
      <div class="${css.log}" onclick=${e => txDetails(e, tx, data, obj)}>
        ${checkTxStatus(data.receipt, txType)}
        ${context(self, {contractName, from, to, data})}
        <div style="display: none;" class=${css.buttons}>
          <button class="${css.debug} btn btn-primary btn-sm" onclick=${(e) => debug(e, data, self)}>Debug</div>
        </div>
        <i class="${css.arrow} fas fa-angle-down"></i>
      </div>
    </span>
  `
  return tx
}

function renderCall(self, data) {
  console.log('renderCall')
  console.log(data)
  var to = data.tx.to
  var from = data.tx.from ? data.tx.from : ' - '
  var input = data.tx.input ? helper.shortenHexData(data.tx.input) : ''
  var obj = {from, to}
  var txType = 'call'
  var tx = yo`
    <span id="tx${data.tx.id}">
      <div class="${css.log}" onclick=${e => callTxDetails(e, tx, data, obj)}>
        ${checkTxStatus(data.tx, txType)}
        <span class=${css.txLog}>
          <span class=${css.tx}>[call]</span>
          <div class=${css.txItem}><span class=${css.txItemTitle}>from:</span> ${from}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>to:</span> ${to}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>data:</span> ${input}</div>
        </span>
        <div style="display: none;" class=${css.buttons}>
          <div class="${css.debug} btn btn-primary btn-sm" onclick=${(e) => debug(e, data, self)}>Debug</div>
        </div>
        <i class="${css.arrow} fas fa-angle-down"></i>
      </div>
    </span>
  `
  return tx
}

function renderUnknownTransaction(self, data) {
  var from = data.tx.from
  var to = data.tx.to
  var obj = {from, to}
  var txType = 'unknown' + (data.tx.isCall ? 'Call' : 'Tx')
  var tx = yo`
    <span id="tx${data.tx.hash}">
      <div class="${css.log}" onclick=${e => txDetails(e, tx, data, obj)}>
        ${checkTxStatus(data.receipt || data.tx, txType)}
        ${context(self, {from, to, data})}
        <div style="display: none;" class=${css.buttons}>
          <div class="${css.debug} btn btn-primary btn-sm" onclick=${(e) => debug(e, data, self)}>Debug</div>
        </div>
        <i class="${css.arrow} fas fa-angle-down"></i>
      </div>
    </span>
  `
  return tx
}

function renderEmptyBlock(self, data) {
  return yo`
    <span class=${css.txLog}>
      <span class='${css.tx}'><div class=${css.txItem}>[<span class=${css.txItemTitle}>block:${data.block.number} - </span> 0 transactions]</span></span>
    </span>`
}

function checkTxStatus(tx, type) {
  // if (tx.status === '0x1') {
  //   return yo`<i class="${css.txStatus} ${css.succeeded} fas fa-check-circle"></i>`
  // }
  // if (type === 'call' || type === 'unknownCall') {
  //   return yo`<i class="${css.txStatus} ${css.call}">call</i>`
  // } else if (tx.status === '0x0') {
  //   return yo`<i class="${css.txStatus} ${css.failed} fas fa-times-circle"></i>`
  // } else {
  //   return yo`<i class="${css.txStatus} ${css.notavailable} fas fa-circle-thin" title='Status not available' ></i>`
  // }

  return yo`<i class="${css.txStatus} ${css.succeeded} fas fa-check-circle"></i>`
}

function context(self, opts) {
  console.log('CONTEXT')
  console.log(opts)
  var data = opts.data || ''
  var from = opts.from ? opts.from : ''
  var to = opts.to
  var contractName = opts.contractName
  if (data.tx.to) to = to + ' ' + helper.shortenHexData(data.tx.to)
  var val = data.tx.trx.operations[0][1].value.amount
  var hash = data.tx.id ? helper.shortenHexData(data.tx.id) : ''
  var input = data.tx.input ? helper.shortenHexData(data.tx.input) : ''
  // var logs = data.logs && data.logs.decoded && data.logs.decoded.length ? data.logs.decoded.length : 0
  var logs = data.resolvedData.logs
  var block = data.tx.block_num || ''
  var i = data.tx.id
  var value = val ? typeConversion.toInt(val) : 0
  if (executionContext.getProvider() === 'vm') {
    return yo`
      <div>
        <span class=${css.txLog}>
          <span class=${css.tx}>[vm]</span>
          <div class=${css.txItem}><span class=${css.txItemTitle}>from:</span> ${from}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>to:</span> ${to}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>value:</span> ${value} wei</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>data:</span> ${input}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>logs:</span> ${logs}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>hash:</span> ${hash}</div>
        </span>
      </div>`
  } else if (executionContext.getProvider() !== 'vm' && data.resolvedData) {
    return yo`
      <div>
        <span class=${css.txLog}>
          <span class='${css.tx}'>[block:${block} txId:${i}]</span>
          <div class=${css.txItem}><span class=${css.txItemTitle}>contract:</span> ${contractName}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>from:</span> ${from}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>to:</span> ${to}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>value:</span> ${value}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>logs:</span> ${logs}</div>
        </span>
      </div>`
  } else {
    to = helper.shortenHexData(to)
    hash = helper.shortenHexData(data.tx.blockHash)
    return yo`
      <div>
        <span class=${css.txLog}>
          <span class='${css.tx}'>[block:${block} txIndex:${i}]</span>
          <div class=${css.txItem}><span class=${css.txItemTitle}>from:</span> ${from}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>to:</span> ${to}</div>
          <div class=${css.txItem}><span class=${css.txItemTitle}>value:</span> ${value} wei</div>
        </span>
      </div>`
  }
}

module.exports = TxLogger

// helpers

function txDetails(e, tx, data, obj) {
  console.log(`txDetails tx.id: ${tx.id}`)
  var table = document.querySelector(`#${tx.id} [class^="txTable"]`)
  var from = obj.from
  var contractName = obj.contractName
  var log = document.querySelector(`#${tx.id} [class^='log']`)
  var arrow = document.querySelector(`#${tx.id} [class^='arrow']`)
  var arrowUp = yo`<i class="${css.arrow} fas fa-angle-up"></i>`
  var arrowDown = yo`<i class="${css.arrow} fas fa-angle-down"></i>`
  if (table && table.parentNode) {
    tx.removeChild(table)
    log.removeChild(arrow)
    log.appendChild(arrowDown)
  } else {
    log.removeChild(arrow)
    log.appendChild(arrowUp)

    table = createTable({
      contract: contractName,
      txId: data.tx.id,
      status: data.resolvedData ? data.resolvedData.status : null,
      isCall: data.tx.isCall,
      contractAddress: data.resolvedData.address,
      contractId: `1.14.${parseInt(data.resolvedData.contractAddress.slice(2), 16)}`,
      data: data.tx,
      from,
      to: `1.14.${parseInt(data.resolvedData.contractAddress.slice(2), 16)}`,
      gasUsed: data.resolvedData.gasUsed,
      input: data.tx.input,
      'decoded input': data.resolvedData && data.resolvedData.params ? JSON.stringify(typeConversion.stringify(data.resolvedData.params), null, '\t') : ' - ',
      'decoded output': data.tx ? JSON.stringify(typeConversion.stringify(data.tx), null, '\t') : ' - ',
      'contract result': data.resolvedData && data.resolvedData.contractResult && data.resolvedData.contractResult ? JSON.stringify(typeConversion.stringify(data.resolvedData.contractResult), null, '\t') : ' - ',
      logs: data.logs,
      val: data.tx.trx.operations[0][1].value.amount
    })

    tx.appendChild(table)
  }
}

function callTxDetails(e, tx, data, obj) {
  console.log(`txDetails tx.id: ${tx.id}`)
  console.log(tx)
  console.log(data)
  var table = document.querySelector(`#${tx.id} [class^="txTable"]`)
  var from = obj.from
  var contractName = obj.contractName
  var log = document.querySelector(`#${tx.id} [class^='log']`)
  var arrow = document.querySelector(`#${tx.id} [class^='arrow']`)
  var arrowUp = yo`<i class="${css.arrow} fas fa-angle-up"></i>`
  var arrowDown = yo`<i class="${css.arrow} fas fa-angle-down"></i>`
  if (table && table.parentNode) {
    tx.removeChild(table)
    log.removeChild(arrow)
    log.appendChild(arrowDown)
  } else {
    log.removeChild(arrow)
    log.appendChild(arrowUp)

    table = createTable({
      contract: contractName,
      txId: data.tx.id,
      status: data.resolvedData ? data.resolvedData.status : null,
      isCall: data.tx.isCall,
      contractAddress: data.resolvedData.address,
      contractId: `1.14.${parseInt(data.resolvedData.contractAddress.slice(2), 16)}`,
      data: data.tx,
      from,
      to: `1.14.${parseInt(data.resolvedData.contractAddress.slice(2), 16)}`,
      input: data.tx.input,
      'decoded output': data.tx ? JSON.stringify(typeConversion.stringify(data.tx), null, '\t') : ' - '
    })

    tx.appendChild(table)
  }
}

function createTable(opts) {
  var table = yo`<table class="${css.txTable}" id="txTable"></table>`
  if (!opts.isCall) {
    var msg = ''
    if (opts.status) {
      if (opts.status === '0x0') {
        msg = ' Transaction mined but execution failed'
      } else if (opts.status === '0x1') {
        msg = ' Transaction mined and execution succeed'
      }
    } else {
      msg = ' Status not available at the moment'
    }
    table.appendChild(yo`
      <tr class="${css.tr}">
        <td class="${css.td}"> contract </td>
        <td class="${css.td}">${opts.contract}${msg}</td>
      </tr>`)
    table.appendChild(yo`
      <tr class="${css.tr}">
        <td class="${css.td}"> status </td>
        <td class="${css.td}">${opts.status}${msg}</td>
      </tr>`)
  }

  var transactionId = yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> transaction id </td>
      <td class="${css.td}">${opts.txId}
        ${copyToClipboard(() => opts.txId)}
      </td>
    </tr>
  `
  table.appendChild(transactionId)

  var contractId = yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> contract id </td>
      <td class="${css.td}">${opts.contractId}
        ${copyToClipboard(() => opts.contractId)}
      </td>
    </tr>
  `
  if (opts.contractId) table.appendChild(contractId)

  var from = yo`
    <tr class="${css.tr}">
      <td class="${css.td} ${css.tableTitle}"> from </td>
      <td class="${css.td}">${opts.from}
        ${copyToClipboard(() => opts.from)}
      </td>
    </tr>
  `
  if (opts.from) table.appendChild(from)

  var toHash
  var data = opts.data  // opts.data = data.tx
  if (data.to) {
    toHash = data.to
  } else {
    toHash = opts.to
  }
  var to = yo`
    <tr class="${css.tr}">
    <td class="${css.td}"> to </td>
    <td class="${css.td}">${toHash}
      ${copyToClipboard(() => data.to ? data.to : toHash)}
    </td>
    </tr>
  `
  if (opts.to) table.appendChild(to)

  var gasUsed = yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> gas used </td>
      <td class="${css.td}">${opts.gasUsed}
        ${copyToClipboard(() => opts.gasUsed)}
      </td>
    </tr>
  `
  if (opts.gasUsed) table.appendChild(gasUsed)

  var gas = yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> gas </td>
      <td class="${css.td}">${opts.gas} gas
        ${copyToClipboard(() => opts.gas)}
      </td>
    </tr>
  `
  if (opts.gas) table.appendChild(gas)

  var callWarning = ''
  if (opts.isCall) {
    callWarning = '(Cost only applies when called by a contract)'
  }
  if (opts.transactionCost) {
    table.appendChild(yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> transaction cost </td>
      <td class="${css.td}">${opts.transactionCost} gas ${callWarning}
        ${copyToClipboard(() => opts.transactionCost)}
      </td>
    </tr>`)
  }

  if (opts.executionCost) {
    table.appendChild(yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> execution cost </td>
      <td class="${css.td}">${opts.executionCost} gas ${callWarning}
        ${copyToClipboard(() => opts.executionCost)}
      </td>
    </tr>`)
  }

  var hash = yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> hash </td>
      <td class="${css.td}">${opts.hash}
        ${copyToClipboard(() => opts.hash)}
      </td>
    </tr>
  `
  if (opts.hash) table.appendChild(hash)

  var input = yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> input </td>
      <td class="${css.td}">${helper.shortenHexData(opts.input)}
        ${copyToClipboard(() => opts.input)}
      </td>
    </tr>
  `
  if (opts.input) table.appendChild(input)

  if (opts['decoded input']) {
    var inputDecoded = yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> decoded input </td>
      <td class="${css.td}">${opts['decoded input']}
        ${copyToClipboard(() => opts['decoded input'])}
      </td>
    </tr>`
    table.appendChild(inputDecoded)
  }

  if (opts['decoded output']) {
    var outputDecoded = yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> output </td>
      <td class="${css.td}" id="decodedoutput" >${opts['decoded output']}
        ${copyToClipboard(() => opts['decoded output'])}
      </td>
    </tr>`
    table.appendChild(outputDecoded)
  }

  if (opts['contract result']) {
    var contractResult = yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> contract result </td>
      <td class="${css.td}" id="decodedoutput" >${opts['contract result']}
        ${copyToClipboard(() => opts['contract result'])}
      </td>
    </tr>`
    table.appendChild(contractResult)
  }

  var stringified = ' - '
  if (opts.logs && opts.logs.decoded) {
    stringified = typeConversion.stringify(opts.logs.decoded)
  }
  var logs = yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> logs </td>
      <td class="${css.td}" id="logs">
        ${JSON.stringify(stringified, null, '\t')}
        ${copyToClipboard(() => JSON.stringify(stringified, null, '\t'))}
        ${copyToClipboard(() => JSON.stringify(opts.logs.raw || '0'))}
      </td>
    </tr>
  `
  if (opts.logs) table.appendChild(logs)

  var val = opts.val != null ? typeConversion.toInt(opts.val) : 0
  val = yo`
    <tr class="${css.tr}">
      <td class="${css.td}"> value </td>
      <td class="${css.td}">${val} wei
        ${copyToClipboard(() => `${val} wei`)}
      </td>
    </tr>
  `
  if (opts.val) table.appendChild(val)

  return table
}
