console.log("%cNYQUISTT HELPERS ESMODULES]: reading the main file.","font-weight: bold;color:green");

import * as nyqLogging from './logging.js';
import * as apiUtils from './apiUtils.js';
import { nyqTables } from './nyqTables.js';
//import {nyqFunctionEngine} from './nyqFunctionEngine.js'
import { nyqSequencer } from './nyqSequencer.js'
import * as fileUtils from './fileUtils.js'
import { getApiParameters } from './nyqGeneralConfig.js'
import * as generalUtils from './generalUtils.js'

Hooks.on("init", function() {
	nyqLogging.enableLogging();
	apiUtils.addToApi('search',apiUtils.searchInApi)
	apiUtils.addToApi('dynamicModule',apiUtils.dynamicModule)
	apiUtils.addToApi('toggleLogging',nyqLogging.toggleLogging);
	apiUtils.addToApi('toggleDebug', nyqLogging.toggleDebug)
	apiUtils.addToApi('nyqLog',nyqLogging.nyqLog)
	apiUtils.addToApi('nyqIsDebugging',nyqLogging.nyqIsDebugging)
	apiUtils.addToApi('getApiParameters', getApiParameters)
	apiUtils.addToApi('readListOfJsonFiles',fileUtils.readListOfJsonFiles)
	apiUtils.addToApi('generalUtils',generalUtils)
	apiUtils.addToApi('nyqTables', nyqTables);
	//apiUtils.addToApi('nyqFunctionEngine', nyqFunctionEngine);
	apiUtils.addToApi('nyqSequencer', nyqSequencer)
	nyqLogging.nyqLog("[NYQUISTT HELPERS]: module initialized.","warn");
});
