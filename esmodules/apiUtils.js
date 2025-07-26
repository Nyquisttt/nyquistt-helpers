import * as nyqGeneralConfig from './nyqGeneralConfig.js';
import * as generalUtils from './generalUtils.js'
import {nyqLog} from './logging.js'
const identityString = "apiUtils"

//const apiName = nyqGeneralConfig.apiName;
const apiConnectionName = nyqGeneralConfig.apiConnectionName;
let apiConnection = {};

function createApi(){
    nyqLog("creating the api " + nyqGeneralConfig.apiName, identityString)
    nyqLog("the api connector is " + apiConnectionName, identityString)
    apiConnection = eval(apiConnectionName);
    apiConnection[nyqGeneralConfig.apiName] = {};
}

/**
 * 
 * @param {string} pathString 
 * @param {object} apiObject 
 */
function addToApi(pathString, apiObject){
    if((!apiConnection) || (!apiConnection[nyqGeneralConfig.apiName])) createApi();
    nyqLog("adding " + pathString + " to the api.", identityString)
    const theKeysPath = pathString.split('.');
    let newObj = apiConnection[nyqGeneralConfig.apiName];
    for(var i = 0; i < theKeysPath.length-1; i++){
        if(theKeysPath[i] === ""){
            continue
        }
        if(!newObj[theKeysPath[i]]){
            newObj[theKeysPath[i]] = {};
        }
        newObj = newObj[theKeysPath[i]];
    }
    if(theKeysPath[theKeysPath.length-1].length > 0){
        newObj[theKeysPath[theKeysPath.length-1]] = apiObject;
    }
    else{
        for(const [key,value] of Object.entries(apiObject)){
            newObj[key] = value
        }
    }
}

function getFromApi(pathString){
    nyqLog("extracting " + pathString + " from the api.", identityString)
    if((!apiConnection) || (!apiConnection[nyqGeneralConfig.apiName])) return {};
    const theKeysPath = pathString.split('.');
    let newObj = apiConnection[nyqGeneralConfig.apiName];
    for(var i = 0; i < theKeysPath.length-1; i++){
        if(!newObj[theKeysPath[i]]){
            return {};
        }
        newObj = newObj[theKeysPath[i]];
    }
    return newObj;
}

function searchInApi(pathString){
    nyqLog("searching " + pathString + " into the api", identityString);
    return generalUtils.searchNestedObjectValue(apiConnection[nyqGeneralConfig.apiName],pathString,false);
}

function getApiRoot(){
    return apiConnection[nyqGeneralConfig.apiName];
}

let importedModules = []

/**
 * 
 * @param {string} filePath 
 * @param {string} moduleApiName 
 * @returns Module
 * 
 */
async function dynamicModule(filePath,moduleApiName){
    if((typeof filePath !== 'string')&&(typeof moduleApiName !== 'string')){
        nyqLog("you must provide a string with the path of the module",identityString,"error")
        return null
    }
    const alreadyImportedList = importedModules.filter(
        (value, index, array) => {
            return value.filePath === filePath
        }
    )
    if(alreadyImportedList.length > 0){
        nyqLog("this module has already been imported",identityString,"warn")
        return getApiRoot()[alreadyImportedList[0].moduleApiName]
    }
    const newModule = await import(nyqGeneralConfig.importRoot + filePath);
    addToApi(moduleApiName, newModule)
    importedModules.push({filePath: filePath, moduleApiName: moduleApiName})
    return newModule
}

/**
 * world settings for known modules to be loaded dynamically
 */
let knownModules = [ //this is only used the first time the module is loaded
    {moduleName: 'encounterHelper', filePath: 'modules/nyquistt-helpers/esmodules/encounterHelper.js', moduleApiName: ''},
    {moduleName: 'createCharacter2024', filePath: 'modules/nyquistt-helpers/esmodules/createCharacter2024.js', moduleApiName: 'createCharacter2024'},
    {moduleName: 'treasureHelper', filePath: 'modules/nyquistt-helpers/esmodules/treasureHelper.js', moduleApiName: ''},
    {moduleName: 'magicItemTracker', filePath: 'modules/nyquistt-helpers/esmodules/magicItemTracker.js', moduleApiName: 'magicItemTracker'},
]

/**
 * only loads known modules (addded through the settings)
 * @param {string} moduleName 
 */
async function loadModule(moduleName) {
    const filteredList = knownModules.filter(
        (value,index,array) => {
            return value.moduleName === moduleName
        }
    )
    if(filteredList.length !== 1){
        nyqLog("cannot understand what module you want",identityString)
        return null
    }
    const loadedModule = await dynamicModule(filteredList[0].filePath,filteredList[0].moduleApiName)
    return loadedModule
}


/**
 * Creating the menu for setting knownModules
 */
