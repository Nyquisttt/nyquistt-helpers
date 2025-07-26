import * as nyqGeneralConfig from './nyqGeneralConfig.js';
import {nyqLog, nyqDebug} from './logging.js';
import * as generalUtils from './generalUtils.js'

/**
 * the functions stored in the functionVault receive a single input object (functionData)
 * they are executed as part of a sequence that provides a shared context for alla the functions of the sequence
 * each function is executed within a owned context that provides the generalUtils lib of functions and the requestSequenceElement function that is used to provide a list of functions that must be inserted within the current sequence
 * the sequence has its own Data object (sequenceData) that is used to provide inputs to the functions and store their results
 * when a function is executed an inputDataMap object and an ouputDataMap object must be provided
 * the inputDataMap allow extracting data from the sequenceData object to create the functionData object
 * the outputDataMap allow inserting into the sequenceDataObject the output returned by the function
 * dot notation is used in the inputDataMap and outputDataMap objects to select the position of each field
 * 
 * example:
 * 
 *  sequenceData - before function execution
 *  {
 *      myField1:     {
 *              value1: 1,
 *              value2: 2,
 *      }
 *      myField2: 3,
 *  }
 * 
 *  inputDataMap
 *  {
 *      myInputStructure.myInput1: myField1.value1,
 *      myInputStructure.myInput2: myField1.value2,
 *      'myInput3[0]': myField2,
 *      'myInput3[1]': myField1.value1,
 *      'myInput3[2]': myField1.value2,
 *  }
 * 
 *  functionData
 *  {
 *      myInputStructure:   {
 *          myInput1: 1,
 *          myInput2: 2,
 *      },
 *      myInput3: [3,1,2]
 *  }
 * 
 *  outputDataMap
 *  {
 *      stored.out1: freturn.object1,
 *      stored.out2: freturn.object2,
 *  }
 * 
 *  sequenceData - after function execution
 *  {
 *      myField1:     {
 *              value1: 1,
 *              value2: 2,
 *      }
 *      myField2: 3,
 *      stored: {
 *          out1: <function return>.object1,
 *          out2: <function return>.object2,
 *      }
 *  }
 */

/**
 * c_sequenceElement provides an object to store the info required to run a function
 * functionName: the name of the function
 * functionDB: the DB where the function is stored
 * inputDataMap: an object mapping the sequence context Data (sequenceData) with the function context Data (functionData)
 * outputDataMap: an object mapping the output returned by the function into the sequence context Data (sequenceData)
 */
class c_sequenceElement{
    #identityString = "sequenceElement"
    #debug(...inputList){
        nyqDebug(this.#identityString, ...inputList)
    }
    #log(myString, type=null){ //only strings
        nyqLog(myString.toString(), this.#identityString, type)
    }
    #debugReport(){
        this.#debug("internal structure",this)
    }
    functionName = null
    functionDB = null
    inputDataMap = {}
    outputDataMap = {}
    delay = 0;
    #valid = false
    get valid(){return this.#valid}
    /**
     * 
     * @param {string} fName 
     * @param {string} fDB 
     * @param {object} inMap 
     * @param {object} outMap 
     * @param {undefined | number} delay 
     * @returns 
     */
    constructor(fName,fDB,inMap,outMap,delay){
        this.#debug("constructor called with fName,fDB,inMap,outMap,delay:",fName,fDB,inMap,outMap,delay)
        if(typeof fName !== 'string') {
            this.#log("fName must be a string","error")
            return;
        }
        this.functionName = fName.toString()
        if(typeof fDB !== 'string') {
            this.#log("fDB must be a string","error")
            return
        }
        this.functionDB = fDB.toString();
        //console.log(fData)
        generalUtils.flattenObject(this.inputDataMap,inMap)
        //console.log(outManip)
        generalUtils.flattenObject(this.outputDataMap,outMap)
        if(delay === undefined) delay = -1;
        if(Number.isNaN(delay)) {
            this.#log("delay must be a number","error")
            return;
        }
        this.delay = delay;
        this.#valid = true;
        this.#debugReport()
    }
}

