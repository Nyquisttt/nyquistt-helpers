import * as generalUtils from './generalUtils.js'
import { nyqTables } from "./nyqTables.js";
import { nyqSequencer } from "./nyqSequencer.js";

/**
 * this module provides the definition of utilities classes used by nyquistt-helpers
 * generally speaking the module works on a nyqChain object which is a list of singleStep objects
 * each singleStep is either a c_tableSequence (atomic operation of nyqTables), a c_functionSequence (atomic operation of nyqSequencer) or a c_mapOp (mapping operation for data)
 */

/**
 * this is the main (most general) object used by nyquistt-helpers
 *      steps: the array of singleStep objects
 *      addStep: function, used to add a new step to the list
 *      getStatus(index): function, used to get the status of a singleStep
 *      reportStep(index): function, used to get an object containing all the relevant properties of a singleStep
 *      checkAndExec(index): function, used to run the singleStep element of the list
 */
class nyqChain{
    /**@type {Array.<singleStep>} */
    steps = []
    stepSelected = -1;
    constructor(){
        this.steps = []
        this.stepSelected = -1;
    }
    /**
     * 
     * @param {object} stepData 
     * @param {string} stepData.type
     * @param {object} stepData.tableData
     * @returns 
     */
    addStep(stepData){
        let newSingleStep
        switch(stepData.type){
            case "tableSequence":
                if(stepData.tableData === undefined){stepData.tableData = {}}
                newSingleStep = new c_tableSequence(stepData.tableData)
                //newSingleStep.stepType = "tableSequence"
                break
        }
        newSingleStep.inputData = stepData
        const newPosition = stepData.position !== undefined ? stepData.position : this.steps.length
        if(newPosition >= this.steps.length) this.steps[newPosition] = newSingleStep
        else this.steps.splice(newPosition, 0, newSingleStep)
        return newPosition
    }
    deleteStep(index){
        if(this.steps.length > index){
            this.steps.splice(index, 1)
        }
    }
    getStatus(index){
        if(this.steps[index] === undefined) return  {result: "error", message: "index not found"}
        return {readyToGo: this.steps[index].readyToGo, executed: this.steps[index].executed}
    }
    reportStep(index){
        if(this.steps[index] === undefined) return  {result: "error", message: "index not found"}
        return this.steps[index].report()
    }
    checkAndExec(index){
        if(this.steps[index] === undefined) return  {result: "error", message: "index not found"}
        this.steps[index].checkAndExec()
    }
}

class singleStep{
    /** @type {string} */
    stepType = "unknown"
    inputData = null
    outputData = null
    get needsPreload(){
        return true
    }
    get readyToGo(){
        return false
    }
    get executed(){
        return false
    }
    async makeReady(){}
    report(){
        return {id: null}
    }
    stringify(){
        return JSON.stringify({id: null})
    }
    async exec(){}
    async checkAndExec(){
        if(!this.readyToGo) await this.makeReady();
        if(!this.executed && this.readyToGo) await this.exec();
    }
}