//const {nyqModPath, apiName, moduleId} = nyqGeneralConfig.getApiParameters() //cannot call this before setup phase

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api
class settingsMenuApp extends HandlebarsApplicationMixin(ApplicationV2){
    static newKnownModules = [];    //the list shown in the dialog, not always in sync with the knownModules variable
    static IamInitialized = false
    static async getSettings(){
        this.newKnownModules = []
        const storedKnownModules = await game.settings.get('nyquistt-helpers',"knownModules")
        for(const eachKnown of storedKnownModules){
            this.newKnownModules.push({moduleName: eachKnown.moduleName, moduleApiName: eachKnown.moduleApiName, filePath: eachKnown.filePath})
        }
        knownModules = this.newKnownModules
    }
    static async initMe(){
        await this.getSettings()
        this.IamInitialized = true
    }
    static async pickFile(pathString, filePickerObj){
        //attached to the filePicker: this refers to the filePicker and not to the class
        let fileName = ""
        const slashPos = pathString.lastIndexOf("/")
        if(slashPos > -1){
            fileName = pathString.slice(slashPos+1)
        }
        else fileName = pathString
        const dotPos = fileName.lastIndexOf(".")
        if(dotPos > -1) fileName = fileName.slice(0,dotPos);
        settingsMenuApp.newKnownModules.push({moduleName: fileName, filePath: pathString, moduleApiName: fileName})
        await filePickerObj.nyqCaller.pleaseRender(['knownModulesList'])
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
        const clickedElement = target.getAttribute("Class");
        switch(clickedElement){
            case "btnDeleteModule":
                settingsMenuApp.newKnownModules.splice(parseInt(target.getAttribute("data-id")),1)
                this.pleaseRender(['knownModulesList'])
                break
            case "btnPickFile":
                let myFilePicker = new foundry.applications.apps.FilePicker.implementation({callback: settingsMenuApp.pickFile})
                //used to pass the this of the caller dialog to the picker funciton
                myFilePicker.nyqCaller = this
                myFilePicker.extensions = [".js"]
                const pickerResult = await myFilePicker.render(true)
                console.log(pickerResult)
                //this.render(true)
                break
            case "btnUpdateKnownModules":
                let html_newKnownModules = [];
                const moduleNameList = this.element.querySelectorAll('.inputModuleName')
                for(const eachElement of moduleNameList){
                    html_newKnownModules[parseInt(eachElement.getAttribute("data-id"))] = {moduleName: eachElement.value}
                }
                const filePathList = this.element.querySelectorAll('.inputFilePath')
                for(const eachElement of filePathList){
                    html_newKnownModules[parseInt(eachElement.getAttribute('data-id'))].filePath = eachElement.value
                }
                const moduleApiNameList = this.element.querySelectorAll('.inputModuleApiName')
                for(const eachElement of moduleApiNameList){
                    html_newKnownModules[parseInt(eachElement.getAttribute('data-id'))].moduleApiName = eachElement.value
                }
                console.log("newKnownModules")
                console.log(html_newKnownModules)
                await game.settings.set('nyquistt-helpers',"knownModules",html_newKnownModules)
                //knownModules = html_newKnownModules
                settingsMenuApp.IamInitialized = false  //quite useless
                await settingsMenuApp.initMe()
                this.pleaseRender()
                //this.render(true)
                break
        }
    }
    static PARTS = {
		header: { template: `${nyqGeneralConfig.nyqModPath}/templates/settings-apiUtils-header.hbs`},
		knownModulesList: {template: `${nyqGeneralConfig.nyqModPath}/templates/settings-apiUtils-known-modules.hbs`},
        pickNewModule: {template: `${nyqGeneralConfig.nyqModPath}/templates/settings-apiUtils-pickFile.hbs`},
        footer: {template: `${nyqGeneralConfig.nyqModPath}/templates/settings-apiUtils-footer.hbs`},
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
			myAction: settingsMenuApp.myAction
		}
	}
    _configureRenderOptions(options){
		super._configureRenderOptions(options);
		options.parts = [];
		options.parts.push('header');
        options.parts.push('knownModulesList');
        options.parts.push('pickNewModule')
        options.parts.push('footer')
	}
    async _preparePartContext(partId, context){
        switch(partId){
            case 'header':
                context = {apiName: nyqGeneralConfig.apiName}
                break
            case 'knownModulesList':
                if(!settingsMenuApp.IamInitialized) settingsMenuApp.initMe();
                context = {
                    boxDimensionClass: "heightSmall",
                    knownModules: settingsMenuApp.newKnownModules,
                }
                break
            case 'pickNewModule':
                break
            case 'footer':
                break
        }
        return context
    }
}

Hooks.on("init", async function(){
    /**
     * as it seems, settings must be registered at any init of the environment
     * their content is persistent but the game.settings does not mantain previously registered settings
     */
    const knownModulesData = {
        name: "Known Sub-Modules",
        hint: "the list of known sub-modules and their location (on disk and within the API)",
        scope: "world",      // This specifies a world-level setting
        config: false,        // This specifies that the setting appears in the configuration view
        requiresReload: false, // This will prompt the GM to have all clients reload the application for the setting to take effect
        default: [
            {moduleName: 'encounterHelper', filePath: 'modules/nyquistt-helpers/esmodules/encounterHelper.js', moduleApiName: ''},
            {moduleName: 'createCharacter2024', filePath: 'modules/nyquistt-helpers/esmodules/createCharacter2024.js', moduleApiName: 'createCharacter2024'},
            {moduleName: 'treasureHelper', filePath: 'modules/nyquistt-helpers/esmodules/treasureHelper.js', moduleApiName: ''},
            {moduleName: 'magicItemTracker', filePath: 'modules/nyquistt-helpers/esmodules/magicItemTracker.js', moduleApiName: 'magicItemTracker'},
        ],
        onChange: value => {
            console.log("Known Module List has been changed:")
            console.log(value)
        },
        type: new foundry.data.fields.ArrayField(new foundry.data.fields.ObjectField, {nullable: false})
    }
    await game.settings.register(nyqGeneralConfig.moduleId, 'knownModules', knownModulesData)
    const menuData = {
        name: "Sub-modules Menu",
        label: "Sub-modules",
        hint: 'Here you will be able to change the list of known sub-modules',
        icon: "fa-solid fa-user-plus",
        restricted: true,
        type: settingsMenuApp,
    }
    game.settings.registerMenu(nyqGeneralConfig.moduleId, "settingsMenu", menuData)
})

Hooks.on("setup", function(){
    knownModules = game.settings.get('nyquistt-helpers',"knownModules")
})

export {createApi, addToApi, getFromApi, searchInApi, getApiRoot, dynamicModule, loadModule}