import * as nyqGeneralConfig from './nyqGeneralConfig.js';
import * as generalUtils from './generalUtils.js'
import {nyqLog} from './logging.js'
const logPreStr = '[NYQUISTT apiUtils]: ';

const apiName = nyqGeneralConfig.apiName;
const apiConnectionName = nyqGeneralConfig.apiConnectionName;
let apiConnection = {};

function createApi(){
    nyqLog(logPreStr + "creating the api " + apiName)
    nyqLog(logPreStr + "the api connector is " + apiConnectionName)
    apiConnection = eval(apiConnectionName);
    apiConnection[apiName] = {};
}

function addToApi(pathString, apiObject){
    if((!apiConnection) || (!apiConnection[apiName])) createApi();
    nyqLog(logPreStr + "adding " + pathString + " to the api.")
    const theKeysPath = pathString.split('.');
    let newObj = apiConnection[apiName];
    for(var i = 0; i < theKeysPath.length-1; i++){
        if(!newObj[theKeysPath[i]]){
            newObj[theKeysPath[i]] = {};
        }
        newObj = newObj[theKeysPath[i]];
    }
    newObj[theKeysPath[theKeysPath.length-1]] = apiObject;
}

function getFromApi(pathString){
    nyqLog(logPreStr + "extracting " + pathString + " from the api.")
    if((!apiConnection) || (!apiConnection[apiName])) return {};
    const theKeysPath = pathString.split('.');
    let newObj = apiConnection[apiName];
    for(var i = 0; i < theKeysPath.length-1; i++){
        if(!newObj[theKeysPath[i]]){
            return {};
        }
        newObj = newObj[theKeysPath[i]];
    }
    return newObj;
}

function searchInApi(pathString){
    nyqLog(logPreStr + "searching " + pathString + " into the api");
    return generalUtils.searchNestedObjectValue(apiConnection[apiName],pathString,false);
}

function getApiRoot(){
    return apiConnection[apiName];
}

let importedModules = []

async function dynamicModule(filePath,moduleName){
    if((typeof filePath !== 'string')&&(typeof apiName !== 'string')){
        nyqLog(logPreStr + "you must provide a string with the path of the module","error")
        return null
    }
    const alreadyImportedList = importedModules.filter(
        (value, index, array) => {
            return value.filePath === filePath
        }
    )
    if(alreadyImportedList.length > 0){
        nyqLog(logPreStr + "this module has already been imported","warn")
        return getApiRoot()[alreadyImportedList[0].moduleName]
    }
    const newModule = await import(nyqGeneralConfig.importRoot + filePath);
    addToApi(moduleName, newModule)
    importedModules.push({filePath: filePath, moduleName: moduleName})
    return newModule
}

export {createApi, addToApi, getFromApi, searchInApi, getApiRoot, dynamicModule}