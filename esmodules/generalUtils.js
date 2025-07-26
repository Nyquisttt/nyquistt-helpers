import * as nyqGeneralConfig from './nyqGeneralConfig.js';
import {nyqLog, nyqIsDebugging, nyqDebug} from './logging.js';

const preStr = "[generalUtils] ";
const identityString = "generalUtils"

function thisDebug(...params){
    nyqDebug(identityString, ...params)
}

function createCopy(myObj){
    return JSON.parse(JSON.stringify(myObj));
}

function checkStringForArray(inputString){
    const bracketClose = inputString.indexOf("]")
    if(bracketClose != inputString.length-1)
        return [false, null, null]
    const bracketOpen = inputString.indexOf("[")
    if(bracketOpen == -1)
        return [false, null, null]
    const arrName = inputString.slice(0,bracketOpen)
    const arrIndex = inputString.slice(bracketOpen+1,bracketClose)
    return [true, arrName, arrIndex]
}

function createNestedObjectValue(theObject, keyString, actualValue){	//SYNC all values must be synced
    //console.log("createNestedObject")
    //console.log("keystring")
    //console.log(keyString)
    //console.log("initial object")
    //console.log(JSON.stringify(theObject))
    if(!theObject) theObject = {};
    const theKeysPath = keyString.split('.');
    let newObj = theObject;
    for(var i = 0; i < theKeysPath.length-1; i++){
        //console.log("keyPath:")
        //console.log(theKeysPath[i])
        //search for array
        const [isArray, arrName, arrIndex] = checkStringForArray(theKeysPath[i])
        if(isArray){
            if(!newObj[arrName]) newObj[arrName] = []; //the array does not exists
            if(newObj[arrName].length <= arrIndex){ //the index does not exist
                newObj[arrName].splice(arrIndex,0,{})
            }
            newObj = newObj[arrName][arrIndex];
        }
        else {
            if(!newObj[theKeysPath[i]]) newObj[theKeysPath[i]] = {};
            newObj = newObj[theKeysPath[i]];
        }
        //console.log("current pointer:")
        //console.log(JSON.stringify(newObj))
    }
    const [isArray, arrName, arrIndex] = checkStringForArray(theKeysPath[theKeysPath.length-1])
    if(isArray){
        if(!newObj[arrName]) newObj[arrName] = []
        newObj[arrName].splice(arrIndex,0,actualValue)
    }
    else{
        newObj[theKeysPath[theKeysPath.length-1]] = actualValue;
    }
    //console.log("final object:")
    //console.log(JSON.stringify(theObject))
    return theObject;
}

function mapUsingMapObject(mapObject,inputDataObject,outputDataObject){
    thisDebug("[mapUsingMapObject]")
    thisDebug("mapObject",mapObject,"inputDataObject",inputDataObject,"outputDataObject",outputDataObject)
    /*
    * modifiers: 
    * "nyqPtr."     the remaining part of the string is a pointer to a position into dataObject
    * "nyqJSON."    the remaining part of the string must be JSON.parse-d 
    * "nyqKeep."    the remaining part of the string is the actual value to put into dataObject
    */
    let flattenedMap = {}
    flattenObject(flattenedMap, mapObject)
    thisDebug("flattenedMap:",flattenedMap)
    for(const [key, value] of Object.entries(flattenedMap)){
        let valuePosition = null;
        let extractedValue = null;
        const [firstString, ...rest] = value.split(".")[0]
        switch(firstString){
            case "nyqPtr":
                valuePosition = rest.join(".")
                break;
            case "nyqJSON":
                extractedValue = JSON.parse(rest.join("."))
                break;
            case "nyqKeep":
                extractedValue = rest.join(".")
                break;
            default:
                valuePosition = value;
                break
        }
        if(extractedValue === null) {
            extractedValue = getNestedObjectValue(inputDataObject,valuePosition)
        }
        thisDebug("valuePosition:",valuePosition,"extractedValue",extractedValue)
        createNestedObjectValue(outputDataObject,key,extractedValue)
    }
}

