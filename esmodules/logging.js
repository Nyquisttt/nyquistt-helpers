/**
 * @typedef {Object} loggingLevel
 * @property {string} levelName
 * @property {number} levelValue
 * @property {string} style
 */

const nyqLoggingLevels = {
    "alert": {style: "font-weight: bold;color:maroon", levelValue: -10},
    "error": {style: "font-weight: bold;color:red", levelValue: 0},
    "warn": {style: "font-weight: bold;color:fuchsia", levelValue: 3},
    "info": {style: "color:green", levelValue: 10},
    "debug": {style: "font-weight: bold;color:navy", levelValue: 1000},
}

const minLevelName = "error"
const maxLevelName = "info"
const nyqLoggingIdentityString = "nyqLogging"

/**
 * 
 * @param {number} inputNumber 
 * @returns {loggingLevel}
 */
function getLevelLowerThanOrEqual(inputNumber){
    let curValue = null;
    let curValueKey = null;
    let curValueStyle = null
    for(const [key, value] of Object.entries(nyqLoggingLevels)){
        if(curValue === null){
            if(value.levelValue <= inputNumber){ 
                curValue = value.levelValue;
                curValueKey = key;
                curValueStyle = value.style
            }
        }
        else{
            if( (value.levelValue > curValue) && (value.levelValue <= inputNumber) ){
                curValue = value.levelValue;
                curValueKey = key;
                curValueStyle = value.style
            };
        }
    }
    return {levelName: curValueKey, levelValue: curValue, style: curValueStyle}
}

/**
 * 
 * @param {number} levelValue 
 * @returns {string}
 */
function getLevelName(levelValue){
    const searchedLevel = getLevelLowerThanOrEqual(levelValue);
    return searchedLevel.levelName;
}

/**
 * 
 * @returns {number}
 */
function getMaxLevel(){
    return nyqLoggingLevels[maxLevelName].levelValue
}
/**
 * 
 * @returns {number}
 */
function actualMaxLevel(){
    let curValue = null;
    for(const [key, value] of Object.entries(nyqLoggingLevels)){
        if(curValue === null) curValue = value.levelValue;
        else{
            curValue = curValue < value.levelValue ? value.levelValue : curValue;
        }
    }
    return curValue;
}
/**
 * 
 * @returns {number}
 */
function getMinLevel(){
    return nyqLoggingLevels[minLevelName].levelValue
}
/**
 * 
 * @returns {number}
 */
function actualMinLevel(){
    let curValue = null;
    for(const [key, value] of Object.entries(nyqLoggingLevels)){
        if(curValue === null) curValue = value.levelValue;
        else{
            curValue = curValue > value.levelValue ? value.levelValue : curValue;
        }
    }
    return curValue;
}


/**
 * @typedef {Object} singleStoredLevel
 * @property {string} identityString
 * @property {number | null} levelValue
 * @property {number ! null} previousLevel
 */

/**
 * @type {singleStoredLevel[]}
 */
let storedLoggingLevels = []
const logDefaultValue = getMaxLevel() //default as info

/**
 * 
 * @param {String} identityString 
 * @param {Number} levelValue 
 * @returns {Boolean}
 */
function setStoredObjectLevel(identityString, levelValue){
    if(identityString === null) identityString = nyqLoggingIdentityString;
    const knownLoggingLevels = storedLoggingLevels.filter(
        (value, index, array) => {
            return value.identityString === identityString
        }
    )
    if (knownLoggingLevels.length > 0) knownLoggingLevels[0].levelValue = levelValue
    else storedLoggingLevels.push({identityString: identityString, levelValue: levelValue})
    return true
}

/**
 * 
 * @param {string} identityString 
 * @returns {singleStoredLevel}
 */
function getStoredObject(identityString){
    if(identityString === null) identityString = nyqLoggingIdentityString;
    const knownLoggingLevels = storedLoggingLevels.filter(
        (value, index, array) => {
            return value.identityString === identityString
        }
    )
    if(knownLoggingLevels.length > 0) return knownLoggingLevels[0];
    else{
        const storedObject = {identityString: identityString, levelValue: logDefaultValue}
        storedLoggingLevels.push(storedObject)
        return storedObject
    }
}



function reportLevel(identityString = null){
    console.log("reporting level")
    if(identityString === null) identityString = nyqLoggingIdentityString
    const refLevel = getStoredObject(identityString).levelValue
    const currentName = getLevelName(refLevel)
    const minimumName = getLevelName(actualMinLevel())
    nyqLog("Logging level: " + currentName, identityString, minimumName)

}
function enableLogging(identityString = null){
    if(identityString === null) identityString = nyqLoggingIdentityString
    setStoredObjectLevel(identityString,getMaxLevel())
    reportLevel(identityString)
}
function disableLogging(identityString = null){
    if(identityString === null) identityString = nyqLoggingIdentityString;
    setStoredObjectLevel(identityString, getMinLevel())
    reportLevel(identityString)
}
function toggleLogging(identityString = null){
    if(identityString === null) identityString = nyqLoggingIdentityString
    const currentStored = getStoredObject(identityString)
    currentStored.levelValue = currentStored.levelValue === getMinLevel() ? getMaxLevel() : getMinLevel()
    reportLevel(identityString)
}
function toggleDebug(identityString = null){
    if(identityString === null) identityString = nyqLoggingIdentityString
    const currentStored = getStoredObject(identityString)
    if(currentStored.levelValue != nyqLoggingLevels["debug"].levelValue){
        currentStored.previousLevel = currentStored.levelValue
        currentStored.levelValue = nyqLoggingLevels["debug"].levelValue
    }
    else{
        currentStored.levelValue = currentStored.previousLevel
    }
    reportLevel(identityString)
}
function debugOffForAll(){
    for(eachStored of storedLoggingLevels){
        if(eachStored.levelValue == nyqLoggingLevels["debug"].levelValue){
            eachStored.levelValue = eachStored.previousLevel
        }
    }
}
function setLoggingLevel(levelNumber, identityString = null){
    if(identityString === null) identityString = nyqLoggingIdentityString
    setStoredObjectLevel(identityString,levelNumber)
    reportLevel(identityString)
}
function nyqIsDebugging(identityString = null){
    if(identityString === null) identityString = nyqLoggingIdentityString
    return getStoredObject(identityString).levelValue === nyqLoggingLevels["debug"].levelValue
}

function nyqLog(myString, identityString = null, type = null){
    if(identityString === null) identityString = nyqLoggingIdentityString
    if(type === null) type = getLevelName(getMaxLevel());
    const requestedLevel = nyqLoggingLevels[type];
    if(!requestedLevel) return;
    if(requestedLevel.levelValue > getStoredObject(identityString).levelValue) return;

    let newString = "%c"
    newString += "[" + identityString + "] "
    newString += myString.toString();
    console.log(newString,requestedLevel.style);
}

function nyqDebug(identityString,...inputList){
    // console.log("nyqDebug")
    // console.log("identityString")
    // console.log(identityString)
    // console.log("inputList")
    // console.log(inputList)
    if(!nyqIsDebugging(identityString)) return;
    for(const eachInput of inputList){
        if(typeof eachInput == "string"){
            nyqLog(eachInput,identityString,"debug")
        }
        else{
            console.log(eachInput)
        }
    }
}

setStoredObjectLevel(nyqLoggingIdentityString, logDefaultValue) //default as info

export {enableLogging, disableLogging, toggleLogging, setLoggingLevel, nyqLog, toggleDebug, nyqIsDebugging, nyqDebug, debugOffForAll};