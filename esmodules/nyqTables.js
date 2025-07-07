import * as nyqGeneralConfig from './nyqGeneralConfig.js';
import {nyqLog, nyqIsDebugging} from './logging.js';
import * as fileUtils from './fileUtils.js'
import * as generalUtils from './generalUtils.js'
import { filterRepo } from './filterUtils.js';

const preStr = "[nyqTables] ";

class nyqTables{
    static #identityString = "[nyqTables] "
    static #debug(...inputList){
        if(!nyqIsDebugging()) return;
        for(const eachInput of inputList){
            if(typeof eachInput == "string"){
                this.#log(eachInput,"debug")
            }
            else{
                console.log(eachInput)
            }
        }
    }
    static #log(myString, type=null){ //only strings
        nyqLog(this.#identityString + myString.toString(), type)
    }
    static #debugReport(){
        //this.#debug("internal structure",this)
        this.#debug("tablesRoot:",this.#tablesRoot,"filterRepo:",this.#filterRepo,"readLibraries",this.#readLibraries)
    }
    static pleaseReport(){
        this.#debugReport()
    }
    static #listOfRollables = [];
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

    /****************************************************************
     * ROLL TABLES
     ****************************************************************/
    static async readRollables(fileList){
        const listOfReadRollables = await fileUtils.readListOfJsonFiles(fileList);
        //console.log(listOfReadRollables)
        for(const eachRollable of listOfReadRollables){
            let newInsertion = true;
            this.#listOfRollables.forEach(
                (value, index, array) => {
                    if(value.name == eachRollable.name){
                        newInsertion = false;
                        array[index].fileName = eachRollable.fileName;
                        array[index].filePath = eachRollable.filePath;
                    }
                }
            )
            if(newInsertion) this.#listOfRollables.push({name: eachRollable.name, fileName: eachRollable.fileName, filePath: eachRollable.filePath});
        };
        //console.log(this.#listOfRollables)
    }

    static async gimmeRollableNames(){
        let returnList = [];
        this.#listOfRollables.forEach(
            (value, index, array) => {
                returnList.push(value.name)
            }
        )
        returnList.sort()
        return returnList;
    }

    static async createRollTableByName(name){
        nyqLog(preStr + "creating table " + name);
		const myList = (await this.#listOfRollables).filter(
			(value, index, array) => {
				return value.name == name;
			}
		)
		if(!myList.length) {
            nyqLog(preStr + "failed to find the table")
            return "error";
        }
		const myTable = myList[0];
        const jsonContent = await fileUtils.readJsonFile(myTable.fileName, myTable.filePath);
        if(!Object.keys(jsonContent).length) {
            nyqLog(preStr + "error accessing the file");
            return "error";
        }
		let myData = {
			name: myTable.name,
			formula: jsonContent.formula,
			results: [],
		}
		for(var i = 0; i < jsonContent.results.length; i++){
			let myObj = generalUtils.createCopy(jsonContent.results[i]);
			myObj.type = foundry.CONST.TABLE_RESULT_TYPES.TEXT;
			myData.results.push(myObj);
		}
		//console.log(myData)
		const myRollTable = await RollTable.implementation.create(myData);
		//console.log(myRollTable)
        nyqLog(preStr + "Roll Table Created")
		return "done"
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

    static getTableNames(tablePath){
        const typedObject = generalUtils.searchNestedObjectValue(this.#tablesRoot,tablePath);
        let returnList = [];
        if(!typedObject) return returnList;
        for (const [key, value] of Object.entries(typedObject)){
            returnList.push(key)
        }
        return returnList;
    }

    static getRootCategories(){
        let returnList = [];
        for(const [key, value] of Object.entries(this.#tablesRoot)){
            returnList.push(key);
        }
        return returnList;
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
        return returnList;
    }

}

export {nyqTables}