function getNestedObjectValue(theObject, keyString){	//SYNC all values must be synced
    //console.log("[getNestedObjectValue] called")
    //console.log(theObject, keyString)
    return keyString.split('.').reduce(
        (cur,next) => {
            //console.log("cur:")
            //console.log(cur)
            //console.log("nex:")
            //console.log(next)
            //console.log(cur instanceof Object)
            if(cur instanceof Object) return cur[next];
            else return null;
        },
        theObject,
    )
}

function flattenObject(outputObject, inputObject, keyString = ""){
    if(!(outputObject instanceof Object)) {
        nyqLog("provided variable is not an object", identityString)
        //return theObject;
    }
    //if(inputObject){
        if((!Array.isArray(inputObject))&&(inputObject instanceof Object)){
            for(const [key, value] of Object.entries(inputObject)){
                const newKeyString = keyString === "" ? key : keyString + "." + key;
                flattenObject(outputObject,value,newKeyString)
            }
        }
        else if(Array.isArray(inputObject)){
            for(var i = 0; i < inputObject.length; i++){
                flattenObject(outputObject,inputObject[i],keyString + "[" + i + "]")
            }
        }
        else if((keyString !== "")) {
            outputObject[keyString] = inputObject
        }
        else{
            nyqLog("cannot parse the input object for flattening",identityString,"warn")
        }
    //}
}

function unflattenObject(outputObject,inputObject){
    const appObject = {}
    flattenObject(appObject,inputObject)
    //console.log("unflatten object:")
    //console.log(appObject)
    for(const [key, val] of Object.entries(appObject)){
        createNestedObjectValue(outputObject,key,val)
    }
}

function getNestedObjectValueCopy(theObject,keyString){
    const theValue = getNestedObjectValue(theObject,keyString);
    return createCopy(theValue);
}

function searchNestedObjectValue(theObject,keyString, preserve = false){
    const nestedObject = getNestedObjectValue(theObject,keyString);
    if(nestedObject) return preserve ? createCopy(nestedObject) : nestedObject;
    if(theObject instanceof Object){
        for(const [key,value] of Object.entries(theObject)){
            //console.log("searching " + keyString + " in")
            //console.log(theObject[key])
            const subObject = searchNestedObjectValue(theObject[key],keyString);
            if(subObject) return subObject;
        }
    }
    return null;
}

function elaborateNestedObjectValue(theObject, keyName, functionRef){	//SYNC all values must be synced
    //console.log("[extractFromObject] called")
    //console.log(theObject, keyName, functionRef)
    const nestedObject = searchNestedObjectValue(theObject,keyName);
    //console.log("nested object:")
    //console.log(nestedObject)
    if(!nestedObject) return null
    //let myValue = theObject[keyName];
    if(functionRef === null) return nestedObject;
    let myNewValue = functionRef(nestedObject);
    return myNewValue;
}

function mergeObjectsByreference(targetObj,addedObj){
    let curObj = targetObj;
    for(const [key, value] of Object.entries(addedObj)){
        if(value instanceof Object){
            if(curObj[key] === undefined){ curObj[key] = value}
            else if (!(curObj[key] instanceof Object)) curObj[key] = value; //overwrite
            else mergeObjectsByreference(curObj[key],value)
        }
        else curObj[key] = value; //overwrite
    }
}

function checkRequired(theObject,keyChecks){
    let checkOk = true;
    for(const [key,value] of Object.entries(keyChecks)){
        const extractedValue = getNestedObjectValue(theObject,key);
        if(!extractedValue){
            checkOk = false
            break;
        }
        switch(value){
            case "array":
                checkOk = Array.isArray(extractedValue);
                break;
            default:
                checkOk = ((!Array.isArray(extractedValue))&&(typeof extractedValue === value))
                break;
        }
        if(!checkOk){ break }
    }
    return checkOk;
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


export { createCopy, createNestedObjectValue, getNestedObjectValue, getNestedObjectValueCopy, searchNestedObjectValue, elaborateNestedObjectValue, mergeObjectsByreference, flattenObject, unflattenObject, checkRequired, mapUsingMapObject, UUIDwithDate, UUIDv4 }