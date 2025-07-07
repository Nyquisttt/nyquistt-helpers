const nyqLoggingLevels = {
    "alert": {style: "font-weight: bold;color:maroon", level: -10},
    "error": {style: "font-weight: bold;color:red", level: 0},
    "warn": {style: "font-weight: bold;color:fuchsia", level: 3},
    "info": {style: "color:green", level: 10},
    "debug": {style: "font-weight: bold;color:navy", level: 1000},
}

const minLevelName = "error"
const maxLevelName = "info"

function getLevelLowerThanOrEqual(inputNumber){
    let curValue = null;
    let curValueKey = "";
    for(const [key, value] of Object.entries(nyqLoggingLevels)){
        if(curValue === null){
            if(value.level <= inputNumber){ 
                curValue = value.level;
                curValueKey = key;
            }
        }
        else{
            if( (value.level > curValue) && (value.level <= inputNumber) ){
                curValue = value.level;
                curValueKey = key;
            };
        }
    }
    return {levelName: curValueKey, levelValue: curValue}
}

function getLevelName(level){
    const searchedLevel = getLevelLowerThanOrEqual(level);
    return searchedLevel.levelName;
}

function getMaxLevel(){
    return nyqLoggingLevels[maxLevelName].level
}
function actualMaxLevel(){
    let curValue = null;
    for(const [key, value] of Object.entries(nyqLoggingLevels)){
        if(curValue === null) curValue = value.level;
        else{
            curValue = curValue < value.level ? value.level : curValue;
        }
    }
    return curValue;
}

function getMinLevel(){
    return nyqLoggingLevels[minLevelName].level
}
function actualMinLevel(){
    let curValue = null;
    for(const [key, value] of Object.entries(nyqLoggingLevels)){
        if(curValue === null) curValue = value.level;
        else{
            curValue = curValue > value.level ? value.level : curValue;
        }
    }
    return curValue;
}

let currentLoggingLevel = getMaxLevel();
let previousLevel = null

function reportLevel(){
    const currentName = getLevelName(currentLoggingLevel)
    const minimumName = getLevelName(actualMinLevel())
    nyqLog("NyqLogging level: " + currentName,minimumName)

}
function enableLogging(){
    currentLoggingLevel = getMaxLevel();
    reportLevel()
}
function disableLogging(){
    currentLoggingLevel = getMinLevel();
    reportLevel()
}
function toggleLogging(){
    let nextLoggingLevel = currentLoggingLevel == getMinLevel() ? getMaxLevel() : getMinLevel();
    currentLoggingLevel = nextLoggingLevel
    reportLevel()
}
function toggleDebug(){
    const isDebugActive = currentLoggingLevel == nyqLoggingLevels["debug"].level
    if(isDebugActive){
        currentLoggingLevel = previousLevel
    }
    else{
        previousLevel = currentLoggingLevel
        currentLoggingLevel = nyqLoggingLevels["debug"].level
    }
    reportLevel()
}
function setLoggingLevel(levelNumber){
    currentLoggingLevel = levelNumber;
    reportLevel()
}
function nyqIsDebugging(){
    return currentLoggingLevel >= nyqLoggingLevels["debug"].level
}

function nyqLog(myString, type = null){
    if(type === null) type = getLevelName(getMaxLevel())
    let newString = "%c" + myString.toString();
    const requestedLevel = nyqLoggingLevels[type];
    if(!requestedLevel) return;
    if(requestedLevel.level <= currentLoggingLevel){
        console.log(newString,requestedLevel.style);
    }
    return;
}

export {enableLogging, disableLogging, toggleLogging, nyqLog, setLoggingLevel, toggleDebug, nyqIsDebugging};