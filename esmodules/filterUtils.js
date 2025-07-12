import * as nyqGeneralConfig from './nyqGeneralConfig.js';
import {nyqLog} from './logging.js';
import * as generalUtils from './generalUtils.js'

const preStr = "[filterUtils] ";

const greaterThan = {
    type: "filter", required: ['dataValue', 'keyString'], 
    operation: (value, index, array, data) => {
        return generalUtils.getNestedObjectValue(value,data.keyString) > data.dataValue
    }
};
const greaterThanOrEqual = {
    type: "filter", required: ['dataValue', 'keyString'], 
    operation: (value, index, array, data) => {
        return generalUtils.getNestedObjectValue(value,data.keyString) >= data.dataValue
    }
};
const lowerThan = {
    type: "filter", required: ['dataValue', 'keyString'], 
    operation: (value, index, array, data) => {
        return generalUtils.getNestedObjectValue(value,data.keyString)  < data.dataValue
    }
};
const lowerThanOrEqual = {
    type: "filter", required: ['dataValue', 'keyString'], 
    operation: (value, index, array, data) => {
        return generalUtils.getNestedObjectValue(value,data.keyString)  <= data.dataValue
    }
};
const equalTo = {
    type: "filter", required: ['dataValue', 'keyString'], 
    operation: (value, index, array, data) => {
        return generalUtils.getNestedObjectValue(value,data.keyString)  == data.dataValue
    }
};
const searchKeys = {
    type: "filter", required: ["keyStringList"],
    operation: (value, index, array, data) => {
        if(!Array.isArray(data.keyStringList)) data.keyStringList = [data.keyStringList];
        let goodValue = false;
        for(const keyString of data.keyStringList){
            const foundItem = generalUtils.getNestedObjectValue(value,keyString)
            if(foundItem){//not null not undefined
                goodValue = true;
                break;
            }
        }
        return goodValue;
    }
}
const equalToAsyncData = {
    type: "filter", required: ['dataValue', 'keyString'], isAsync: true,
    operation: async (value, index, array, data) => {
        let myKeyString = await data.keyString;
        let myDataValue = await data.dataValue;
        return generalUtils.getNestedObjectValue(value,myKeyString)  == myDataValue
    }
};
const maxValueAsyncData = {
    type: "reduce", required: ['keyString'], isAsync: true, 
    operation: async (cur,next,index,array, data) => {
        //console.log(data,cur,next)
        //console.log(generalUtils.getNestedObjectValue(cur,data.keyString))
        //console.log(generalUtils.getNestedObjectValue(next,data.keyString))
        let myKeyString = await data.keyString;
        let delayedCur = await cur;
        //console.log(myKeyString);
        //console.log(generalUtils.getNestedObjectValue(delayedCur,myKeyString))
        //console.log(generalUtils.getNestedObjectValue(next,myKeyString))
        return generalUtils.getNestedObjectValue(delayedCur,myKeyString) < generalUtils.getNestedObjectValue(next,myKeyString) ? next : delayedCur
    }
};
const maxValue = {
    type: "reduce", required: ['keyString'], 
    operation: (cur,next,index,array, data) => {
        //console.log(data,cur,next)
        //console.log(generalUtils.getNestedObjectValue(cur,data.keyString))
        //console.log(generalUtils.getNestedObjectValue(next,data.keyString))
        return generalUtils.getNestedObjectValue(cur,data.keyString) < generalUtils.getNestedObjectValue(next,data.keyString) ? next : cur
    }
};
const minValue = {
    type: "reduce", required: ['keyString'], 
    operation: (cur,next,index,array, data) => {
        return generalUtils.getNestedObjectValue(cur,data.keyString) > generalUtils.getNestedObjectValue(next,data.keyString) ? next : cur
    }
};
const extractValues = {
    type: "forOf", required: ['keyStringList', 'preserve'],
    operation: (eachRow,data) => {
        if(!Array.isArray(data.keyStringList)) data.keyStringList = [data.keyStringList];
        let newObj = {}
        for(var keyCount = 0; keyCount < data.keyStringList.length; keyCount++){
            const myKey = data.keyStringList[keyCount];
            const actualValue = data.preserve ? generalUtils.getNestedObjectValueCopy(eachRow,myKey) : generalUtils.getNestedObjectValue(eachRow,myKey);
            newObj = generalUtils.createNestedObjectValue(newObj,myKey,actualValue);
        }
        return newObj;
    }
}
const getKeys = {
    type: "wholeArray", required: [],
    operation: (wholeArray,data) => {
        const firstLine = wholeArray[0];
        const objKeys = Object.keys(firstLine);
        return objKeys;
    }
}
const getRow = {
    type: "wholeArray", required: ['rowIndex','preserve'],
    operation: (wholeArray,data) => {
        const singleRow = data.preserve ? generalUtils.createCopy(wholeArray[data.rowIndex]) : wholeArray[data.rowIndex];
        return [singleRow];
    }
}
const getRandomRow = {
    type: "wholeArray", required: ['preserve'],
    operation: (wholeArray,data) => {
        const nRows = wholeArray.length;
        const randInt = Math.floor(Math.random() * nRows); // <nRows
        return data.preserve ? generalUtils.createCopy([wholeArray[randInt]]) : [wholeArray[randInt]];
    }
}
const integrateValueUpTo = {
    type: "wholeArray", required: ['maxValue','integralKey','filterZero','tolerance'],
    operation: (wholeArray,data) => {
        let maxValue = data.maxValue;
        const integralKey = data.integralKey;
        const myTolerance = data.tolerance ? data.tolerance : 0;
        let myArray = wholeArray.filter(    //filter any row with large values
            (value, index, array) => {
                return generalUtils.getNestedObjectValue(value,integralKey) <= maxValue;
            }
        )
        if(data.filterZero){
            myArray = myArray.filter(
                (value, index, array) => {
                    return greaterThan.operation(value,index,array,{dataValue: 0, keyString: integralKey})
                }
            )
        }
        let returnList = [];
        while(myArray.length){
            const newRow = getRandomRow.operation(myArray,{})[0];
            returnList.push(generalUtils.createCopy(newRow));
            maxValue -= generalUtils.getNestedObjectValue(newRow,integralKey)
            if (maxValue <= myTolerance) break;
            myArray = myArray.filter(
                (value, index, array) => {
                    return lowerThanOrEqual.operation(value,index,array,{dataValue: maxValue, keyString:integralKey})
                }
            )
        }
        return returnList;
    }
}
const array2D = {
    type: "forOf", required: [],
    operation: (eachRow,data) => {
        return Object.values(eachRow);
    }
}
const transposeArray2D = {
    type: "wholeArray", required: [],
    operation: (wholeArray,data) => {
        if(!wholeArray.length) return [];
        let newArray = [];
        for(var columnCount = 0; columnCount < wholeArray[0].length; columnCount++){
            newArray.push([wholeArray[0][columnCount]])
        }
        for(var rowCount = 1; rowCount < wholeArray.length; rowCount++){
            const currentRow = wholeArray[rowCount];
            for(var columnCount = 0; columnCount < currentRow.length; columnCount++){
                newArray[columnCount].push(currentRow[columnCount])
            }
        }
        return newArray;
    }
}
const addField = {
    type: "forOf", required: ['fieldName', 'fieldValue','preserve'],
    operation: (eachRow,data) => {
        let NewFieldValue;
        if(Array.isArray(data.fieldValue)){
            if(data.fieldValue.length){
                NewFieldValue = data.fieldValue[0];
                data.fieldValue = data.fieldValue.slice(1);
            }
            else NewFieldValue = null;
        }
        else NewFieldValue = data.fieldValue;
        let newRow = data.preserve ? generalUtils.createCopy(eachRow) : eachRow;
        newRow[data.fieldName] = NewFieldValue;
        return newRow;
    }
}
const rollExpressionsInKeys = {
    type: "forOf", required: ['keyStringList','sendToMessage','skipNulls'], isAsync: true,
    operation: async (eachRow, data) => {
        let newResultObject = {};
        for(const eachKey of data.keyStringList){
            if((eachRow[eachKey]!==undefined)&&(typeof eachRow[eachKey] == "string")){
                if((!data.skipNulls)||(eachRow[eachKey] !== "0")){
                    const checkResult = foundry.dice.Roll.validate(eachRow[eachKey])
                    if(checkResult){
                        let myRoll = new Roll(eachRow[eachKey]);
                        await myRoll.evaluate();
                        if(data.sendToMessage) await myRoll.toMessage();
                        newResultObject[eachKey] = {formula: eachRow[eachKey], total: myRoll.total, result: myRoll.result, rollObject: myRoll};
                    }
                }
            }
        }
        return newResultObject;
    }
}
const rollExpressions = {
    type: "forOf", required: ['sendToMessage','skipNulls'], isAsync: true,
    operation: async (eachRow, data) => {
        data.keyStringList = Object.keys(eachRow);
        return await rollExpressionsInKeys.operation(eachRow,data);
    }
}
const getTheWholeTable = {
    type: "wholeArray", required: [], isAsync: false,
    operation: (wholeArray,data) => {
        return wholeArray
    }
}
const copyWholeTable = {
    type: "wholeArray", required: [], isAsync: false,
    operation: (wholeArray,data) => {
        return generalUtils.createCopy(wholeArray)
    }
}

