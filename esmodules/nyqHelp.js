import * as nyqGeneralConfig from "./nyqGeneralConfig.js"
import * as fileUtils from "./fileUtils.js"
import * as generalUtils from "./generalUtils.js"
import {enableLogging, disableLogging, toggleLogging, setLoggingLevel, nyqLog, toggleDebug, nyqIsDebugging, nyqDebug, debugOffForAll} from "./logging.js"
import * as nyqClasses from "./nyqClasses.js"

const symbolsObj = {
    container: "📁",
    c_tableSequence: "📅",
    c_functionSequence: "🧮",
    c_mapOp: "↹",
    add: '<i class="fa-regular fa-circle-right"></i>', // "⊞", //"✛"
    delete: '<i class="fa-solid fa-xmark"></i>',
}

const stepTypes = [
    {label: 'Table Operation', name: 'tableSequence'}, 
    {label: 'Function Sequence', name: 'functionSequence'}, 
    {label: 'Mapping Operation', name: 'mapOp'}
]

/************************************************************************************************
 * App for general use
 ***********************************************************************************/
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

async function pickFile(pathString, filePickerObj){
    //attached to the filePicker: this refers to the filePicker
    const dialogThis = filePickerObj.nyqCallerDialog
    const chain = dialogThis.chain
    const chainStepSelected = dialogThis.chainStepSelected
    const {stepType} = chain.reportStep(chainStepSelected)
    const nyqReqOp = filePickerObj.nyqReqOp
    //console.log(chain.reportStep(chainStepSelected))
    let renderList = []
    switch(stepType){
        case "c_tableSequence":
            switch(nyqReqOp){
                case "usedLibs":
                    renderList.push("tableSequence_usedLibs")
                    chain.steps[chainStepSelected].addUsedLib(pathString)
                    break
                case "usedFilterFiles":
                    renderList.push("tableSequence_usedFilterFiles")
                    chain.steps[chainStepSelected].addFilterFile(pathString)
                    break
            }
            break
    }
    await dialogThis.pleaseRender(renderList)
    //console.log("pickFile", pathString, filePickerObj, stepType, chain, chainStepSelected)
    return {pickFileResult: true}
}

async function actionHandler(event, target){
    /**this is executed within the app, this. is the dialog itself */
    //console.log("actionHandler called")
    const classString = target.getAttribute("Class")
    const targetId = target.getAttribute("id")
    const classList = classString.split(" ")
    let actionExecuted = false
    for(const eachClass of classList){
        //console.log(eachClass)
        switch(eachClass){
            case "pAddStep":
                const stepData = {
                    type: target.getAttribute("data-type"),
                    tableData: {},
                    position: target.getAttribute("data-position") == "-1" ? undefined : target.getAttribute("data-position")
                }
                this.addStep(stepData)
                actionExecuted = true
                break
            case "divChainStep":
                const stepIndex = target.getAttribute("data-index")
                this.setSelectedStep(stepIndex)
                actionExecuted = true
                break
            case "chainStepDelete":
                const stepIndexDelete = target.getAttribute("data-index")
                this.chain.deleteStep(stepIndexDelete)
                this.pleaseRender(['chain'])
                break
            case "tableSequenceHeaderButton":
                const tableSubform = target.getAttribute("data-tableSubform")
                this.setVisible(tableSubform.split("_").join("."),!this.getVisible(tableSubform))
                this.pleaseRender(nyqHelpUI.getSubParts("tableSequence"))
                break
            case "btnDeleteLib":
                if(this.chainStepSelected != -1){
                    const libPath = target.getAttribute("data-filePath")
                    this.chain.steps[this.chainStepSelected].removeUsedLib(libPath)
                }
                this.pleaseRender(["tableSequence_usedLibs"])
                break
            case "btnDeleteFilterFile":
                if(this.chainStepSelected != -1){
                    const filterPath = target.getAttribute("data-filePath")
                    this.chain.steps[this.chainStepSelected].removeFilterFile(filterPath)
                }
                this.pleaseRender(["tableSequence_usedFilterFiles"])
                break
            case "btnPickFile":
                if(this.chainStepSelected != -1){
                    let myFilePicker = new foundry.applications.apps.FilePicker.implementation({callback: pickFile})
                    //used to pass parameters to the picker funciton
                    myFilePicker.nyqCallerDialog = this;
                    switch(targetId){
                        case "btnPickFileUsedLibs":
                            myFilePicker.nyqReqOp = "usedLibs"
                            break
                        case "btnPickFileUsedFilterFile":
                            myFilePicker.extensions = [".js"]
                            myFilePicker.nyqReqOp = "usedFilterFiles"
                            break
                    }
                    const pickerResult = await myFilePicker.render(true)
                    console.log(pickerResult)
                }
                break
            case "tableSequenceHeaderStatusButton":
                if(this.chainStepSelected > -1){
                    switch(targetId){
                        case "preload":
                            await this.chain.steps[this.chainStepSelected].loadNeeded()
                            break
                        case "run":
                            await this.chain.steps[this.chainStepSelected].checkAndExec()
                            break
                    }
                }
                this.pleaseRender(['tableSequence_header'])
                break
            case "saveInitTableConfig":
                if(this.chainStepSelected > -1){
                    const configParams = this.element.querySelector('.initTableConfigParams') //by class
                    const isTableStored = configParams.querySelectorAll("#tableStored") // by id, 1 element
                    const tableName = configParams.querySelectorAll("#storedTableList") // by id, 1 element
                    for(const eachStored of isTableStored){
                        this.chain.steps[this.chainStepSelected].setInitTableIsStored(eachStored.checked)
                    }
                    for(const eachTableName of tableName){
                        this.chain.steps[this.chainStepSelected].setInitTableName(eachTableName.value)
                    }
                    console.log("configParams",configParams,"isTableStored",isTableStored,"tableName",tableName)
                    this.pleaseRender(["tableSequence_initTableConfig"])
                }
                break
        }
        if(actionExecuted) break;
    }
}

