console.log("%cNYQUISTT HELPERS ESMODULES]: reading the main file.","font-weight: bold;color:green");

/**
 * creating module configs
 */

/*
* importing the modules
*/
import * as nyqLogging from './logging.js';
import * as apiUtils from './apiUtils.js';
import { nyqTables } from './nyqTables.js';
import { nyqSequencer } from './nyqSequencer.js'
import * as fileUtils from './fileUtils.js'
import { getApiParameters, nyqModPath, setVersion } from './nyqGeneralConfig.js'
import * as generalUtils from './generalUtils.js'

Hooks.on("ready", async function() {
	/**
	 * checking the version
	 */
	const moduleManifest = await fileUtils.readJsonFile('module.json', nyqModPath)
	//console.log(moduleManifest)
	setVersion(moduleManifest.version)
	const { moduleId } = getApiParameters()
	nyqLogging.nyqLog(moduleId + " version: " + moduleManifest.version, "main", "alert")
	/**
	 * creating the api
	 */
	nyqLogging.enableLogging();
	apiUtils.addToApi('search',apiUtils.searchInApi)
	apiUtils.addToApi('dynamicModule',apiUtils.dynamicModule)
	apiUtils.addToApi('loadModule',apiUtils.loadModule)
	apiUtils.addToApi('toggleLogging',nyqLogging.toggleLogging);
	apiUtils.addToApi('toggleDebug', nyqLogging.toggleDebug)
	apiUtils.addToApi('debugOffForAll', nyqLogging.debugOffForAll)
	apiUtils.addToApi('nyqLog',nyqLogging.nyqLog)
	apiUtils.addToApi('nyqDebug',nyqLogging.nyqDebug)
	apiUtils.addToApi('nyqIsDebugging',nyqLogging.nyqIsDebugging)
	apiUtils.addToApi('getApiParameters', getApiParameters)
	apiUtils.addToApi('readListOfJsonFiles',fileUtils.readListOfJsonFiles)
	apiUtils.addToApi('generalUtils',generalUtils)
	apiUtils.addToApi('nyqTables', nyqTables);
	apiUtils.addToApi('nyqSequencer', nyqSequencer)
	nyqLogging.nyqLog("[NYQUISTT HELPERS]: module initialized.","main","alert");
});
