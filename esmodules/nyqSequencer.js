import * as nyqGeneralConfig from './nyqGeneralConfig.js';
import {nyqLog, nyqIsDebugging} from './logging.js';
import * as generalUtils from './generalUtils.js'

const preStr = "[nyqFunctionVault] ";
function thisLog(myString, type = null){
    nyqLog(preStr + myString,type)
}

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
    #identityString = "[sequenceElement] "
    #debug(...inputList){
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
    #log(myString, type=null){ //only strings
        nyqLog(this.#identityString + myString.toString(), type)
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
    #identityString = "[functionContext] "
    #debug(...inputList){
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
    #log(myString, type=null){ //only strings
        nyqLog(this.#identityString + myString.toString(), type)
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
        const newSequenceElement = new c_sequenceElement(fName,fDB,inMap,outMap,delay);
        if (newSequenceElement.valid) {
            this.#requestedSequenceElements.push(newSequenceElement)
        }
    };
    get requestedSequenceElements(){
        return this.#requestedSequenceElements;
    }
    constructor(functionRef){
        this.executable = functionRef;
        this.#debugReport()
    }
}

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
    #identityString = "[singleFunction] "
    #debug(...inputList){
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
    #log(myString, type=null){ //only strings
        nyqLog(this.#identityString + myString.toString(), type)
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
    static #identityString = "[nyqFunctionVault] "
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
        this.#debug("function list:",this.#functionList,"read libraries:",this.#readLibraries)
    }
    static pleaseReport(){
        this.#debugReport()
    }
    static #functionList = {};
    static #readLibraries = [];
    static {
        this.#addToFunctionVault(nyqGeneralConfig.nyqModPath + "/esmodules/nyqFunctionList.js")
        this.#debugReport()
        //console.log(this.#functionList)
    }
    static async #addToFunctionVault(fileName, force = false){ //fileName is someting like modules/nyquistt-helpers/esmodules/something.js
        if(!(typeof fileName == 'string')){
            this.#log("you must provide a string for the fileName","error")
            return
        }
        if(fileName.lastIndexOf(".js") != fileName.length-3){
            this.#log("you must provide a js file","error")
            return
        }
        if(this.#readLibraries.includes(fileName) && (!force)) {
            this.#log("module already imported","warn")
            return;
        }
        const importRoot = nyqGeneralConfig.importRoot
        this.#log("importing function list at " + fileName)
        const { ExportedFunctionList } = await import(importRoot + fileName);
        if(!this.#readLibraries.includes(fileName)) this.#readLibraries.push(fileName)
        //console.log(ExportedFunctionList);
        if(!Array.isArray(ExportedFunctionList)){
            this.#log("invalid module content","error")
            return
        }
        for(const eachFunction of ExportedFunctionList){
            const newFunction = new c_singleFunction(eachFunction);
            if (!newFunction.valid){
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
                this.#log("skipping already loaded function " + newFunction.name)
                continue
            }
            this.#log("loading function " + newFunction.name)
            db.push(newFunction);
        }
    }
    static async checkFunctionModule(fileName,force=false){
        if( (!force) && (this.#readLibraries.includes(fileName)) ) {
            this.#log("module " + fileName + " already acquired")
            return
        };
        await this.#addToFunctionVault(fileName,force)
        this.#debugReport()
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
}

class c_sequence{
    #identityString = "[sequence] "
    #debug(...inputList){
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
    #log(myString, type=null){ //only strings
        nyqLog(this.#identityString + myString.toString(), type)
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

function UUIDwithDate(){
    return Date.now()
}

function UUIDv4(){
    const baseString = 'xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx'
    const UUIDversion = 4 
    const variantFixedBits= 0x8
    const variantRandomBitsMask= 0x3
    const newString = baseString.replace(/[xMN]/g, function(myCharacter){
        const myRandom = Math.random() * 16 | 0
        const myValue = myCharacter == 'M' ? UUIDversion : myCharacter == 'x' ? myRandom : (myRandom & variantRandomBitsMask) | variantFixedBits ;
        return myValue.toString(16)
    })
    return newString;
}

/**
 * the static methods and properties of this class are used to create and execute sequences of functions
 */
class nyqSequencer{
    static #identityString = "[nyqSequencer] "
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
        this.#debug("sequence list:",this.#sequenceList)
    }
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
    static createSequence(sequenceElementOrList, sequenceData = {}){
        this.#debug("createSequence called with","sequenceElementOrList:",sequenceElementOrList, "sequenceData:", sequenceData)
        const uuid = UUIDv4();
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
                /*
                const assembledResult = this.#assembleSequenceElemnt(eachElement)
                sequenceElement = assembledResult.sequenceElement;
                resultOk = assembledResult.resultOk;
                sequenceDataAdd = assembledResult.sequenceData
                if(resultOk){
                    newSequence.addSequenceElement(sequenceElement)
                    if(sequenceDataAdd !== null){
                        newSequence.addToSequenceData(sequenceDataAdd);
                    }
                }
                */
            }
        }
        else{
            const checkResult = newSequence.checkAndAddSequenceElement(sequenceElementOrList)
            fName = checkResult.fName
            fDB = checkResult.fDB
            resultOk = checkResult.resultOk
            /*
            const assembledResult = this.#assembleSequenceElemnt(sequenceElementOrList)
            sequenceElement = assembledResult.sequenceElement;
            resultOk = assembledResult.resultOk;
            sequenceDataAdd = assembledResult.sequenceData
            if(resultOk){
                newSequence.addSequenceElement(sequenceElement)
                if(sequenceDataAdd !== null){
                    newSequence.addToSequenceData(sequenceDataAdd);
                }
            }
            */
        }
        this.#debugReport()
        return {fName: fName, fDB: fDB, sequenceID: sequenceID}
        return uuid
    }
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
                    //return {fName: sequenceElement.functionName, fDB: sequenceElement.functionDB, sequenceID: this.#myId, resultOk: resultOk}
                    const checkResult = this.#sequenceList[id].checkAndAddSequenceElement(eachElement)
                    fName = checkResult.fName
                    fDB = checkResult.fDB
                    resultOk = checkResult.resultOk
                    /*
                    const assembledResult = this.#assembleSequenceElemnt(eachElement)
                    sequenceElement = assembledResult.sequenceElement;
                    resultOk = assembledResult.resultOk
                    sequenceDataAdd = assembledResult.sequenceData
                    if(resultOk){
                        this.#sequenceList[id].addSequenceElement(sequenceElement)
                        if(sequenceDataAdd !== null){
                            this.#sequenceList[id].addToSequenceData(sequenceDataAdd)
                        }
                    }
                    */
                }
            }
            else {
                const checkResult = this.#sequenceList[id].checkAndAddSequenceElement(sequenceElementOrList)
                fName = checkResult.fName
                fDB = checkResult.fDB
                resultOk = checkResult.resultOk
                /*
                const assembledResult = this.#assembleSequenceElemnt(sequenceElementOrList)
                sequenceElement = assembledResult.sequenceElement
                resultOk = assembledResult.resultOk
                sequenceDataAdd = assembledResult.sequenceData
                if(resultOk){
                    this.#sequenceList[id].addSequenceElement(sequenceElement)
                    if(sequenceDataAdd !== null){
                        this.#sequenceList[id].addToSequenceData(sequenceDataAdd)
                    }
                }
                */
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
        /*let sequenceIsNew = false;
        let {fName, fDB, sequenceID, inputDataMap, outputDataMap, functionData, delay} = functionInfo
        if((sequenceID === undefined) || (this.#sequenceList[sequenceID] === undefined)){
            sequenceID = this.createSequence([],{})
            sequenceIsNew = true
        }
        if((fName === undefined)||(fName === null)){
            this.#log("you must provide fName","error")
            if(sequenceIsNew){
                this.deleteMe(sequenceID)
            }
            return {fName: null, fDB: null, sequenceID: null}
        }
        fDB = fDB == undefined ? null : fDB;
        const [foundFunction, actualDB] = nyqFunctionVault.getFunc(fName, fDB)
        if(foundFunction === null){
            this.#log("cannot find the function " + fName,"warn")
            if(sequenceIsNew){
                this.deleteMe(sequenceID)
            }
            return {fName: fName, fDB: fDB, sequenceID: sequenceID}
        }
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
        if(delay === undefined){
            delay = -1
        }
        let actualInputDataMap;
        if((functionData !== undefined) && (inputDataMap !== undefined)){
            this.#sequenceList[sequenceID].addToSequenceData(functionData)
            actualInputDataMap = {}
            generalUtils.flattenObject(actualInputDataMap,inputDataMap)
        }
        else if((functionData !== undefined)&&(inputDataMap === undefined)){
            actualInputDataMap = {}
            const sequenceData = {}
            sequenceData[fName] = {}
            for(const [key, value] of Object.entries(functionData)){
                sequenceData[fName][key] = value;
                actualInputDataMap[key] = fName + "." + key
            }
            this.#sequenceList[sequenceID].addToSequenceData(sequenceData)
        }
        else if((functionData === undefined)&&(inputDataMap !== undefined)){
            actualInputDataMap = {}
            generalUtils.flattenObject(actualInputDataMap,inputDataMap)
        }
        else{
            actualInputDataMap = {}
        }
        let newElement = new c_sequenceElement(fName,actualDB,actualInputDataMap,actualOutputDataMap,delay)
        this.#sequenceList[sequenceID].addSequenceElement(newElement)
        this.#debugReport()
        return {fName: fName, fDB: actualDB, sequenceID: sequenceID}*/
    }
}

export { nyqSequencer }