class nyqHelpUI extends HandlebarsApplicationMixin(ApplicationV2){
    chain = new nyqClasses.nyqChain
    chainStepSelected = -1
    uiData = {}
    constructor(initData = null){
        super()
        if(initData === null || initData === undefined) initData = {};
        if(initData.stepList !== undefined){
            for(const eachStep of initData.stepList){
                this.addStep(eachStep)
            }
        }
    }
    async pleaseRender(partList = []){
        this.render(
            {
                force: true,
                parts: partList,
            }
        )
    }
    visible = {
        header: true, chain: true, 
        tableSequence: {
            header: false,
            report: false,
            usedLibs: false,
            usedFilterFiles: false,
            initTableConfig: false,
            operationList: false,
            finalTable: false,
        }, 
        functionSequence: false, mapOp: false
    };
    getVisible(name){
        const actualPath = name.split('_');
        let actualVisible = this.visible;
        for(var i = 0; i < actualPath.length; i++){
            actualVisible = actualVisible[actualPath[i]]
        }
        return actualVisible;
    }
    setVisible(name, value){
        const actualPath = name.split(".")
        let objVisible = this.visible
        let myKey = actualPath[0];
        for(var i = 0; i < actualPath.length -1; i++){ 
            objVisible = objVisible[myKey]
            myKey = actualPath[i+1]
        }
        if(typeof objVisible[myKey] !== "object"){
            objVisible[myKey] = value
        }
        else{
            for(var key of Object.keys(objVisible[myKey])){
                objVisible[myKey][key] = key == 'header' ? value : false
            }
        }
    }
    updateSelectedChainElement(){
        if(this.chainStepSelected == -1){
            this.setVisible('tableSequence', false)
            this.setVisible('functionSequence', false)
            this.setVisible('mapOp', false)
            return
        }
        const {stepType} = this.chain.reportStep(this.chainStepSelected)
        switch(stepType){
            case "c_tableSequence":
                this.setVisible('tableSequence', true)
                this.setVisible('functionSequence', false)
                this.setVisible('mapOp', false)
                break;
            case "c_functionSequence":
                this.setVisible('tableSequence', false)
                this.setVisible('functionSequence', true)
                this.setVisible('mapOp', false)
                break
            case "c_mapOp":
                this.setVisible('tableSequence', false)
                this.setVisible('functionSequence', false)
                this.setVisible('mapOp', true)
                break
        }
    }
    addStep(stepData){
        this.chainStepSelected = this.chain.addStep(stepData)
        this.updateSelectedChainElement()
        this.pleaseRender(['chain', 'tableSequence', 'functionSequence', 'mapOp'])
    }
    setSelectedStep(index){
        this.chainStepSelected = this.chainStepSelected == index ? -1 : index
        this.updateSelectedChainElement()
        this.pleaseRender(['chain', 'tableSequence', 'functionSequence', 'mapOp'])
    }
    static PARTS = {
        header: { template: `${nyqGeneralConfig.nyqModPath}/templates/nyqHelpUI-header.hbs`},
        chain: {template: `${nyqGeneralConfig.nyqModPath}/templates/nyqHelpUI-chain.hbs`},
        tableSequence_header: {template: `${nyqGeneralConfig.nyqModPath}/templates/nyqHelpUI-tableSequence-header.hbs`},
        tableSequence_report: {template: `${nyqGeneralConfig.nyqModPath}/templates/nyqHelpUI-tableSequence-report.hbs`},
        tableSequence_usedLibs: {template: `${nyqGeneralConfig.nyqModPath}/templates/nyqHelpUI-tableSequence-usedLibs.hbs`},
        tableSequence_usedFilterFiles: {template: `${nyqGeneralConfig.nyqModPath}/templates/nyqHelpUI-tableSequence-usedFilterFiles.hbs`},
        tableSequence_initTableConfig: {template: `${nyqGeneralConfig.nyqModPath}/templates/nyqHelpUI-tableSequence-initTableConfig.hbs`},
        tableSequence_operationList: {template: `${nyqGeneralConfig.nyqModPath}/templates/nyqHelpUI-tableSequence-operationList.hbs`},
        tableSequence_finalTable: {template: `${nyqGeneralConfig.nyqModPath}/templates/nyqHelpUI-tableSequence-finalTable.hbs`},
        functionSequence: {template: `${nyqGeneralConfig.nyqModPath}/templates/nyqHelpUI-functionSequence.hbs`},
        mapOp: {template: `${nyqGeneralConfig.nyqModPath}/templates/nyqHelpUI-mapOp.hbs`},
    }
    static getSubParts(prefixString){
        let resList = []
        for(const [key, val] of Object.entries(this.PARTS)){
            const splitted = key.split("_")
            if(splitted[0] === prefixString) resList.push(splitted[1]);
        }
        return resList;
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
            actionHandler: actionHandler,
        }
    }
    _configureRenderOptions(options){
        super._configureRenderOptions(options);
        options.parts = [];
        options.parts.push('header');
        options.parts.push('chain')
        options.parts.push('tableSequence_header');
        options.parts.push('tableSequence_report');
        options.parts.push('tableSequence_usedLibs');
        options.parts.push('tableSequence_usedFilterFiles');
        options.parts.push('tableSequence_initTableConfig');
        options.parts.push('tableSequence_operationList');
        options.parts.push('tableSequence_finalTable');
        options.parts.push('functionSequence')
        options.parts.push('mapOp');
    }
    async _preparePartContext(partId, context){
        //console.log("prepare context for " + partId)
        context.hideMe = !this.getVisible(partId)
        context.symbols = symbolsObj
        const selectedStep = this.chainStepSelected == -1 ? {} : this.chain.reportStep(this.chainStepSelected)
        console.log("selectedStep",selectedStep)
        switch(partId){
            case 'header':
                break
            case 'chain':
                context.steps = []
                for(const [index, eachStep] of this.chain.steps.entries()){
                    let newStep = {
                        index: index,
                        type: eachStep.stepType,
                        readyToGo: eachStep.readyToGo,
                        executed: eachStep.executed,
                        selected: index == this.chainStepSelected ? true : false,
                        symbol: symbolsObj[eachStep.stepType],
                    }
                    context.steps.push(newStep)
                }
                context.possibleTypes = stepTypes
                context.chainContainerHeight = "nyqHeight100"
                context.chainBoxHeight = "nyqHeight90"
                break
            case 'tableSequence_header':
                context.stepType = "Table Sequence"
                context.buttonList = [
                    {
                        class: "tableSequenceHeaderButton", 
                        action: "actionHandler", 
                        id: "tableSequenceHeaderButtonReport",
                        tableSubform: "tableSequence_report",
                        dataEnabled: this.getVisible("tableSequence_report"),
                        faClass: "fa-regular fa-calendar-days",
                        text: "Report",
                    },
                    {
                        class: "tableSequenceHeaderButton", 
                        action: "actionHandler", 
                        id: "tableSequenceHeaderButtonUsedLibs",
                        tableSubform: "tableSequence_usedLibs",
                        dataEnabled: this.getVisible("tableSequence_usedLibs"),
                        faClass: "fa-regular fa-calendar-days",
                        text: "Used Libs",
                    },
                    {
                        class: "tableSequenceHeaderButton", 
                        action: "actionHandler", 
                        id: "tableSequenceHeaderButtonUsedFilterFiles",
                        tableSubform: "tableSequence_usedFilterFiles",
                        dataEnabled: this.getVisible("tableSequence_usedFilterFiles"),
                        faClass: "fa-regular fa-calendar-days",
                        text: "Used Filter Files",
                    },
                    {
                        class: "tableSequenceHeaderButton", 
                        action: "actionHandler", 
                        id: "tableSequenceHeaderButtonInitTableConfig",
                        tableSubform: "tableSequence_initTableConfig",
                        dataEnabled: this.getVisible("tableSequence_initTableConfig"),
                        faClass: "fa-regular fa-calendar-days",
                        text: "Init Table Config",
                    },
                    {
                        class: "tableSequenceHeaderButton", 
                        action: "actionHandler", 
                        id: "tableSequenceHeaderButtonOperationList",
                        tableSubform: "tableSequence_operationList",
                        dataEnabled: this.getVisible("tableSequence_operationList"),
                        faClass: "fa-regular fa-calendar-days",
                        text: "Operation List",
                    },
                    {
                        class: "tableSequenceHeaderButton", 
                        action: "actionHandler", 
                        id: "tableSequenceHeaderButtonFinalTable",
                        tableSubform: "tableSequence_finalTable",
                        dataEnabled: this.getVisible("tableSequence_finalTable"),
                        faClass: "fa-regular fa-calendar-days",
                        text: "Final Table",
                    },
                ]
                context.needsPreload = selectedStep.needsPreload !== undefined ? selectedStep.needsPreload : true
                context.runnable = selectedStep.readyToGo !== undefined && selectedStep.executed !== undefined
                    ? selectedStep.readyToGo && !selectedStep.executed : false
                context.actionFunction = "actionHandler"
                break
            case "tableSequence_usedLibs":
                context.boxDimensionClass = "heightSmall";
                if(selectedStep.usedLibs !== undefined) context.usedLibs = selectedStep.usedLibs;
                break
            case "tableSequence_usedFilterFiles":
                context.boxDimensionClass = "heightSmall";
                if(selectedStep.usedFilterFiles !== undefined) context.usedFilterFiles = selectedStep.usedFilterFiles
                break
            case "tableSequence_initTableConfig":
                context.tableStored = selectedStep.initTableStored !== undefined ? selectedStep.initTableStored : true
                if(selectedStep.availableTables !== undefined){
                    const currentTableName = selectedStep.initTableName !== undefined ? selectedStep.initTableName : ""
                    //console.log(selectedStep.availableTables)
                    context.storedTableList = []
                    for(const eachStoredTable of selectedStep.availableTables){
                        context.storedTableList.push(
                            {
                                path: eachStoredTable,
                                selected: eachStoredTable === currentTableName ? true : false,
                            }
                        )
                    }
                }
                context.actionFunction = "actionHandler"
                if(selectedStep.stepType !== undefined && selectedStep.stepType === "c_tableSequence"){
                    const initTablePreview = await this.chain.steps[this.chainStepSelected].previewInitTable()
                    if(initTablePreview !== null) context.initTablePreview = initTablePreview;
                }
                break
            case 'functionSequence':
                break
            case 'mapOp':
                break
        }
        //console.log(context)
        return context
    }
}

function showUI(initdata){
    let myUI = new nyqHelpUI(initdata = null)
    myUI.render(true)
}

export { showUI }