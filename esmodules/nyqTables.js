import * as nyqGeneralConfig from './nyqGeneralConfig.js';
import {nyqLog, nyqDebug, nyqIsDebugging} from './logging.js';
import * as fileUtils from './fileUtils.js'
import * as generalUtils from './generalUtils.js'
import { filterRepo } from './filterUtils.js';

const preStr = "[nyqTables] ";

class c_filter{
    #type = "filter"
    #required = []
    #operation = (...params) => {return params}
    #description = "no description"
    #valid = false
    get valid(){
        return this.#valid
    }
    constructor(type, required, operation, description = null){
        const allowedTypes = [
            {name: 'wholeArray', nParams: 2},
            {name: 'forOf', nParams: 2},
            {name: 'filter', nParams: 4},
            {name: 'reduce', nParams: 5},
        ]
        const reqType = allowedTypes.filter(
            (value, index, array) => {
                return value.name === type
            }
        )
        if(reqType.length === 0){
            this.#valid = false
            return
        }
        const expectedNparams = reqType[0].nParams
        if(typeof operation !== 'function'){
            this.#valid = false
            return
        }
        if(operation.length !== expectedNparams){
            this.#valid = false
            return
        }
        if(!Array.isArray(required)){
            this.#valid = false
            return
        }
        for(const eachRequired of required){
            if(typeof eachRequired !== 'string'){
                this.#valid = false
                return
            }
        }
        if(typeof description !== 'string'){
            this.#description = null
        }
        else{
            this.#description = description
        }
        this.#type = type
        this.#required = required
        this.#operation = operation
        this.#valid = true
    }
}

class c_filterSequence{}

