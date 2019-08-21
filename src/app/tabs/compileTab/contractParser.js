'use strict'

var solcTranslate = require('solc/translate')
var remixLib = require('remix-lib')
var txHelper = remixLib.execution.txHelper

module.exports = (contractName, contract, compiledSource) => {
  return getDetails(contractName, contract, compiledSource)
}

var getDetails = function (contractName, contract, source) {
  var detail = {}
  detail.name = contractName
  detail.metadata = contract.metadata
  if (contract.evm.bytecode.object) {
    detail.bytecode = contract.evm.bytecode.object
  }

  detail.abi = contract.abi

  detail.functionHashes = {}
  for (var fun in contract.evm.methodIdentifiers) {
    detail.functionHashes[contract.evm.methodIdentifiers[fun]] = fun
  }

  if (contract.evm.bytecode.object) {
    detail.bytecode = contract.evm.bytecode
    detail.echoJSDeploy = echoJSDeploy(contractName.toLowerCase(), contract.abi, contract.evm.bytecode.object)
    detail.echoJSContractDeploy = echoJSContractDeploy(contractName.toLowerCase(), contract.abi, contract.evm.bytecode.object)

    detail.metadataHash = retrieveMetadataHash(contract.evm.bytecode.object)
    if (detail.metadataHash) {
      detail.swarmLocation = 'bzzr://' + detail.metadataHash
    }
  }

  detail.devdoc = contract.devdoc
  detail.userdoc = contract.userdoc

  if (contract.evm.deployedBytecode && contract.evm.deployedBytecode.object.length > 0) {
    detail['Runtime Bytecode'] = contract.evm.deployedBytecode
  }

  if (source && contract.assembly !== null) {
    detail['Assembly'] = solcTranslate.prettyPrintLegacyAssemblyJSON(contract.evm.legacyAssembly, source.content)
  }

  return detail
}

var retrieveMetadataHash = function (bytecode) {
  var match = /a165627a7a72305820([0-9a-f]{64})0029$/.exec(bytecode)
  if (!match) {
    match = /a265627a7a72305820([0-9a-f]{64})6c6578706572696d656e74616cf50037$/.exec(bytecode)
  }
  if (match) {
    return match[1]
  }
}

var echoJSDeploy = function (contractName, jsonInterface, bytecode) {
  var code = ''
  code += 'import echo, { constants, PrivateKey } from \'echolib-js\';\n'
  code += '\n'
  code += '(async () => {\n'
  code += '\n'
  code += '    const privateKey = PrivateKey.fromWif(/* WIF key here */);\n'
  code += '\n'
  code += '    const contractCode = \'' + bytecode + '\';\n'
  code += '    const constructorCode = \'/* Constructor code here */\';\n'
  code += '\n'
  code += '    const operation = {' +
  '\n       fee: { // optional, default fee asset: 1.3.0, amount: will be calculated' +
  '\n           asset_id: \'1.3.0\'' +
  '\n       },' +
  '\n       registrar: \'1.2.20\',' +
  '\n       value: {' +
  '\n           asset_id: \'1.3.0\',' +
  '\n           amaunt: 1' +
  '\n       },' +
  '\n       code: contractCode + constructorCode,' +
  '\n       eth_accuracy: false' +
  '\n    };\n'
  code += '\n'
  code += '    await echo.connect(\'ws://127.0.0.1:9000\');\n'
  code += '\n'
  code += '    const result = await echo' +
  '\n             .createTransaction()' +
  '\n             .addOperation(constants.OPERATIONS_IDS.CONTRACT_CREATE, operation)' +
  '\n             .addSigner(privateKey)' +
  '\n             .broadcast();' +
  '\n' +
  '\n})();'

  return code
}

var echoJSContractDeploy = function (contractName, jsonInterface, bytecode) {
  var code = ''

  code += 'import echo, { PrivateKey } from \'echolib-js\';\n'
  code += 'import { Contract } from \'echojs-contract\';\n'
  code += '\n'

  code += '(async () => {\n'
  code += '\n'

  var funABI = txHelper.getConstructorInterface(jsonInterface)
  var args = []

  funABI.inputs.forEach(function (inp) {
    code += '    const ' + inp.name + ' = /* var of type ' + inp.type + ' here */;\n'
    args.push(inp.name)
  })

  code += '\n'
  code += '    const privateKey = PrivateKey.fromWif(/* WIF key here */);\n'
  code += '    const contractCode = \'' + bytecode + '\';\n'
  code += '    const abi = \'' + JSON.stringify(jsonInterface).replace('\n', '') + '\';\n'
  code += '\n'
  code += '    await echo.connect(\'ws://127.0.0.1:9000\');\n'
  code += '\n'
  code += '    const contract = await Contract.deploy(code, echo, privateKey, { abi, value: { amount: 0 }' + (args.length ? ', args: [' + args.join(', ') + ']' : '') + ' });'
  code += '\n'
  code += '\n})();'

  return code
}