/**
 * the function context. provides access to the generalUtils library of function
 * also provides the requestSequenceElement function used to request the execution of other functions within the current sequence
 */
class c_functionContext{
    #identityString = "functionContext"
    #debug(...inputList){
        nyqDebug(this.#identityString, ...inputList)
    }
    #log(myString, type=null){ //only strings
        nyqLog(myString.toString(), this.#identityString, type)
    }
    #debugReport(){
        this.#debug("internal structure",this)
    }
    generalUtils = generalUtils;
    #requestedSequenceElements = []
    requestSequenceElement(fName,fDB = undefined, inMap = undefined, outMap = undefined, delay = undefined){
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        const elementData = {
            functionName: fName,
            functionDB: fDB,
            outputDataMap: outMap,
            inputDataMap: inMap,
            functionData: fData,
            delay: delay,
        }
        this.#requestedSequenceElements.push(elementData)
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        return
    };
    get requestedSequenceElements(){
        return this.#requestedSequenceElements;
    }
    /**
     * 
     * @param {Function} functionRef 
     */
    constructor(functionRef){
        this.executable = functionRef;
        this.#debugReport()
    }
}

/**
 * @typedef {object} functionObject
 * @property {string} name
 * @property {string} db
 * @property {boolean} isAsync
 * @property {string[]} requires
 * @property {Function} executable
 */

/**
 * the single function object
 * name: the name of the function
 * db: the name of the DB where the function is stored
 * isAsync: true if the function is async
 * requires: an array of the name of the inputs required from the function. to ease the use of stored functions
 * executable: the executable code of the function
 * valid: true if the object has valid properties
 * constuctorError: string with the error encountered in the creation of the object
 * run: async method to execute the function executable.
 *      parameters: functionData, outputDataMap
 *      the run method creates a c_functionContext object and runs the function executable within it
 *      functionData is fed to the executable as input
 *      then the outputDataMap object is used to create a return object that will be merged with the sequenceData
 *      the function also returns the list of requested functions to be executed within the current sequence
 */