class c_tableSequence extends singleStep{
    stepType = "c_tableSequence"
    identityString = "c_tableSequence"
    id = ""
    inputData = {}
    usedLibs = []
    usedFilterFiles = []
    initTable;
    finalTable;
    initTableName = ""
    initTableStored = true
    operationDataRedux = {}
    operationList = []
    #initTableResolve;
    #initTableReject;
    #finalTableResolve;
    #finalTableReject;
    initTableIsUnset = true
    finalTableIsUnset = true 
    usedLibsNeedLoading = false
    usedFilterFilesNeedLoading = false
    inputDataNeedUpdating = false
    objectify(){
        return {
            stepType: this.stepType,
            id: this.id,
            inputData: this.inputData,
            usedLibs: this.usedLibs,
            usedFilterFiles: this.usedFilterFiles,
            initTable: this.initTable,
            initTableName: this.initTableName,
            initTableStored: this.initTableStored,
            operationList: this.operationList,
            operationDataRedux: this.operationDataRedux,
            finalTable: this.finalTable,
            usedLibsNeedLoading: this.usedLibsNeedLoading,
            usedFilterFilesNeedLoading: this.usedFilterFilesNeedLoading,
            initTableIsUnset: this.initTableIsUnset,
            finalTableIsUnset: this.finalTableIsUnset,
            /* results of the getters */
            needsPreload: this.needsPreload,
            readyToGo: this.readyToGo,
            executed: this.executed,
            availableTables: this.availableTables,
        }
    }
    report(){
        return this.objectify()
    }
    stringify(){
        return JSON.stringify(this.objectify())
    }
    get needsPreload(){
        return this.usedLibsNeedLoading || this.usedFilterFilesNeedLoading
    }
    get readyToGo(){
        return !this.initTableIsUnset && !this.usedLibsNeedLoading && !this.usedFilterFilesNeedLoading
    }
    get executed(){
        return !this.finalTableIsUnset
    }
    get availableTables(){
        return nyqTables.getTableOfType("*")
    }
    constructor(tableData){
        /**only using sync methods here */
        super()
        this.inputData = tableData
        this.id = generalUtils.UUIDv4()
        this.setProperties()
    }
    setProperties(){
        /**only using sync methods here */
        this.initTable = new Promise(
            (resolve, reject) => {
                this.#initTableResolve = resolve
                this.#initTableReject = reject
            }
        )
        this.finalTable = new Promise(
            (resolve, reject) => {
                this.#finalTableResolve = resolve
                this.#finalTableReject = reject
            }
        )
        //console.log(this)
        this.addUsedLib(this.inputData.usedLibs)
        this.addFilterFile(this.inputData.usedFilterFiles)
        this.addOperation(this.inputData.operationList)
        this.addoperationDataRedux(this.inputData.operationDataRedux)
        this.setInitTableName(this.inputData.initTableName)
        this.setInitTableIsStored(this.inputData.initTableStored)
        this.setInitTable(this.inputData.initTable)
        this.clearFinalTable()
    }
    async checkAndExec(){
        await this.makeReady()
        await this.exec()
    }
    async makeReady(){
        await this.loadNeeded()
        this.updateoperationDataRedux()
        await this.computeInitTable()
    }
    async exec(){
        if(!this.readyToGo) return;
        let operationData = {
            operationList: this.operationList
        }
        for(const [key, value] of Object.entries(this.operationDataRedux)){
            operationData[key] = value
        }
        const operatedTable = await nyqTables.getFromTable(this.initTable,operationData,false)
        this.#finalTableResolve(operatedTable)
        this.finalTableIsUnset = false
    }
    async loadNeeded(){
        if(this.usedLibsNeedLoading){
            for(const eachLib of this.usedLibs) await nyqTables.checkLibrary(eachLib);
            this.usedLibsNeedLoading = false
        }
        if(this.usedFilterFilesNeedLoading){
            for(const eachFilterFile of this.usedFilterFiles) await nyqTables.checkFilterLibrary(eachFilterFile);
            this.usedFilterFilesNeedLoading = false
        }
    }
    updateoperationDataRedux(){
        const availableFilters = nyqTables.availableFilters()
        for(const eachOperation of this.operationList){
            const possibleChosenOperation = availableFilters.filter(
                (value, index, array) => {
                    return value.name == eachOperation
                }
            )
            if(possibleChosenOperation.length > 0){
                for(const eachRequired of possibleChosenOperation[0].requiredEachStep){
                    if(this.operationDataRedux[eachRequired] === undefined){
                        this.operationDataRedux[eachRequired] = []
                    }
                }
            }
        }
    }
    async previewInitTable(){
        if(!this.initTableStored && this.initTableIsUnset) return null;
        if(this.initTableStored && !nyqTables.checkTablePath(this.initTableName).check) return null;
        const resTable = this.initTableStored ? 
            await nyqTables.getWholeTable(this.initTableName) :
            this.initTable
        return resTable
    }
    setInitTable(table, name = ""){
        if(table === undefined) return;
        if(!this.initTableIsUnset) return;
        if(!Array.isArray(table)) table = [table];
        this.initTableStored = false
        this.#initTableResolve(table)
        this.initTableIsUnset = false
        this.initTableName = name
    }
    async computeInitTable(){
        if(!this.initTableStored) return;
        if(!this.initTableIsUnset) return
        if(this.usedLibsNeedLoading || this.usedFilterFilesNeedLoading) return;
        const tableExist = nyqTables.checkTablePath(this.initTableName).check
        if(!tableExist){
            this.#initTableReject("table does not exist")
            this.initTableIsUnset = true
            return;
        }
        const wholeTable = await nyqTables.getWholeTable(this.initTableName)
        this.#initTableResolve(wholeTable)
        this.initTableIsUnset = false
        this.initTableStored = false
    }
    clearInitTable(){
        this.initTable = new Promise(
            (resolve, reject) => {
                this.#initTableResolve = resolve
                this.#initTableReject = reject
            }
        )
        this.initTableIsUnset = true
    }
    clearFinalTable(){
        this.finalTable = new Promise(
            (resolve, reject) => {
                this.#finalTableResolve = resolve
                this.#finalTableReject = reject
            }
        )
        this.finalTableIsUnset = true
    }
    setInitTableName(tableName){
        if(tableName !== undefined && typeof tableName === 'string'){
            this.initTableName = tableName
            this.clearInitTable()
        }
    }
    setInitTableIsStored(stored = true){
        if(stored !== undefined && typeof stored === 'boolean'){
            this.initTableStored = stored
            this.clearInitTable()
        }
    }
    /**
     * 
     * @param {string[]} libList 
     */
    addUsedLib(libList){
        //console.log("addUsedLib",libList)
        if(typeof this.inputData.usedLibs === undefined) this.inputData.usedLibs = []
        if(libList === undefined) return
        if(!Array.isArray(libList)) libList = [libList];
        for(const eachLib of libList){
            if(!this.usedLibs.includes(eachLib)){
                this.usedLibs.push(eachLib)
                this.usedLibsNeedLoading = true
                this.inputDataNeedUpdating = true
            }
        }
    }
    /**
     * 
     * @param {string} libPath 
     */
    removeUsedLib(libPath){
        let foundIndex = -1
        for(var i = 0; i < this.usedLibs.length; i++){
            if(this.usedLibs[i] == libPath){
                foundIndex = i
                break
            }
        }
        if(foundIndex != -1) {
            this.usedLibs.splice(foundIndex, 1)
            this.inputDataNeedUpdating = true
        };
        //console.log("removeUsedLib",libPath, foundIndex)
    }
    /**
     * 
     * @param {string[]} filterFileList 
     */
    addFilterFile(filterFileList){
        if(filterFileList === undefined) return;
        if(!Array.isArray(filterFileList)) filterFileList = [filterFileList];
        for(const eachFilterFile of filterFileList){
            if(!this.usedFilterFiles.includes(eachFilterFile)){
                this.usedFilterFiles.push(eachFilterFile)
                this.usedFilterFilesNeedLoading = true
                this.inputDataNeedUpdating = true
            }
        }
    }
    /**
     * 
     * @param {string} filePath 
     */
    removeFilterFile(filePath){
        let foundIndex = -1;
        for(var i = 0; i < this.usedFilterFiles.length; i++){
            if(this.usedFilterFiles[i] == filePath){
                foundIndex = i;
                break
            }
        }
        if(foundIndex > -1){
            this.usedFilterFiles.splice(foundIndex, 1);
            this.inputDataNeedUpdating = true
        }
    }
    /**
     * 
     * @param {string[]} operationList 
     */
    addOperation(operationList){
        if(operationList === undefined) return;
        const availableFilters = nyqTables.availableFilters()
        if(!Array.isArray(operationList)) operationList = [operationList];
        for(const eachOperation of operationList){
            this.operationList.push(eachOperation) //even if the operation is yet unknown (as well as its required) it is added to the operation list of the table sequence
            const possibleChosenOperation = availableFilters.filter(
                (value, index, array) => {
                    return value.name == eachOperation
                }
            )
            if(possibleChosenOperation.length == 0){
                nyqLog("skipping unknown operation " + eachOperation,this.identityString,"warn")
                continue;
            }
            const requiredEachStep = possibleChosenOperation[0].requiredEachStep
            for(const eachRequired of requiredEachStep){
                if(this.operationDataRedux[eachRequired] === undefined){
                    this.operationDataRedux[eachRequired] = []
                }
            }
        }
    }
    /**
     * 
     * @param {object} operationDataRedux 
     */
    addoperationDataRedux(operationDataRedux){
        if(operationDataRedux === undefined) return;
        for(const [key, value] of Object.entries(operationDataRedux)){
            if(this.operationDataRedux[key] === undefined) this.operationDataRedux[key] = value;
            else{
                if(!Array.isArray(this.operationDataRedux[key])) this.operationDataRedux[key] = [this.operationDataRedux[key]];
                this.operationDataRedux[key].push(value);
            }
        }
    }
}

class c_functionSequence extends singleStep{
    stepType = "c_functionSequence"
    /* 
    get needsPreload(){}
    get readyToGo(){}
    get executed(){}
    report(){}
    stringify(){}
    async checkAndExec(){} */
}

class c_mapOp extends singleStep{
    stepType = "c_mapOp"
    /* 
    get needsPreload(){}
    get readyToGo(){}
    get executed(){}
    report(){}
    stringify(){}
    async checkAndExec(){} */
}

export {nyqChain, singleStep, c_tableSequence, c_functionSequence, c_mapOp}