class nyqTables{
    static #identityString = "nyqTables"
    static #debug(...inputList){
        nyqDebug(this.#identityString, ...inputList)
    }
    static #log(myString, type=null){ //only strings
        nyqLog(myString.toString(), this.#identityString, type)
    }
    static #debugReport(){
        //this.#debug("internal structure",this)
        this.#debug("tablesRoot:",this.#tablesRoot,"filterRepo:",this.#filterRepo,"readLibraries",this.#readLibraries)
    }
    static pleaseReport(){
        this.#debugReport()
    }
    static #tablesRoot = {};
    static #filterRepo = {};
    static #readLibraries = [];

    static {
        this.#addFilterRepoObject(filterRepo);
    }

    /****************************************************************
     * GENERAL UTILITIES
     ****************************************************************/

    static #addFilterRepoObject(filterRepoObject){
        for(const [key, value] of Object.entries(filterRepoObject)){
            this.#filterRepo[key] = value;
        }
    }

    static async #addTableToTree(fileName,filePath){
        const jsonPosiz = fileName.lastIndexOf(".json");
        if(jsonPosiz != fileName.length-5){
            this.#log("skipping non json file " + fileName,"error");
            return "error";
        }
        const myJson = await fileUtils.readJsonFile(fileName, filePath);
        if (!Object.keys(myJson).length) {
            this.#log("impossible to acquire file " + fileName,"error")
            return "error";
        }
        if((!myJson.tablePath)||(!myJson.name)||(!myJson.values)||(!myJson.variables)||(!myJson.valueList)){
            //console.log(myJson)
            this.#log("wrong formatting table in file " + fileName,"error")
            return "error"
        }
        const leafPath = myJson.tablePath + "." + fileUtils.cleanNames(myJson.name);
        let tableType = []
        if(myJson.tableType){
            if(Array.isArray(myJson.tableType)) tableType = myJson.tableType;
            else tableType = [myJson.tableType]
        }
        if(myJson.formula) {
            if(!tableType.includes("rolltable"))
                tableType.push("rolltable")
        }
        //console.log(tableType)
        const myObject = {fileName: myJson.fileName, filePath: myJson.filePath, tableType: tableType};
        generalUtils.createNestedObjectValue(this.#tablesRoot,leafPath,myObject)
        return "ok"
    }

    static async #readTableFromTree(keyString){
        const readJson = generalUtils.elaborateNestedObjectValue(this.#tablesRoot,keyString,
            async (nestedObject) => {
                if((nestedObject.fileName)&&(nestedObject.filePath)){
                    const alreadyCached = nestedObject.cache ? true : false;
                    const myJson = alreadyCached ? nestedObject.cache : await fileUtils.readJsonFile(nestedObject.fileName,nestedObject.filePath);
                    //console.log(myJson)
                    if(!alreadyCached) {
                        nestedObject.cache = myJson;
                        const timeOut = nyqGeneralConfig.nyqCacheTimeout;
                        this.#log("file will be fetched for " + timeOut + " milliseconds")
                        const clearFunction = function(){
                            nyqLog(preStr + "clearing cached file " + nestedObject.fileName)
                            this.cache = null;
                        }.bind(nestedObject)
                        setTimeout(clearFunction, timeOut);
                    }
                    return myJson;
                }
                else{
                    return {}
                }
            }
        )
        return await readJson;
    }

    /**
     * 
     * @param {*} tableName 
     * @param {*} operationDataArray = 
     * [
     *   {operation: "greaterThan", dataArray: [{dataValue: 3, keyString: 'xp.max'}]}
     * ]
     * @returns 
     */
    static async #operateTable(tableOrTableName, operationDataArray, stored = true){
        this.#debug("operating on a table")
        this.#debug("tableOrTableName",tableOrTableName, "operationDataArray", operationDataArray, "stored", stored)
        //console.log(operationDataArray)
        //console.log(this.#tablesRoot)
        const readTable = stored ? await this.#readTableFromTree(tableOrTableName) : tableOrTableName;
        //console.log(this.#tablesRoot)
        if(!Object.keys(readTable).length){
            this.#log("wrong table name provided","error")
            return null;
        }
        const tableVariables = Array.isArray(readTable.variables) ? readTable.variables : [readTable.variables]
        const tableValues = Array.isArray(readTable.values) ? readTable.values : [readTable.values]
        let tableValueList;
        if(Array.isArray(readTable.valueList)) tableValueList = readTable.valueList;
        else if((typeof readTable.valueList === 'string')||(readTable.valueList instanceof String)){
            if(readTable[readTable.valueList]) tableValueList = readTable[readTable.valueList];
            else tableValueList = [readTable.valueList]
        }
        else tableValueList = [readTable.valueList];
        this.#debug("starting the operationDataArray execution")
        for(var i = 0; i < operationDataArray.length; i++){
            const operationName = operationDataArray[i].operation;
            const singleOperationSequence = this.#filterRepo[operationName].operationSequence;
            const singleOperationData = operationDataArray[i].dataArray;
            if(singleOperationSequence.length !== singleOperationData.length){
                this.#log("wrong data for operation " + operationName,"error");
                this.#log(operationName + " requires " + singleOperationSequence.length + " data values","error")
                this.#log("the number of data values provided is " + singleOperationData.length,"error")
                return null;
            }
            this.#debug("step " + (i+1) + " of " + operationDataArray.length)
            this.#debug("operationName",operationName,"singleOperationSequence",singleOperationSequence,"singleOperationData",singleOperationData)
            for(var j = 0; j < singleOperationSequence.length; j++){
                this.#debug("sequence " + i + " step " + (j+1) + " of " + singleOperationSequence.length)
                this.#debug("tableValueList:",tableValueList)
                const singleOperationStep = singleOperationSequence[j];
                const isAsync = singleOperationStep.isAsync;
                let singleData = singleOperationData[j];
                singleData.tableVariables = tableVariables;
                singleData.tableValues = tableValues;
                let operationFunction;
                this.#debug("singleOperationStep",singleOperationStep,"isAsync",isAsync,"singleData",singleData)
                switch(singleOperationStep.type){
                    case "wholeArray":
                        operationFunction = singleOperationStep.operation;
                        tableValueList = isAsync ? await operationFunction(tableValueList,singleData) : operationFunction(tableValueList,singleData); // tableValueList is accessed by reference
                        break
                    case "forOf":
                        let newList = [];
                        operationFunction = singleOperationStep.operation;
                        for(const eachRow of tableValueList){
                            const newObj = isAsync ? await operationFunction(eachRow,singleData) : operationFunction(eachRow,singleData) // eachRow and hence tableValueList is accessed by reference
                            newList.push(newObj);
                        }
                        tableValueList = newList;
                        break;
                    case "filter":
                        //const keyString = singleData.keyString ? singleData.keyString : tableVariables[0];
                        //const dataValue = singleData.dataValue;
                        //if((!dataValue)||(!keyString)||(keyString === "none")||(keyString === "None")){
                        //    nyqLog(preStr + "cannot find the data value or the key string... abort");
                        //    return null;
                        //}
                        operationFunction = singleOperationStep.operation;
                        if(!isAsync){
                            tableValueList = tableValueList.filter( // tableValueList is unchanged
                                (value, index, array) => {
                                    const myResult = operationFunction(value, index, array, singleData)
                                    //console.log(myResult)
                                    return myResult
                                }
                            )
                        }
                        else{//using map
                            const operationResults = await Promise.all(tableValueList.map(
                                (value, index, array) => { return operationFunction(value, index, array, singleData)}
                            ));
                            //console.log(operationResults);
                            tableValueList = tableValueList.filter(
                                (value, index, array) => { return operationResults[index] }
                            )
                        }
                        break;
                    case "reduce":
                        operationFunction = singleOperationStep.operation;
                        if(!isAsync){
                            tableValueList = tableValueList.reduce( // tableValueList is unchanged
                                (cur, next, index, array) => {  return operationFunction(cur, next,index,array, singleData) }//no initial value
                            )
                        }
                        else{
                            tableValueList = await tableValueList.reduce( // the asynchronous function should use: await cur
                                async (cur, next, index, array) => { return await operationFunction(cur, next,index,array, singleData) }//no initial value
                            )
                        }
                        tableValueList = [tableValueList]
                        break;
                }
            }
        }
        return tableValueList;
    }

    //  [
    //    {operation: "greaterThan", dataArray: [{dataValue: 3, keyString: 'xp.max'}]
    //    {operation: "lowerThan", dataArray: [{dataValue: 7, keyString: 'xp.max'}]
    //  ]
    static #getOperationDataArray(operationData){
        //let operationDataInternal = generalUtils.createCopy(operationData); //the provided object is unchenged
        let operationDataInternal = operationData; //no copy is created in order to keep async data. the object itself is never modified
        if((!operationDataInternal.operationList)||(!Array.isArray(operationDataInternal.operationList))) {
            this.#log("operationList must be an array","error")
            return null
        };
        let returnList = [];
        let indexOfRequired = {}
        for(var operationCount = 0; operationCount < operationDataInternal.operationList.length; operationCount++){
            const singleOperationName = operationDataInternal.operationList[operationCount];
            if(!this.#filterRepo[singleOperationName]) {
                this.#log(preStr + "cannot find the operation " + singleOperationName + ": abort","error")
                return null;
            }
            const singleOperation = this.#filterRepo[singleOperationName];
            let operationObject = {operation: singleOperationName}
            const operationSequence = singleOperation.operationSequence;
            let dataArray = [];
            for(var stepCount = 0; stepCount < operationSequence.length; stepCount++){
                let stepObject = {};
                const requiredList = operationSequence[stepCount].required;
                for(var requiredCount = 0; requiredCount < requiredList.length; requiredCount++){
                    const requiredKey = requiredList[requiredCount];
                    if(operationDataInternal[requiredKey] !== undefined) {
                        if(Array.isArray(operationDataInternal[requiredKey])){
                            if(indexOfRequired[requiredKey] !== undefined) indexOfRequired[requiredKey] += 1;
                            else indexOfRequired[requiredKey] = 0;
                            stepObject[requiredKey] = operationDataInternal[requiredKey][indexOfRequired[requiredKey]]
                            //stepObject[requiredKey] = operationDataInternal[requiredKey][0]
                            //operationDataInternal[requiredKey] = operationDataInternal[requiredKey].slice(1)
                            //console.log(requiredKey)
                            //console.log(indexOfRequired)
                        }
                        else{
                            stepObject[requiredKey] = operationDataInternal[requiredKey]
                        }
                    };
                }
                dataArray.push(stepObject);
            }
            operationObject.dataArray = dataArray;
            returnList.push(operationObject);
        }
        return returnList;
    }

	static async #csv2array(fileName,splitter,dirName='csv'){
		const myQuots = ["'", '"'];
		//fetch del file
		const response = await fetch(`${nyquisttHelpersModPath}${dirName}/${fileName}`);
		if (!response.ok) return;
		let csvText = await response.text();
		//prima riga
		let keys = [];
		let rest = [];
		let nextRow = [];
		let keysDone = false;
		let done = false;
		while(!done){
			let nextString = "";
			//check for the start of a quote
			let quoted = false;
			let quoteUsed = "";
			for(var i = 0; i < myQuots.length; i++){
				if(csvText.indexOf(myQuots[i]) == 0){
					quoted = true;
					quoteUsed = myQuots[i];
					break;
				}
			}
			if(quoted){
				//console.log("found a quote")
				const quotedEnd = csvText.indexOf(quoteUsed,1);
				nextString = csvText.slice(quoteUsed.length,quotedEnd);
				csvText = csvText.slice(quotedEnd+1);
				nextRow.push(nextString);
				continue;
			}
			//check for new line and the splitter
			let chokeEnd = 0;
			let nextJump = 0;
			let newLine = false;
			const splitterPos = csvText.indexOf(splitter);
			const newlinePos = csvText.indexOf("\n");
			if(splitterPos == 0){ //the spitter is the next character
				csvText = csvText.slice(splitter.length)
				continue
			}
			else if( (newlinePos == -1) && (splitterPos == -1) ) {  //final record with end of file or just end of file
				console.log("final record or end of file")
				newLine = true;
				chokeEnd = csvText.length;
				nextJump = 0;
			}
			else if( (newlinePos != -1) && (splitterPos == -1) ) {
				newLine = true;
				chokeEnd = newlinePos;
				nextJump = "\n".length;
			}
			else { // both different from -1
				newLine = (newlinePos < splitterPos) ? true : false;
				chokeEnd = (newlinePos < splitterPos) ? newlinePos : splitterPos;
				nextJump = (newlinePos < splitterPos) ? "\n".length : splitter.length;
			}
			nextString = csvText.slice(0,chokeEnd);
			csvText = csvText.slice(chokeEnd+nextJump);
			nextRow.push(nextString);
			if(newLine){
				if(keysDone) {
					rest.push(nextRow);
				}
				else {
					for(var i = 0; i < nextRow.length; i++){
						keys.push(nextRow[i])
					}
					keysDone = true;
				}
				nextRow = [];
			}
			if(csvText.length==0){
				console.log("end of file")
				done=true;
			}
		}
		let myResult = [];
		for(var i = 0; i < rest.length; i++){
			let myRow = {};
			for(var j = 0; j < keys.length; j++){
				myRow[keys[j]] = rest[i][j];
			}
			myResult.push(myRow);
		}
		return myResult;

	}


    /********************************************************************
     * Table Tree
     ********************************************************************/
    static async scanLibrary(libPath){
        //console.log(libPath)
        const slashPosiz = libPath.lastIndexOf("/");
        const relativePath = libPath.slice(0,slashPosiz+1)
        let nFiles = 0;
        for await ( const [fileName, filePath] of fileUtils.iterateJsonLibrary(libPath)){
        //for await( const fileName of fileUtils.iterateJsonLibrary(libPath)){
            //console.log(fileName)
            if((fileName)&&(filePath)){
                //console.log(fileName,relativePath + filePath)
                const myResult = await this.#addTableToTree(fileName,relativePath + filePath);
                if(myResult === "ok") nFiles++;
            }
        }
        //console.log(this.#tablesRoot);
        this.#readLibraries.push(libPath)
        return {fileAdded: nFiles}
    }

    static async checkLibrary(libPath, force = false){
        if((!force)&&(this.#readLibraries.includes(libPath))) return true;
        await this.scanLibrary(libPath);
        return true;
    }

    static async checkFilterLibrary(libPath){}

    static async preloadLibraries(libraryList){
        if(!execPreLoad) return false
        for(const eachLibrary of libraryList){
            await this.checkLibrary(eachLibrary.filePath)
        }
        return true
    }

    static getTableNames(tablePath){
        const typedObject = generalUtils.searchNestedObjectValue(this.#tablesRoot,tablePath);
        let returnList = [];
        if(!typedObject) return returnList;
        for (const [key, value] of Object.entries(typedObject)){
            returnList.push(key)
        }
        return returnList;
    }

    static getTableType(tablePath){
        const typedObject = generalUtils.searchNestedObjectValue(this.#tablesRoot,tablePath)
        if(!typedObject) return null;
        if(typedObject.tableType !== undefined) return typedObject.tableType
        else return null
    }

    static getTableOfType(typeName, myObj = null, pathString = ""){
        if(myObj === null) myObj = this.#tablesRoot
        let returnList = []
        if(myObj.tableType !== undefined){
            if(myObj.tableType.includes(typeName)) returnList.push(pathString)
        }
        for(const [key,value] of Object.entries(myObj)){
            if((key !== "fileName")&&(key !== "filePath")&&(key !== "tableType")&&(key !== "cache")){
                const newPathString = pathString === "" ? key : pathString + "." + key
                returnList = returnList.concat(this.getTableOfType(typeName,myObj[key],newPathString))
            }
        }
        return returnList
    }

    static getRootCategories(){
        let returnList = [];
        for(const [key, value] of Object.entries(this.#tablesRoot)){
            returnList.push(key);
        }
        return returnList;
    }

    static checkTablePath(tablePath){
        const foundTable = generalUtils.getNestedObjectValue(this.#tablesRoot,tablePath)
        if(!foundTable) return {check: false}
        if((foundTable.fileName !== undefined)&&(foundTable.filePath !== undefined)){
            return {check: true, tableType: generalUtils.createCopy(foundTable.tableType)}
        }
        else return {check: false}
    }

    static async getFromTable(tableOrTableName,operationData,stored=true){
        this.#debug("getting from table")
        this.#debug("tableOrTableName",tableOrTableName, "operationData",operationData,"stored",stored)
        const operationDataArray = this.#getOperationDataArray(operationData);
        this.#debug("operationDataArray",operationDataArray)
        //console.log(operationData)
        //console.log(operationDataArray)
        if(!operationDataArray){
            //nyqLog(preStr + "cannot parse operation data: abort","error")
            return null
        }
        const operatedTable = await this.#operateTable(tableOrTableName,operationDataArray,stored);
        this.#debug("operatedTable",operatedTable)
        return operatedTable;
    }

    static async getWholeTable(tableName){
        const readTable = await this.#readTableFromTree(tableName);
        let tableValueList;
        if(Array.isArray(readTable.valueList)) tableValueList = readTable.valueList;
        else if((typeof readTable.valueList === 'string')||(readTable.valueList instanceof String)){
            if(readTable[readTable.valueList]) tableValueList = readTable[readTable.valueList];
            else tableValueList = [readTable.valueList]
        }
        else tableValueList = [readTable.valueList];
        return tableValueList
    }

    static get availableFilters(){
        let returnList = [];
        for(const eachFilter of Object.keys(this.#filterRepo)){
            let newObj = {
                name: eachFilter,
                steps: this.#filterRepo[eachFilter].operationSequence.length,
                requiredEachStep: [],
            }
            for(const eachStep of this.#filterRepo[eachFilter].operationSequence){
                newObj.requiredEachStep.push(generalUtils.createCopy(eachStep.required))
            }
            returnList.push(newObj)
        }
        returnList.sort(
            (a,b) => {
                return a.name < b.name ? -1 : a.name > b.name ? +1 : 0
            }
        )
        return returnList;
    }

    static async writeTableToFile(fileName,tableOrTableName,stored=false,otherOptions=null){
        if(stored && !this.checkTablePath(tableOrTableName).check) return {error: "table does not exist"};
        const readTable = stored ? await this.#readTableFromTree(tableOrTableName) : tableOrTableName;
        let fileObject;
        if(Array.isArray(readTable)){
            fileObject = {
                name: "unknown",
                tablePath: "unknown",
                values: "*",
                variables: "none",
                valueList: tableOrTableName,
            }
        }
        else if(typeof readTable === 'object'){
            if(readTable.valueList === undefined){
                return {error: "table does not have a value list"}
            }
            if(!Array.isArray(readTable.valueList)){
                if(typeof readTable.valueList !== 'string' || readTable[readTable.valueList] === undefined || !Array.isArray(readTable[readTable.valueList])) return {error: "cannot parse valueList field"}
            }
            fileObject = readTable
            if(fileObject.name === undefined) fileObject.name = "unknown"
            if(fileObject.tablePath === undefined) fileObject.tablePath = "unknown"
            if(fileObject.values === undefined) fileObject.values = "*"
            if(fileObject.variables === undefined) fileObject.variables = "none"
        }
        if(otherOptions !== null){
            generalUtils.mergeObjectsByreference(fileObject,otherOptions)
        }
        return await fileUtils.saveObjectToFile(fileObject,fileName)
    }

}

/********************************************************************************
 * HOOKS: this is to store and retrieve config values through the foundryvtt settings
 ********************************************************************************/
let preLoadLibraries
let execPreLoad
Hooks.on("init", async function(){
    /**
     * as it seems, settings must be registered at any init of the environment
     * their content is persistent but the game.settings does not mantain previously registered settings
     */
    const preLoadLibraries = {
        name: "Pre-load libraries",
        hint: "the list of known sub-modules and their location (on disk and within the API)",
        scope: "world",      // This specifies a world-level setting
        config: false,        // This specifies that the setting appears in the configuration view
        requiresReload: true, // This will prompt the GM to have all clients reload the application for the setting to take effect
        default: [
            {libName: 'dnd5e2024', filePath: 'modules/nyquistt-helpers/nyqLibs/lib-dnd5e2024.json'},
        ],
        onChange: value => {
            console.log("Pre-load library has been changed:")
            console.log(value)
        },
        type: new foundry.data.fields.ArrayField(new foundry.data.fields.ObjectField, {nullable: false})
    }
    await game.settings.register(nyqGeneralConfig.moduleId, 'preLoadLibraries', preLoadLibraries)
    const execPreLoad = {
        name: "Execute preload of libraries",
        hint: "If checked the library in the pre-load list will be preloaded",
        scope: "world",
        config: false,
        requiresReload: true,
        default: false,
        onChange: value => {
            console.log("exec preload has been changed")
            console.log(value)
        },
        type: new foundry.data.fields.BooleanField({nullable: false})
    }
    await game.settings.register(nyqGeneralConfig.moduleId, 'execPreLoad', execPreLoad)
    const menuData = {
        name: "Preload json libraries Menu",
        label: "Libraries",
        hint: 'Here you will be able to change the list of json libraries to pre-load',
        icon: "fa-solid fa-user-plus",
        restricted: true,
        type: settingsLibMenuApp,
    }
    game.settings.registerMenu(nyqGeneralConfig.moduleId, "settingsMenuNyqTables", menuData)
})

Hooks.on("setup", function(){
    preLoadLibraries = game.settings.get('nyquistt-helpers',"preLoadLibraries")
    execPreLoad = game.settings.get('nyquistt-helpers','execPreLoad')
})

Hooks.on("ready", function(){
    nyqTables.preloadLibraries(preLoadLibraries)
})

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api
class settingsLibMenuApp extends HandlebarsApplicationMixin(ApplicationV2){
    static newPreLoadLibraries = []
    static newExecPreLoad = false
    static IamInitialized = false
    static async getSettings(){
        this.newPreLoadLibraries = []
        const storedPreLoadLibraries = await game.settings.get('nyquistt-helpers',"preLoadLibraries")
        for(const eachKnown of storedPreLoadLibraries){
            this.newPreLoadLibraries.push({libName: eachKnown.libName, filePath: eachKnown.filePath})
        }
        this.newExecPreLoad = await game.settings.get('nyquistt-helpers',"execPreLoad")
    }
    static async initMe(){
        await this.getSettings()
        this.IamInitialized = true
    }
    static async pickFile(pathString, filePickerObj){
        //attached to the filePicker: this refers to the filePicker and not to the class
        settingsLibMenuApp.newPreLoadLibraries.push({libName: "unknown name", filePath: pathString})
        await filePickerObj.nyqCaller.pleaseRender(['libFiles'])
        return {pickFileResult: true}
    }
    async pleaseRender(partList = []){
        this.render(
            {
                force: true,
                parts: partList,
            }
        )
    }
    static async myAction(event, target){
        //attached to the window: this refers to the window and not to the class
        //console.log(event)
        //console.log(target)
        const clickedElement = target.getAttribute("Class");
        switch(clickedElement){
            case 'btnDeleteLib':
                settingsLibMenuApp.newPreLoadLibraries.splice(parseInt(target.getAttribute("data-id")),1)
                this.pleaseRender(['libFiles'])
                break
            case "btnPickFile":
                let myFilePicker = new foundry.applications.apps.FilePicker.implementation({callback: settingsLibMenuApp.pickFile})
                //used to pass the this of the caller dialog to the picker funciton
                myFilePicker.nyqCaller = this
                const pickerResult = await myFilePicker.render(true)
                //console.log(pickerResult)
                //this.render(true)
                break
            case "btnUpdateChoices":
                let html_newPreLoadLibraries = []
                const libNameList = this.element.querySelectorAll('.inputLibName')
                for(const eachLib of libNameList){
                    html_newPreLoadLibraries[parseInt(eachLib.getAttribute("data-id"))] = {libName: eachLib.value}
                }
                const filePathList = this.element.querySelectorAll('.inputFilePath')
                for(const eachPath of filePathList){
                    html_newPreLoadLibraries[parseInt(eachPath.getAttribute("data-id"))].filePath = eachPath.value
                }
                const html_newExecPreLoad = this.element.querySelectorAll('.execPreload')[0].checked
                console.log("newExecPreLoad")
                console.log(html_newExecPreLoad)
                console.log("newPreLoadLibraries")
                console.log(html_newPreLoadLibraries)
                await game.settings.set('nyquistt-helpers',"preLoadLibraries",html_newPreLoadLibraries)
                await game.settings.set('nyquistt-helpers','execPreLoad',html_newExecPreLoad)
                settingsLibMenuApp.IamInitialized = false
                //this.render(true)
                this.pleaseRender()
                break
        }
    }
    static PARTS = {
        header: { template: `${nyqGeneralConfig.nyqModPath}/templates/settings-nyqTables-header.hbs`},
        libFiles: {template: `${nyqGeneralConfig.nyqModPath}/templates/settings-nyqTables-libFiles.hbs`},
        pickNewLibFile: {template: `${nyqGeneralConfig.nyqModPath}/templates/settings-nyqTables-pickFile.hbs`},
        execPreLoad: {template: `${nyqGeneralConfig.nyqModPath}/templates/settings-nyqTables-execpreload.hbs`},
        footer: {template: `${nyqGeneralConfig.nyqModPath}/templates/settings-nyqTables-footer.hbs`},
    }
    static DEFAULT_OPTIONS = {
		position: {
			left: 100,
			width: 800,
			height: 400,
		},
		window: {
			resizable: true,
			title: "Set the options",
			icon: "fa-solid fa-user-plus",
			contentClasses: ['nyqWindowContent'],
		},
		actions: {
			myAction: settingsLibMenuApp.myAction
		}
	}
    _configureRenderOptions(options){
		super._configureRenderOptions(options);
		options.parts = [];
		options.parts.push('header');
        options.parts.push('execPreLoad')
        options.parts.push('libFiles');
        options.parts.push('pickNewLibFile')
        options.parts.push('footer');
	}
    async _preparePartContext(partId, context){
        switch(partId){
            case 'header':
                break
            case 'libFiles':
                if(!settingsLibMenuApp.IamInitialized){
                    console.log("need to initialize libFiles")
                    await settingsLibMenuApp.initMe();
                }
                context = {
                    boxDimensionClass: "heightSmall",
                    preLoadLibraries: settingsLibMenuApp.newPreLoadLibraries,
                }
                break
            case 'execPreLoad':
                if(!settingsLibMenuApp.IamInitialized){
                    console.log("need to initialize execPreload")
                    await settingsLibMenuApp.initMe();
                }
                context = {execPreLoad: settingsLibMenuApp.newExecPreLoad}
                break
            case 'footer':
                break
        }
        return context
    }
}

//checkLibrary(libPath, force = false)


export {nyqTables}