const filterRepo = {
    "getTheWholeTable": {operationSequence: [getTheWholeTable]},
    "copyWholeTable": {operationSequence: [copyWholeTable]},
    "extractValues": {operationSequence: [extractValues]},
    "greaterThan": {operationSequence: [greaterThan]},
    "greaterThanOrEqual": {operationSequence: [greaterThanOrEqual]},
    "lowerThan": {operationSequence: [lowerThan]},
    "lowerThanOrEqual": {operationSequence: [lowerThanOrEqual]},
    "equalTo": {operationSequence: [equalTo]},
    "maxValue": {operationSequence: [maxValue]},
    "minValue": {operationSequence: [minValue]},
    "greatestSmallerThan": {operationSequence: [lowerThan, maxValue]},
    "greatestSmallerThanOrEqual": {operationSequence: [lowerThanOrEqual, maxValue]},
    "smallestGreaterThan": {operationSequence: [greaterThan, minValue]},
    "smallestGreaterThanOrEqual": {operationSequence: [greaterThanOrEqual, minValue]},
    "getKeys": {operationSequence: [getKeys]},
    "getRow": {operationSequence: [getRow]},
    "getRandomRow": {operationSequence: [getRandomRow]},
    "integrateValueUpTo": {operationSequence: [integrateValueUpTo]},
    "array2D": {operationSequence: [array2D]},
    "addField": {operationSequence: [addField]},
    "transposeArray2D": {operationSequence: [transposeArray2D]},
    "transpose": {operationSequence: [array2D, transposeArray2D]},
    "rollExpressions": {operationSequence: [rollExpressions]},
    "rollExpressionsInKeys": {operationSequence: [rollExpressionsInKeys]},
    "equalToAsyncData": {operationSequence: [equalToAsyncData]},
    "maxValueAsyncData": {operationSequence: [maxValueAsyncData]},
    "searchKeys": {operationSequence: [searchKeys]}
}

export {filterRepo}