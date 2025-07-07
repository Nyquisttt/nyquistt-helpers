import * as nyqGeneralConfig from './nyqGeneralConfig.js';
import {nyqLog} from './logging.js';
import * as generalUtils from './generalUtils.js'

const preStr = "[nyqFunctionEngine] ";

class c_singleFunction{
    checkObject(myObj){
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
        if(!this.checkObject(funcObject)) return;
        this.#valid = true;
        this.#name = funcObject.name;
        this.#isAsync = funcObject.isAsync ? true : false;
        this.#requires = funcObject.requires;
        this.#db = funcObject.db;
        this.#executable = funcObject.executable;
    }
    async run(functionData,outputManipulator){
        const execContext = new c_ExecutionContext(this.#executable)
        let wholeReturn = {};
        wholeReturn.this = this.isAsync ? await execContext.executable(functionData) : execContext.executable(functionData);
        let myReturnObject = {};
        for(const [key, value] of Object.entries(outputManipulator)){
            const theValue = generalUtils.getNestedObjectValue(wholeReturn,value);
            myReturnObject = generalUtils.createNestedObjectValue(myReturnObject,key,theValue)
        }
        return [myReturnObject, execContext.requestedSequenceElements];
    }
}

class c_sequenceElement{
    functionName = null
    functionDB = null
    functionData = {}
    outputManipulator = {}
    delay = 0;
    #valid = false
    get valid(){return this.#valid}
    constructor(fName,fDB,fData,outManip,delay){
        console.log("sequenceElement constructor")
        console.log("fName")
        console.log(fName)
        console.log("fDB")
        console.log(fDB)
        console.log("fData")
        console.log(fData)
        console.log("outManip")
        console.log(outManip)
        console.log("delay")
        console.log(delay)
        if(typeof fName !== 'string') {
            nyqLog(preStr + "fName must be a string","error")
            return;
        }
        this.functionName = fName.toString()
        if(typeof fDB !== 'string') {
            nyqLog(preStr + "fDB must be a string","error")
            return
        }
        this.functionDB = fDB.toString();
        //console.log(fData)
        generalUtils.flattenObject(this.functionData,fData)
        //console.log(outManip)
        generalUtils.flattenObject(this.outputManipulator,outManip)
        if(delay === undefined) delay = -1;
        if(Number.isNaN(delay)) {
            nyqLog(preStr + "delay must be a number","error")
            return;
        }
        this.delay = delay;
        this.#valid = true;
    }
}

class c_ExecutionContext{
    generalUtils = generalUtils;
    #requestedSequenceElements = []
    requestSequenceElement(fName,fDB,fData,retObj,delay){
        const newSequenceElement = new c_sequenceElement(fName,fDB,fData,retObj,delay);
        if (newSequenceElement.valid) {
            this.#requestedSequenceElements.push(newSequenceElement)
        }
    };
    get requestedSequenceElements(){
        return this.#requestedSequenceElements;
    }
    constructor(functionRef){
        this.executable = functionRef;
    }
}

class c_Sequencer{
    #sequence = [];
    #isRunning = false;
    #currentFunction = -1;
    addElement(elementData){
        console.log("sequencer addElement")
        console.log("elementData")
        console.log(elementData)
        let newElement;
        newElement = new c_sequenceElement(elementData.functionName, elementData.functionDB, elementData.functionData, elementData.outputManipulator, elementData.delay);
        if (newElement.valid) {
            if(newElement.delay < 0) this.#sequence.push(newElement);
            else {
                this.#sequence.splice(this.#currentFunction+newElement.delay+1,0,newElement);
            }
        }
    }
    startSequence(){
        if(this.#sequence.length == 0) return;
        this.#isRunning = true;
        this.#currentFunction = 0;
    }
    get currentElement(){
        if(!this.#isRunning) return null
        return this.#sequence[this.#currentFunction]
    }
    get currentElementIndex(){
        if(!this.#isRunning) return [null, null]
        return [this.#currentFunction, this.#sequence.length]
    }
    moveForward(){
        this.#currentFunction += 1;
        if(this.#currentFunction >= this.#sequence.length) {
            this.#isRunning = false;
            this.#currentFunction = -1;
        }
    }
}

class nyqFunctionEngine{
    static #functionList = {};
    static #readLibraries = [];
    static #isExecuting = false;
    static #isExecutingFunction = false;
    static #isExecutingSequence = false;

    static centralSequencer = new c_Sequencer();//qualcosa del genere

    static {
        this.#addToFunctionList(nyqGeneralConfig.nyqModPath + "/esmodules/nyqFunctionList.js")
        //console.log(this.#functionList)
    }

    static async #addToFunctionList(fileName, force = false){ //fileName is someting like modules/nyquistt-helpers/esmodules/something.js
        if(!(typeof fileName == 'string')){
            nyqLog(preStr + "you must provide a string for the fileName","error")
            return
        }
        if(fileName.lastIndexOf(".js") != fileName.length-3){
            nyqLog(preStr + "you must provide a js file","error")
            return
        }
        if(this.#readLibraries.includes(fileName) && (!force)) {
            nyqLog(preStr + "module already imported","warn")
            return;
        }
        const importRoot = nyqGeneralConfig.importRoot
        nyqLog(preStr + "importing function list at " + fileName)
        const { ExportedFunctionList } = await import(importRoot + fileName);
        if(!this.#readLibraries.includes(fileName)) this.#readLibraries.push(fileName)
        //console.log(ExportedFunctionList);
        if(!Array.isArray(ExportedFunctionList)){
            nyqLog(preStr + "invalid module content","error")
            return
        }
        for(const eachFunction of ExportedFunctionList){
            const newFunction = new c_singleFunction(eachFunction);
            if (!newFunction.valid){
                nyqLog(preStr + "skipping function with error: " + newFunction.constructorError,"warn")
                continue
            }
            /*
            if( (!eachFunction.name)||(!eachFunction.executable)||(!eachFunction.db) ){
                nyqLog(preStr + "skipping a function for missing parts","warn");
                continue
            }
            if( ! ( (typeof eachFunction.name === 'string') && (typeof eachFunction.executable === 'function') && (typeof eachFunction.db === 'string') ) ){
                //console.log(typeof eachFunction.name)
                //console.log(typeof eachFunction.executable)
                nyqLog(preStr + "skipping a function for wrong structure","warn");
                continue
            }
                */
            //if(!this.#functionList[eachFunction.db]) this.#functionList[eachFunction.db] = [];
            if(!this.#functionList[newFunction.db]) this.#functionList[newFunction.db] = [];
            //const db = this.#functionList[eachFunction.db];
            const db = this.#functionList[newFunction.db];
            const alreadyLoaded = db.filter(
                (value, index, array) => {
                    //return value.name == eachFunction.name
                    return value.name == newFunction.name
                }
            )
            if(alreadyLoaded.length){
                //nyqLog(preStr + "skipping already loaded function " + eachFunction.name)
                nyqLog(preStr + "skipping already loaded function " + newFunction.name)
                continue
            }
            //nyqLog(preStr + "loading function " + eachFunction.name)
            nyqLog(preStr + "loading function " + newFunction.name)
            //db.push(eachFunction);
            db.push(newFunction);
        }
        //console.log(this.#functionList)
    }

    static async #execSingleFunction(functionRef,functionData,returnObject,isAsync){
        const execContext = new c_ExecutionContext(functionRef)
        let wholeReturn = {};
        if(isAsync) wholeReturn.this = await execContext.executable(functionData);
        else wholeReturn.this = execContext.executable(functionData);
        let myReturnObject = {};
        for(const [key, value] of Object.entries(returnObject)){
            const theValue = generalUtils.getNestedObjectValue(wholeReturn,value);
            myReturnObject = generalUtils.createNestedObjectValue(myReturnObject,key,theValue)
        }
        return myReturnObject;
    }

    static async checkFunctionModule(fileName,force){
        if( (!force) && (this.#readLibraries.includes(fileName)) ) {
            nyqLog(preStr + "module " + fileName + " already acquired")
            return
        };
        await this.#addToFunctionList(fileName,force)
    }

    static async execFunctionTable(functionTable,operationData){
        const failReturn = {}
        if(this.#isExecuting){
            nyqLog(preStr + "you cannot call a function from within another function: abort","error")
            return failReturn;
        }
        if(!generalUtils.checkRequired(functionTable,{
            operationName: 'string', 
            sequence: 'array',
        })) return failReturn;
        this.#isExecuting = true;
        const operationName = functionTable.operationName;
        const nFunctions = functionTable.sequence.length;
        nyqLog(preStr + "executing the operation " + operationName + " with " + nFunctions + " sub-functions")
        let operationDataFlat = {} //this MUST be updated with the output of each function (mergeObjectsByReference)
        for(var countFunctions = 0; countFunctions < functionTable.sequence.length; countFunctions++){
            generalUtils.flattenObject(operationDataFlat,operationData)
            //const curFunction = functionTable.sequence[countFunctions];
            const functionName = functionTable.sequence[countFunctions].functionName;
            const functionDBname = functionTable.sequence[countFunctions].functionDB;
            const functionData = functionTable.sequence[countFunctions].functionData;
            const returnObject = functionTable.sequence[countFunctions].returnObject;
            let functionDataFlat = {}
            generalUtils.flattenObject(functionDataFlat,functionData);
            let assembledData = {}
            for(const [key, value] of Object.entries(functionDataFlat)){
                const providedData = operationDataFlat[value] ? operationDataFlat[value] : generalUtils.getNestedObjectValue(operationData,value);
                if(providedData) generalUtils.createNestedObjectValue(assembledData,key,providedData);
            }
            console.log(operationData)
            console.log(operationDataFlat)
            console.log(assembledData)
            if(undefined === this.#functionList[functionDBname]){
                nyqLog(preStr + "skipping function of unknown library " + functionDBname,"warn")
                continue
            }
            const curFunctionDB = this.#functionList[functionDBname];
            //console.log(this.#functionList);
            //console.log(curFunctionDB)
            const curFunctionSearch = curFunctionDB.filter(
                (value, index, array) => {return value.name == functionName}
            );
            if(!curFunctionSearch.length){
                nyqLog(preStr + "cannot find function " + functionName + ": abort","error")
                //console.log(this.#functionList)
                this.#isExecuting = false;
                return failReturn;
            }
            //const curFunctionRef = curFunctionSearch[0].executable;
            //const isAsync = curFunctionSearch[0].isAsync;
            nyqLog(preStr + "executing function " + functionName + " (" + (countFunctions+1) + "/" + functionTable.sequence.length + ")")
            const [functionReturnObject, requestedSequenceElements] = await curFunctionSearch[0].run(assembledData,returnObject)
            //const functionReturnObject = await this.#execSingleFunction(curFunctionRef,assembledData, returnObject,isAsync);
            generalUtils.mergeObjectsByreference(operationData,functionReturnObject);
        }
        this.#isExecuting = false;
        return operationData;
    }

    static #getFunc(fName, fDB = null){
        let retFunc = null;
        if(fDB === null){
            for(const [key, value] of Object.entries(this.#functionList)){
                retFunc = this.#getFunc(fName, key);
                if(retFunc !== null) break;
            }
        }
        else{
            const myDb = this.#functionList[fDB] !== undefined ? this.#functionList[fDB] : null;
            if(myDb === null) {
                nyqLog(preStr + "db " + fDB.toString() + " is empty","warn")
                retFunc = null;
            }
            else{
                const funcList = myDb.filter(
                    (value, index, array) => {
                        return value.name == fName.toString()
                    }
                )
                if(funcList.length == 0) {
                    nyqLog(preStr + "cannot find function " + fName.toString() + " in " + fDB.toString(),"warn")
                    retFunc = null;
                }
                else {
                    retFunc = funcList[0]
                    if(funcList.length > 1){
                        nyqLog(preStr + "there are many functions with name " + fName,"warn");
                    }
                }
            }
        }
        return retFunc;
    }

    static parseString(inputString){
        //console.log("parsing string")
        //console.log(inputString)
        let isNormalString = true
        let returnString = inputString;
        if(inputString.indexOf("nyqKeep.") == 0){
            isNormalString = false
            returnString = inputString.slice(8)
        }
        else if(inputString.indexOf("nyqJSON.") == 0){
            isNormalString = false
            const jsonString = inputString.slice(8);
            returnString = JSON.parse(jsonString)
        }
        else if(inputString.indexOf("nyqPtr.") == 0){
            isNormalString = true
            returnString = inputString.slice(7);
        }
        return [isNormalString, returnString]
    }

    static assembleFunctionData(functionData,operationData){
        //console.log("assembling data")
        //console.log("functionData")
        //console.log(functionData)
        //console.log("operationData")
        //console.log(operationData)
        let operationDataFlat = {}
        generalUtils.flattenObject(operationDataFlat,operationData)
        let functionDataFlat = {}
        generalUtils.flattenObject(functionDataFlat,functionData);
        //console.log("functionDataFlat")
        //console.log(functionDataFlat)
        //console.log("operationDataFlat")
        //console.log(operationDataFlat)
        let operationDataUnFlat = {}
        let functionDataUnFlat = {}
        generalUtils.unflattenObject(operationDataUnFlat,operationDataFlat);
        generalUtils.unflattenObject(functionDataUnFlat,functionDataFlat)//never used
        let assembledData = {}
        for(const [key, value] of Object.entries(functionDataFlat)){
            // console.log("functionDataFlat")
            // console.log(functionDataFlat)
            // console.log("operationDataFlat")
            // console.log(operationDataFlat)
            // console.log("operationDataUnFlat")
            // console.log(operationDataUnFlat)
            // console.log("value")
            // console.log(value)
            const [isNormalString, actualString] = this.parseString(value)
            if(isNormalString){
                const providedData = operationDataFlat[actualString] !== undefined ? operationDataFlat[actualString] : generalUtils.getNestedObjectValue(operationDataUnFlat,actualString);
                if((providedData !== null)&&(providedData !== undefined)) generalUtils.createNestedObjectValue(assembledData,key,providedData);
                else{
                    // console.log("skipping " + value + " as " + providedData)
                    // console.log("operationDataFlat")
                    // console.log(operationDataFlat)
                    // console.log("operationDataUnFlat")
                    // console.log(operationDataUnFlat)
                }
            }
            else{
                //console.log("actualString")
                //console.log(actualString)
                generalUtils.createNestedObjectValue(assembledData,key,actualString)
            }
        }
        //console.log(operationData)
        //console.log(operationDataFlat)
        //console.log(assembledData)
        return assembledData
    }

    static async execFunction(fName, fDB=null ,fData=null ,fOutputManipulator=null){
        const errorReturn = {}
        if(this.#isExecutingFunction){
            nyqLog(preStr + "a function is already running")
            return errorReturn
        }
        this.#isExecutingFunction = true
        const requestedFunction = this.#getFunc(fName, fDB);
        if(requestedFunction === null){
            nyqLog(preStr + "cannot find function " + fName.toString(),"error")
            this.#isExecutingFunction = false
            return errorReturn;
        }
        let flattenOutputManipulator = {}
        if(fOutputManipulator !== null)
            generalUtils.flattenObject(flattenOutputManipulator,fOutputManipulator)
        else {
            const myKey = "stored." + fName.toString();
            flattenOutputManipulator[myKey] = "this"
        }
        let fDataUnflatten = {}
        if(fData !== null) {
            generalUtils.unflattenObject(fDataUnflatten,fData)
        }
        const [functionOutput, requestedSequenceElements] = await requestedFunction.run(fDataUnflatten,flattenOutputManipulator)
        this.#isExecutingFunction = false
        return [functionOutput, requestedSequenceElements]
    }

    static async execSequence(inputSequence, sequenceData){
        console.log("execSequence")
        console.log("inputSequence")
        console.log(inputSequence)
        console.log("sequenceData")
        console.log(sequenceData)
        const errorReturn = {}
        if(this.#isExecutingSequence){
            nyqLog(preStr + "a sequence is already running")
            return errorReturn
        }
        this.#isExecutingSequence = true
        let newSequencer = new c_Sequencer();
        for(const eachElement of inputSequence){
            newSequencer.addElement(eachElement);
        }
        //console.log("newSequencer")
        //console.log(newSequencer)
        newSequencer.startSequence();
        let currentElement = newSequencer.currentElement
        while(currentElement !== null){
            const assembledData = this.assembleFunctionData(currentElement.functionData,sequenceData);
            // console.log("executing function " + currentElement.functionName + " with assembledData:")
            // console.log(assembledData)
            const [functionOutput, requestedSequenceElements] = await this.execFunction(currentElement.functionName, currentElement.functionDB, assembledData, currentElement.outputManipulator);
            generalUtils.mergeObjectsByreference(sequenceData,functionOutput);
            for(const eachRequestedElement of requestedSequenceElements) newSequencer.addElement(eachRequestedElement)
            newSequencer.moveForward()
            currentElement = newSequencer.currentElement
        }
        this.#isExecutingSequence = false
        return sequenceData
    }
}

export {nyqFunctionEngine}