class c_singleFunction{
    #identityString = "singleFunction"
    #debug(...inputList){
        nyqDebug(this.#identityString, ...inputList)
    }
    #log(myString, type=null){ //only strings
        nyqLog(myString.toString(), this.#identityString, type)
    }
    #debugReport(){
        this.#debug("internal structure",this)
    }
    #checkObject(myObj){
        if(typeof myObj.name !== 'string'){
            this.#constructorError = "function name must be a string"
            return false
        };
        if((myObj.isAsync !== null) && (typeof myObj.isAsync !== 'boolean')){
            this.#constructorError = "isAsync must be boolean"
            return false
        }
        if(!Array.isArray(myObj.requires)){
            this.#constructorError = "requires must be an array"
            return false
        }
        if(typeof myObj.db !== 'string'){
            this.#constructorError = "db must be a string"
            return false;
        };
        if(typeof myObj.executable !== 'function'){
            this.#constructorError = "executabel must be a function"
            return false;
        }
        return true
    }
    #constructorError = ""
    #valid = false;
    #name= "unknown";
    #isAsync= false;
    #requires= [];
    #db = "deleted";
    #executable = (functionData) => {
        return null
    }
    get name(){
        return this.#name.toString();
    }
    get isAsync(){
        return this.#isAsync ? true : false;
    }
    get requires(){
        return this.#requires;
    }
    get db(){
        return this.#db.toString()
    }
    get executable(){
        return this.#executable
    }
    get valid(){
        return this.#valid;
    }
    get constructorError(){
        return this.#constructorError;
    }
    /**
     * 
     * @param {functionObject} funcObject 
     * @returns 
     */
    constructor(funcObject){
        if(!this.#checkObject(funcObject)) return;
        this.#valid = true;
        this.#name = funcObject.name;
        this.#isAsync = funcObject.isAsync ? true : false;
        this.#requires = funcObject.requires;
        this.#db = funcObject.db;
        this.#executable = funcObject.executable;
        this.#debugReport()
    }
    async run(functionData,outputDataMap){
        this.#debug("running function","functionData:",functionData,"outputDataMap",outputDataMap)
        const execContext = new c_functionContext(this.#executable)
        let wholeReturn = {};
        wholeReturn.freturn = this.isAsync ? await execContext.executable(functionData) : execContext.executable(functionData);
        let myReturnObject = {};
        for(const [key, value] of Object.entries(outputDataMap)){
            const theValue = generalUtils.getNestedObjectValue(wholeReturn,value);
            myReturnObject = generalUtils.createNestedObjectValue(myReturnObject,key,theValue)
        }
        this.#debug("function ended","return object:",myReturnObject,"requested elements:",execContext.requestedSequenceElements)
        return [myReturnObject, execContext.requestedSequenceElements];
    }
}

/**
 * the static methods and properties of this class are used to store a list of c_singleFunction objects
 * the class contains a list of databases. each database contains a list of functions
 * checkFunctionModule: function. receives a string (fileName) and a boolean (force=false). 
 *      fileName is the path of the js file containing the list of functions to be stored. 
 *      force is used to force the acquisition of the file even if it has alredy been read
 * getFunc: function. receives two strings (fName, fDB = null) and provides the corresponding c_singleFunction object
 *      fName: the funciton name
 *      fDB: the name of the DB used to store the function
 */
class nyqFunctionVault {
    static #identityString = "nyqFunctionVault"
    static #debug(...inputList){
        nyqDebug(this.#identityString, ...inputList)
    }
    static #log(myString, type=null){ //only strings
        nyqLog(myString.toString(), this.#identityString, type)
    }
    static #debugReport(){
        //this.#debug("internal structure",this)
        this.#debug("function list:",this.#functionList,"read libraries:",this.#readLibraries)
    }
    static pleaseReport(){
        this.#debugReport()
    }
    /** @type {Object.<string,c_singleFunction[]>} */
    static #functionList = {};
    /** @type {string[]} */
    static #readLibraries = [];
    static {
        this.#addToFunctionVault(nyqGeneralConfig.nyqModPath + "/esmodules/nyqFunctionList.js")
        this.#debugReport()
        //console.log(this.#functionList)
    }
    static async #addToFunctionVault(fileName, force = false){ //fileName is someting like modules/nyquistt-helpers/esmodules/something.js
        let error = "", warning = "", success = false
        if(!(typeof fileName == 'string')){
            error = "you must provide a string for the fileName"
            this.#log(error,"error")
            return {error: error, warning: warning, success: success}
        }
        if(fileName.lastIndexOf(".js") != fileName.length-3){
            error = "you must provide a js file"
            this.#log(error,"error")
            return {error: error, warning: warning, success: success}
        }
        if(this.#readLibraries.includes(fileName) && (!force)) {
            warning = "module already imported"
            this.#log(warning,"warn")
            return {error: error, warning: warning, success: success}
        }
        const importRoot = nyqGeneralConfig.importRoot
        this.#log("importing function list at " + fileName)
        const { ExportedFunctionList } = await import(importRoot + fileName);
        if(!this.#readLibraries.includes(fileName)) this.#readLibraries.push(fileName)
        //console.log(ExportedFunctionList);
        if(!Array.isArray(ExportedFunctionList)){
            error = "invalid module content"
            this.#log(error,"error")
            return {error: error, warning: warning, success: success}
        }
        for(const eachFunction of ExportedFunctionList){
            const newFunction = new c_singleFunction(eachFunction);
            if (!newFunction.valid){
                warning += "[" + "skipping function with error: " + newFunction.constructorError + "]"
                this.#log("skipping function with error: " + newFunction.constructorError,"warn")
                continue
            }
            if(!this.#functionList[newFunction.db]) this.#functionList[newFunction.db] = [];
            const db = this.#functionList[newFunction.db];
            const alreadyLoaded = db.filter(
                (value, index, array) => {
                    return value.name == newFunction.name
                }
            )
            if(alreadyLoaded.length){
                warning += "[" + "skipping already loaded function " + newFunction.name + "]"
                this.#log("skipping already loaded function " + newFunction.name,"warn")
                continue
            }
            this.#log("loading function " + newFunction.name)
            db.push(newFunction);
        }
        success = true
        return {error: error, warning: warning, success: success}
    }
    static async checkFunctionModule(fileName,force=false){
        if( (!force) && (this.#readLibraries.includes(fileName)) ) {
            this.#log("module " + fileName + " already acquired")
            return {error: "", warning: "module " + fileName + " already acquired", success: false}
        };
        const addResult = await this.#addToFunctionVault(fileName,force)
        this.#debugReport()
        return addResult
    }
    static getFunc(fName, fDB = null){
        let retFunc = null;
        if(fDB === null){
            for(const [key, value] of Object.entries(this.#functionList)){
                [retFunc, fDB] = this.getFunc(fName, key);
                if(retFunc !== null) break;
            }
        }
        else{
            const myDb = this.#functionList[fDB] !== undefined ? this.#functionList[fDB] : null;
            if(myDb === null) {
                this.#log("db " + fDB.toString() + " is empty","warn")
                retFunc = null;
                fDB = null;
            }
            else{
                const funcList = myDb.filter(
                    (value, index, array) => {
                        return value.name == fName.toString()
                    }
                )
                if(funcList.length == 0) {
                    this.#log("cannot find function " + fName.toString() + " in " + fDB.toString(),"warn")
                    retFunc = null;
                }
                else {
                    retFunc = funcList[0]
                    if(funcList.length > 1){
                        this.#log("there are many functions with name " + fName,"warn");
                    }
                }
            }
        }
        return [retFunc, fDB];
    }
    static listStoredFuntions(){
        let resultList = []
        for(const [dbName, funcList] of Object.entries(this.#functionList)){
            for(const eachFunction of funcList){
                resultList.push({
                    dbName: dbName,
                    functionName: eachFunction.name,
                    isAsync: eachFunction.isAsync,
                    requires: generalUtils.createCopy(eachFunction.requires)
                })
            }
        }
        return resultList
    }
    static listReadLibraries(){
        let resultList = []
        for(const eachLibrary of this.#readLibraries){
            resultList.push(eachLibrary.toString())
        }
        return resultList
    }
}

/**
 * @typedef {object} elementData
 * @property {string} fName
 * @property {string} functionName
 * @property {string} fDB
 * @property {string} functionDB
 * @property {object} outputDataMap
 * @property {number} delay
 * @property {object} functionData
 * @property {object} inputDataMap
 */


class c_sequence{
    #identityString = "sequence"
    #debug(...inputList){
        nyqDebug(this.#identityString, ...inputList)
    }
    #log(myString, type=null){ //only strings
        nyqLog(myString.toString(), this.#identityString, type)
    }
    #debugReport(){
        //this.#debug("internal structure",this)
        this.#debug("internal structure:",this)
    }
    #elementList = [] //type: c_sequenceElement
    #currentFunction = -1;
    #runnable = false;
    #running = false
    #creator = null
    #myId = null
    #sequenceData = {}
    constructor(creator,id,sequenceData = {}){
        this.#creator = creator
        this.#myId = id
        this.#sequenceData = sequenceData
        this.#debugReport()
    }
    get currentFunction(){
        if(!this.#running) return null
        return this.#elementList[this.#currentFunction]
    }
    addToSequenceData(myData){
        this.#debug("addToSequenceData called with myData:",myData)
        generalUtils.mergeObjectsByreference(this.#sequenceData,myData)
        this.#debugReport()
    }
    #moveToNext(){
        if(!this.#running) return
        this.#currentFunction += 1;
        if(this.#elementList.length <= this.#currentFunction){
            this.#running = false
        }
    }
    #disappear(){
        this.#creator.deleteMe(this.#myId)
    }
    /**
     * 
     * @param {elementData} elementData 
     * @returns 
     */
    #assembleSequenceElemnt(elementData){
        this.#debug("assembleSequenceElement called with","elementData:",elementData)
        let resultOk = true;
        let sequenceElement = null;
        let sequenceData = null
        let fName = elementData.fName || elementData.functionName
        this.#debug("fName:",fName)
        if((fName === undefined)||(fName === null)){
            this.#log("you must provide fName","error")
            resultOk = false
            return {sequenceElement: sequenceElement, resultOk: resultOk, sequenceData: sequenceData}
        }
        let fDB = elementData.fDB || elementData.functionDB
        this.#debug("fDB:",fDB)
        fDB = fDB == undefined ? null : fDB;
        const [foundFunction, actualDB] = nyqFunctionVault.getFunc(fName, fDB)
        if(foundFunction === null){
            this.#log("cannot find the function " + fName,"warn")
            resultOk = false
            return {sequenceElement: sequenceElement, resultOk: resultOk, sequenceData: sequenceData}
        }
        let outputDataMap = elementData.outputDataMap 
        let actualOutputDataMap;
        if(outputDataMap === undefined){
            actualOutputDataMap = {
                store: {}
            }
            actualOutputDataMap.store[fName] = "freturn"
        }
        else{
            actualOutputDataMap = {}
            generalUtils.flattenObject(actualOutputDataMap,outputDataMap);
        }
        let delay = elementData.delay
        if(delay === undefined){
            delay = -1
        }
        let [functionData, inputDataMap] = [elementData.functionData, elementData.inputDataMap]
        let actualInputDataMap;
        if((functionData !== undefined) && (inputDataMap !== undefined)){
            actualInputDataMap = {}
            generalUtils.flattenObject(actualInputDataMap,inputDataMap)
            sequenceData = functionData;
        }
        else if((functionData !== undefined)&&(inputDataMap === undefined)){
            sequenceData = {}
            sequenceData[fName] = {}
            actualInputDataMap = {}
            for(const [key, value] of Object.entries(functionData)){
                sequenceData[fName][key] = value;
                actualInputDataMap[key] = fName + "." + key
            }
        }
        else if((functionData === undefined)&&(inputDataMap !== undefined)){
            actualInputDataMap = {}
            generalUtils.flattenObject(actualInputDataMap,inputDataMap)
        }
        else{
            actualInputDataMap = {}
        }
        sequenceElement = new c_sequenceElement(fName,actualDB,actualInputDataMap,actualOutputDataMap,delay)
        return {sequenceElement: sequenceElement, resultOk: resultOk, sequenceData: sequenceData}
    }
    /**
     * 
     * @param {elementData} elementData 
     * @returns {{fName: string, fDB: string, sequenceID: string, resultOk: boolean}}
     */
    checkAndAddSequenceElement(elementData){
        const assembledResult = this.#assembleSequenceElemnt(elementData)
        const sequenceElement = assembledResult.sequenceElement;
        const resultOk = assembledResult.resultOk;
        const sequenceDataAdd = assembledResult.sequenceData
        if(resultOk){
            this.addSequenceElement(sequenceElement)
            if(sequenceDataAdd !== null){
                this.addToSequenceData(sequenceDataAdd);
            }
            //generalUtils.mergeObjectsByreference(this.#sequenceData,sequenceDataAdd)
        }
        return {fName: sequenceElement.functionName, fDB: sequenceElement.functionDB, sequenceID: this.#myId, resultOk: resultOk}
    }
    /**
     * 
     * @param {c_sequenceElement} newElement 
     */
    addSequenceElement(newElement){
        this.#debug("addSequenceElement called with newElement:",newElement)
        if((newElement.delay === undefined) || (newElement.delay === null)){
            newElement.delay = -1;
        }
        if(newElement.delay == -1)
            this.#elementList.push(newElement);
        else{
            this.#elementList.splice(this.#currentFunction + newElement.delay , 0, newElement)
        }
        if(this.#elementList.length) this.#runnable = true;
        this.#debugReport()
    }
    async startSequence(force = false){
        this.#debug("startSequence called")
        this.#debugReport()
        if(!this.#runnable){
            this.#log("the sequence is not rubbable","warn")
            return {}
        }
        if((force) || (this.#currentFunction == -1)){
            this.#log("running sequence " + this.#myId)
            this.#running = true
            this.#currentFunction = 0
            while(this.#running){
                this.#log("running step " + (this.#currentFunction+1) + " of " + this.#elementList.length)
                const myElement = this.#elementList[this.#currentFunction]
                let functionData = {}
                generalUtils.mapUsingMapObject(myElement.inputDataMap,this.#sequenceData,functionData)
                this.#debug("functionData:",functionData)
                const [myFunction, _fdb] = nyqFunctionVault.getFunc(myElement.functionName, myElement.functionDB)
                this.#log("running function " + myElement.functionName)
                const runResult = await myFunction.run(functionData,myElement.outputDataMap)
                this.#debug("runResult:",runResult)
                const [functionReturn, requestedSequenceElements] = runResult
                generalUtils.mergeObjectsByreference(this.#sequenceData, functionReturn)
                for(const eachRequestedElement of requestedSequenceElements) {
                    this.checkAndAddSequenceElement(eachRequestedElement)
                    //this.addSequenceElement(eachRequestedElement)
                }
                this.#moveToNext()
            }
            this.#log("sequence " + this.#myId + " is terminating")
            return this.#sequenceData;
            //this.#disappear()
        }
        
    }
}

/**
 * the static methods and properties of this class are used to create and execute sequences of functions
 */
class nyqSequencer{
    static #identityString = "nyqSequencer"
    static #debug(...inputList){
        nyqDebug(this.#identityString, ...inputList)
    }
    static #log(myString, type=null){ //only strings
        nyqLog(myString.toString(), this.#identityString, type)
    }
    static #debugReport(){
        //this.#debug("internal structure",this)
        this.#debug("sequence list:",this.#sequenceList)
    }
    /**
     * @type {Object.<string, c_sequence>}
     */
    static #sequenceList= {}
    static pleaseReport(){
        this.#debugReport()
        nyqFunctionVault.pleaseReport()
    }
    static deleteMe(id){
        this.#debug("deleting sequence with id:",id)
        if(this.#sequenceList[id] !== undefined){
            delete this.#sequenceList[id]
        }
    }
    /**
     * 
     * @param {elementData | elementData[]} sequenceElementOrList 
     * @param {object} sequenceData 
     * @returns 
     */
    static createSequence(sequenceElementOrList, sequenceData = {}){
        this.#debug("createSequence called with","sequenceElementOrList:",sequenceElementOrList, "sequenceData:", sequenceData)
        const uuid = generalUtils.UUIDv4();
        const newSequence = new c_sequence(this, uuid, sequenceData);
        this.#sequenceList[uuid] = newSequence
        let resultOk, sequenceID = uuid;
        let fName, fDB;
        if(Array.isArray(sequenceElementOrList)){
            for(const eachElement of sequenceElementOrList){
                //return {fName: sequenceElement.functionName, fDB: sequenceElement.functionDB, sequenceID: this.#myId, resultOk: resultOk}
                const checkResult = newSequence.checkAndAddSequenceElement(eachElement)
                fName = checkResult.fName
                fDB = checkResult.fDB
                resultOk = checkResult.resultOk
            }
        }
        else{
            const checkResult = newSequence.checkAndAddSequenceElement(sequenceElementOrList)
            fName = checkResult.fName
            fDB = checkResult.fDB
            resultOk = checkResult.resultOk
        }
        this.#debugReport()
        return {fName: fName, fDB: fDB, sequenceID: sequenceID}
    }
    /**
     * 
     * @param {elementData | elementData[]} sequenceElementOrList 
     * @param {null | string} id 
     * @returns 
     */
    static addSequenceElement(sequenceElementOrList, id=null){
        this.#debug("addSequenceElement called with", "sequenceElementOrList:", sequenceElementOrList, "id:", id)
        if(id == null) {
            this.#debug("addSequence: calling createSequence");
            return this.createSequence(sequenceElementOrList)
        }
        else{
            let resultOk, sequenceID = id;
            let fName,fDB
            if(Array.isArray(sequenceElementOrList)){
                for(const eachElement of sequenceElementOrList){
                    const checkResult = this.#sequenceList[id].checkAndAddSequenceElement(eachElement)
                    fName = checkResult.fName
                    fDB = checkResult.fDB
                    resultOk = checkResult.resultOk
                }
            }
            else {
                const checkResult = this.#sequenceList[id].checkAndAddSequenceElement(sequenceElementOrList)
                fName = checkResult.fName
                fDB = checkResult.fDB
                resultOk = checkResult.resultOk
            }
            this.#debugReport()
            return {fName: fName, fDB: fDB, sequenceID: sequenceID}
            return {sequenceID: id}
        }
    }
    static async runSequence(id, force=false){
        this.#debug("runSequence started with:","id:",id,"force:",force)
        if(this.#sequenceList[id] !== undefined){
            this.#debug("running the sequence")
            const result = await this.#sequenceList[id].startSequence(force)
            this.#debug("deleting the sequence")
            this.deleteMe(id)
            this.#debugReport()
            return result
        }
        else{
            this.#log("cannot find the requested sequence","warn")
            return {}
        }
    }
    static addSingleFunction(functionInfo){
        this.#debug("addSingleFunction called with","functionInfo:",functionInfo)
        let sequenceID = functionInfo.sequenceID || null;
        return this.addSequenceElement(functionInfo,sequenceID)
    }
    static getAvailableFunctions(){
        return nyqFunctionVault.listStoredFuntions()
    }
    static getReadLibraries(){
        return nyqFunctionVault.listReadLibraries()
    }
    static async useFunctionModule(fileName, force = false){
        return await nyqFunctionVault.checkFunctionModule(fileName, force)
    }
}

/********************************************************************************
 * HOOKS: this is to store and retrieve config values through the foundryvtt settings
 ********************************************************************************/
/** @type {string[]} */
let preLoadFunctions = []
Hooks.on("init", async function(){
    /**
     * as it seems, settings must be registered at any init of the environment
     * their content is persistent but the game.settings does not mantain previously registered settings
     */
    const preLoadFunctions = {
        name: "Pre-load functions",
        hint: "the list of function modules and their location",
        scope: "world",      // This specifies a world-level setting
        config: false,        // This specifies that the setting appears in the configuration view
        requiresReload: true, // This will prompt the GM to have all clients reload the application for the setting to take effect
        default: [],
        onChange: value => {
            console.log("Pre-load functions has been changed:")
            console.log(value)
        },
        type: new foundry.data.fields.ArrayField(new foundry.data.fields.StringField, {nullable: false})
    }
    await game.settings.register(nyqGeneralConfig.moduleId, 'preLoadFunctions', preLoadFunctions)
    const menuData = {
        name: "Preload functions Menu",
        label: "Functions",
        hint: 'Here you will be able to change the list of function libraries to pre-load',
        icon: "fa-solid fa-user-plus",
        restricted: true,
        type: settingsFuncMenuApp,
    }
    game.settings.registerMenu(nyqGeneralConfig.moduleId, "settingsMenuNyqFunctionVault", menuData)
})

Hooks.on("setup", function(){
    preLoadFunctions = game.settings.get('nyquistt-helpers',"preLoadFunctions")
})

Hooks.on("ready", function(){
    for(const eachFunctionModule of preLoadFunctions){
        nyqFunctionVault.checkFunctionModule(eachFunctionModule)
    }
})

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api
class settingsFuncMenuApp extends HandlebarsApplicationMixin(ApplicationV2){
    static newPreLoadFunctions = []
    static IamInitialized = false
    static async getSettings(){
        this.newPreLoadFunctions = []
        const storedPreLoadFunctions = await game.settings.get('nyquistt-helpers',"preLoadFunctions")
        for(const eachKnown of storedPreLoadFunctions){
            this.newPreLoadFunctions.push(eachKnown)
        }
    }
    static async initMe(){
        await this.getSettings()
        this.IamInitialized = true
    }
    static async pickFile(pathString, filePickerObj){
        //attached to the filePicker: this refers to the filePicker and not to the class
        settingsFuncMenuApp.newPreLoadFunctions.push(pathString)
        await filePickerObj.nyqCaller.pleaseRender(['funcFiles'])
        console.log("pathString")
        console.log(pathString)
        console.log("newPreLoadFunctions")
        console.log(settingsFuncMenuApp.newPreLoadFunctions)
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
                settingsFuncMenuApp.newPreLoadFunctions.splice(parseInt(target.getAttribute("data-id")),1)
                this.pleaseRender(['funcFiles'])
                break
            case "btnPickFile":
                let myFilePicker = new foundry.applications.apps.FilePicker.implementation({callback: settingsFuncMenuApp.pickFile})
                //used to pass the this of the caller dialog to the picker funciton
                myFilePicker.nyqCaller = this
                myFilePicker.extensions = [".js"]
                const pickerResult = await myFilePicker.render(true)
                //console.log(pickerResult)
                //this.render(true)
                break
            case "btnUpdateChoices":
                let html_newPreLoadFunctions = []
                const filePathList = this.element.querySelectorAll('.inputFilePath')
                for(const eachPath of filePathList){
                    html_newPreLoadFunctions[parseInt(eachPath.getAttribute("data-id"))] = eachPath.value
                }
                console.log("html_newPreLoadFunctions")
                console.log(html_newPreLoadFunctions)
                await game.settings.set('nyquistt-helpers',"preLoadFunctions",html_newPreLoadFunctions)
                settingsFuncMenuApp.IamInitialized = false
                //this.render(true)
                this.pleaseRender()
                break
        }
    }
    static PARTS = {
        header: { template: `${nyqGeneralConfig.nyqModPath}/templates/settings-nyqFunctionVault-header.hbs`},
        funcFiles: {template: `${nyqGeneralConfig.nyqModPath}/templates/settings-nyqFunctionVault-libFiles.hbs`},
        pickNewLibFile: {template: `${nyqGeneralConfig.nyqModPath}/templates/settings-nyqFunctionVault-pickFile.hbs`},
        footer: {template: `${nyqGeneralConfig.nyqModPath}/templates/settings-nyqFunctionVault-footer.hbs`},
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
			myAction: settingsFuncMenuApp.myAction
		}
	}
    _configureRenderOptions(options){
		super._configureRenderOptions(options);
		options.parts = [];
		options.parts.push('header');
        options.parts.push('funcFiles');
        options.parts.push('pickNewLibFile')
        options.parts.push('footer');
	}
    async _preparePartContext(partId, context){
        switch(partId){
            case 'header':
                break
            case 'funcFiles':
                if(!settingsFuncMenuApp.IamInitialized){
                    console.log("need to initialize libFiles")
                    await settingsFuncMenuApp.initMe();
                }
                context = {
                    boxDimensionClass: "heightSmall",
                    preLoadFunctions: settingsFuncMenuApp.newPreLoadFunctions,
                }
                break
            case 'footer':
                break
        }
        return context
    }
}

export { nyqSequencer }