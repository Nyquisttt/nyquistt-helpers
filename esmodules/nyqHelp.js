import { nyqTables } from "./nyqTables";
import { nyqSequencer } from "./nyqSequencer";
import * as nyqGeneralConfig from "./nyqGeneralConfig"
import * as fileUtils from "./fileUtils"
import * as generalUtils from "./generalUtils"
import {enableLogging, disableLogging, toggleLogging, setLoggingLevel, nyqLog, toggleDebug, nyqIsDebugging, nyqDebug, debugOffForAll} from "logging.js"

class c_nyqChainElement{
    get readyToGo(){}
    get executed(){}
    report(){}
    stringify(){}
    async checkAndExec(){}
}

class c_tableSequence extends c_nyqChainElement{
    identityString = "c_tableSequence"
    id = ""
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
    constructor(tableData){
        /**only using sync methods here */
        this.id = generalUtils.UUIDv4()
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
        this.addUsedLib(tableData.usedLibs)
        this.addFilterFile(tableData.usedFilterFiles)
        this.addOperation(tableData.operationList)
        this.addoperationDataRedux(tableData.operationDataRedux)
        this.setInitTableName(tableData.initTableName)
        this.setInitTableIsStored(tableData.initTableStored)
        this.setInitTable(tableData.initTable)
        this.clearFinalTable()
    }
    report(){
        return {
            id: this.id,
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
        }
    }
    stringify(){
        return JSON.stringify({
            id: this.id,
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
        })
    }
    get readyToGo(){
        return !this.initTableIsUnset && !this.usedLibsNeedLoading && !this.usedFilterFilesNeedLoading
    }
    get executed(){
        return !this.finalTableIsUnset
    }
    async checkAndExec(){
        await this.loadNeeded()
        this.updateoperationDataRedux()
        await this.computeInitTable()
        await this.exec()
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
    clearInitTable(){
        this.initTable = new Promise(
            (resolve, reject) => {
                this.#initTableResolve = resolve
                this.#initTableReject = reject
            }
        )
    }
    clearFinalTable(){
        this.finalTable = new Promise(
            (resolve, reject) => {
                this.#finalTableResolve = resolve
                this.#finalTableReject = reject
            }
        )
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
        if(libList === undefined) return
        if(!Array.isArray(libList)) libList = [libList];
        for(const eachLib of libList){
            if(!this.usedLibs.includes(eachLib)){
                this.usedLibs.push(eachLib)
            }
        }
        this.usedLibsNeedLoading = true
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
            }
        }
        this.usedFilterFilesNeedLoading = true
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
}

class c_functionSequence extends c_nyqChainElement{
    get readyToGo(){}
    get executed(){}
    report(){}
    stringify(){}
    async checkAndExec(){}
}

class c_mapOp extends c_nyqChainElement{
    get readyToGo(){}
    get executed(){}
    report(){}
    stringify(){}
    async checkAndExec(){}
}

class nyqChain{
    /**@type {Array.<c_tableSequence|c_functionSequence|c_mapOp>} */
    chain = []
}



