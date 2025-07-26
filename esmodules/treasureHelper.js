/********************************************************************************
 * DONT TOUCH THIS
 *******************************************************************************/
//valid at import if made dynamically
const nyqModRef = game.nyqHelp
console.log(nyqModRef)

const {moduleId, apiFolderName, nyqModPath} = nyqModRef.getApiParameters()

const generalUtils = nyqModRef.generalUtils
const nyqLog = nyqModRef.nyqLog
const nyqDebug = nyqModRef.nyqDebug
const nyqIsDebugging = nyqModRef.nyqIsDebugging
/********************************************************************************
 * DONT TOUCH THIS - END
 *******************************************************************************/

/********************************************************************************
 * PARAMETERS
 *******************************************************************************/

//libraries of json files used by magicItemTrackerClass
const libUsed = [
    "modules/nyquistt-helpers/nyqLibs/lib-dnd5e2024.json",
]

const hoardTablePath = "dnd5e2024.treasure"
const hoardTableName = "hoard"
const individualTablePath = "dnd5e2024.treasure"
const individualTableName = "individual"

const rollTablesPath = "dnd2024.treasure.rollables"

/*******************************************************************************
 * PARAMETERS END
 *******************************************************************************/

class treasureHelper{
    static #identityString = "treasureHelper"
    static #debug(...inputList){
        nyqDebug(this.#identityString, ...inputList)
    }
    static #log(myString, type=null){ //only strings
        nyqLog(myString.toString(), this.#identityString, type)
    }
    static async #loadLibraries(){
        for(const eachLib of libUsed){
            const libChecked = await nyqModRef.nyqTables.checkLibrary(eachLib)
        }
    }
    static findSelectedTokenList(types = ['npc']){
        this.#debug("findSelectedTokenList")
        if(!Array.isArray(types)){
            types = [types]
        }
        const selTokens = canvas.tokens.controlled;
        if(selTokens.length === 0){
            return null
        }
        const extractedList = selTokens.filter(
            (value, index, array) => {
                return types.includes(value.actor.type)
            }
        )
        let finalList = []
        for(const eachToken of extractedList){
            finalList.push(eachToken.id)
        }
        this.#debug("finalList",finalList)
        return finalList
    }
    static findSelectedTokenListExtended(types = ['npc']){
        this.#debug("findSelectedTokenListExtended")
        if(!Array.isArray(types)){
            types = [types]
        }
        const selTokens = canvas.tokens.controlled;
        if(selTokens.length === 0){
            return null
        }
        const extractedList = selTokens.filter(
            (value, index, array) => {
                return types.includes(value.actor.type)
            }
        )
        let finalList = []
        for(const eachToken of extractedList){
            finalList.push({id: eachToken.id, name: eachToken.name, cr: eachToken.actor.system.details.cr})
        }
        this.#debug("finalList",finalList)
        return finalList
    }
    static async addMoneyOrItemsToActors(itemAndActorList, update = true){
        this.#debug("addMoneyOrItemsToActors","itemAndActorList",itemAndActorList)
        for(const eachElement of itemAndActorList){
            const selectedToken = await canvas.tokens.get(eachElement.id)
            eachElement.name = selectedToken.name
            if(!update){
                continue
            }
            const oldCurrency = selectedToken.actor.system.currency
            if(!Array.isArray(eachElement.rolledValues)){
                eachElement.rolledValues = [eachElement.rolledValues]
            }
            let updateData
            for(const eachRollLine of eachElement.rolledValues){
                for(const [key,value] of Object.entries(eachRollLine)){
                    switch(key){
                        case 'copper':
                                updateData = {
                                    "system.currency.cp": oldCurrency.cp + value.total
                                }
                            break
                        case 'silver':
                                updateData = {
                                    "system.currency.sp": oldCurrency.sp + value.total
                                }
                            break
                        case 'gold':
                                updateData = {
                                    "system.currency.gp": oldCurrency.gp + value.total
                                }
                            break
                        case 'plat':
                                updateData = {
                                    "system.currency.pp": oldCurrency.pp + value.total
                                }
                            break
                    }
                    await selectedToken.actor.update(updateData);
                    if(key === "magicItem"){
                        const data = [{name: "Magic Item", type: "loot"}];
                        for(var countItems = 0; countItems < value.total; countItems++){
                            let createdItem = await Item.create(data, {parent: selectedToken.actor})
                        }
                    }
                }
            }
        }
        return itemAndActorList
    }
    static async rollTreasure(hoardOrIndividual, cr, showInChat){
        this.#debug("rollTreasure","hoardOrIndividual",hoardOrIndividual,"cr",cr,"showInChat",showInChat)
        let tableName
        if((hoardOrIndividual == "individual")||(hoardOrIndividual == 0)){
            tableName = individualTablePath + "." + individualTableName
        }
        else{
            tableName = hoardTablePath + "." + hoardTableName
        }
        let operationData = {
            operationList: ["greatestSmallerThanOrEqual", "rollExpressionsInKeys"],
            //'dataValue', 'keyString'
            //'keyString'
            //'keyStringList','sendToMessage','skipNulls'
            keyString: "minCR",
            dataValue: cr,
            skipNulls: true,
            sendToMessage: showInChat,
            keyStringList: [["plat", "gold", "silver", "copper", "magicItem"]]
        }
        for(const eachLib of libUsed){
            const libChecked = await nyqModRef.nyqTables.checkLibrary(eachLib)
        }
        const rollResult = await nyqModRef.nyqTables.getFromTable(tableName, operationData);
        this.#debug("rollResult",rollResult)
        return rollResult
    }
    static async rollTreasureForNpcList(npcList,hoardOrIndividual,showInChat, update = true){
        this.#debug("rollTreasureForNpcList","npcList",npcList,"hoardOrIndividual",hoardOrIndividual,"showInChat",showInChat)
        let itemAndActorList = []
        for(const eachNpc of npcList){
            const theToken = await canvas.tokens.get(eachNpc)
            const cr = await theToken.actor.system.details.cr
            const rollResult = await this.rollTreasure(hoardOrIndividual, cr, showInChat)
            itemAndActorList.push(
                {id: eachNpc, rolledValues: rollResult}
            )
        }
        const addMoneyResult = await this.addMoneyOrItemsToActors(itemAndActorList, update)
        return addMoneyResult
    }
    static async rollTreasureForSelected(hoardOrIndividual,showInChat, update = true){
        this.#debug("rollTreasureForSelected")
        const selectedNpc = this.findSelectedTokenList(['npc'])
        if((selectedNpc === null)||(selectedNpc.length == 0)){
            return null
        }
        this.#debug("selectedNpc",selectedNpc)
        return await this.rollTreasureForNpcList(selectedNpc, hoardOrIndividual, showInChat, update)
    }
    static async gimmeRollTableNames(){
        await this.#loadLibraries()
        const rollablesList = nyqModRef.nyqTables.getTableNames(rollTablesPath)
        return rollablesList
    }
    static async searchForTaggedRollables(tag = 'rolltable'){
        await this.#loadLibraries()
        const foundRollables = nyqModRef.nyqTables.getTableOfType(tag)
        return foundRollables
    }
    static async createRollTable(tablePath){
        await this.#loadLibraries()
        this.#debug("createRollTable")
        const checkPath = nyqModRef.nyqTables.checkTablePath(tablePath)
        if(!checkPath.check) return null
        const operationData = {
            operationList: ['copyWholeTable'],
        }
        const wholeTable = await nyqModRef.nyqTables.getFromTable(tablePath,operationData)
        this.#debug("wholeTable",wholeTable)
        let rangedList = []
        let weightedList = []
        let unweightedList = []
        let foundRollResults = []
        let totalRangedWeight = 0
        let minRange = -1;
        let maxRange = -1;
        for(const eachRow of wholeTable){
            let isRanged = true
            let isWeighted = true
            let newObj = {}
            if((typeof eachRow !== 'object')||(Array.isArray(eachRow))){
                newObj.range = null
                newObj.weight = null
                newObj.type = foundry.CONST.TABLE_RESULT_TYPES.TEXT
                newObj[foundry.CONST.TABLE_RESULT_TYPES.TEXT] = JSON.stringify(eachRow)
                unweightedList.push(newObj)
                continue
            }
            if((eachRow.range === undefined)||(!Array.isArray(eachRow.range)||(eachRow.range.length != 2))){
                isRanged = false
                newObj.range = null
            }
            if(isRanged){
                this.#debug("found a ranged row")
                newObj.range = eachRow.range
                newObj.weight = Math.max(...eachRow.range) - Math.min(...eachRow.range) + 1
                totalRangedWeight += newObj.weight
                if((minRange == -1)||(minRange > Math.min(...newObj.range)))
                    minRange = Math.min(...newObj.range)
                if((maxRange == -1)||(maxRange < Math.max(...newObj.range)))
                    maxRange = Math.max(...newObj.range)
                for(var rangeCount = Math.min(...newObj.range); rangeCount <= Math.max(...newObj.range); rangeCount++){
                    this.#debug("checking a range value: " + rangeCount)
                    if(!foundRollResults.includes(rangeCount)){
                        this.#debug("found another range value: " + rangeCount)
                        foundRollResults.push(rangeCount)
                    }
                }
            }
            else if((eachRow.weight === undefined)||(isNaN(eachRow.weight))){
                isWeighted = false
                newObj.weight = null
            }
            else newObj.weight = eachRow.weight
            let goodType = false
            let typeKey = ""
            if(eachRow.type !== undefined){
                for(const [key,value] of Object.entries(foundry.CONST.TABLE_RESULT_TYPES)){
                    if(eachRow.type === value){
                        goodType = true
                        typeKey = value
                        break
                    }
                }
                if((goodType)&&(eachRow[typeKey] === undefined)) goodType = false
            }
            newObj.type = goodType ? eachRow.type : foundry.CONST.TABLE_RESULT_TYPES.TEXT
            if(goodType) newObj[typeKey] = eachRow[typeKey]
            else if(eachRow[newObj.type] !== undefined) {
                newObj[newObj.type] = eachRow[newObj.type]
            }
            else{
                let stringObj = {}
                for(const [key,value] of Object.entries(eachRow)){
                    if( ((key !== "weight")||(!isWeighted)) && ((key !== "range")||(!isRanged)) ){
                        stringObj[key] = value
                    }
                }
                newObj[foundry.CONST.TABLE_RESULT_TYPES.TEXT] = JSON.stringify(stringObj)
            }
            if(isRanged){
                rangedList.push(newObj)
            }
            else if(isWeighted){
                weightedList.push(newObj)
            }
            else unweightedList.push(newObj)
        }
        this.#debug("rangedList",generalUtils.createCopy(rangedList),"weightedList",generalUtils.createCopy(weightedList),
            "unweightedList",generalUtils.createCopy(unweightedList),
            "totalRangedWeight",generalUtils.createCopy(totalRangedWeight))
        this.#debug("minRange", minRange, "maxRange", maxRange)
        foundRollResults.sort(
            (a,b) => {
                return a-b
            }
        )
        this.#debug("foundRollResults",foundRollResults)
        let intermediateSlot = []
        if((weightedList.length > 0) || (unweightedList.length > 0)){
            for(var countFoundRoll = 0; countFoundRoll < foundRollResults.length - 1; countFoundRoll++){
                if(foundRollResults[countFoundRoll+1]-foundRollResults[countFoundRoll] > 1){
                    intermediateSlot.push(
                        {
                            startVal: foundRollResults[countFoundRoll]+1,
                            nSlots: foundRollResults[countFoundRoll+1] - foundRollResults[countFoundRoll] -1
                        }
                    )
                }
            }
            while(unweightedList.length > 0){
                let extractedUnweighted = unweightedList.splice(0,1)[0]
                extractedUnweighted.weight = 1
                weightedList.push(extractedUnweighted)
            }
            this.#debug("intermediateSlot",generalUtils.createCopy(intermediateSlot))
            if(weightedList.length > 0){
                weightedList.sort(
                    (a,b) => {
                        return b.weight - a.weight
                    }
                )
                while(weightedList.length > 0){
                    let newRanged = weightedList.splice(0,1)[0]
                    if(minRange > newRanged.weight){
                        newRanged.range = [minRange - newRanged.weight, minRange -1]
                        minRange -= newRanged.weight
                    }
                    else{
                        let availableSlot = intermediateSlot.reduce(
                            (cur, next, index, array) => {
                                if(cur.nSlots < newRanged.weight) return next
                                return ((next.nSlots >= newRanged.weight)&&(next.nSlots < cur.nSlots)) ? next : cur
                            }
                        )
                        if(availableSlot.nSlots >= newRanged.weight){
                            newRanged.range = [availableSlot.startVal,availableSlot.startVal+newRanged.weight-1]
                            availableSlot.startVal += newRanged.weight
                            availableSlot.nSlots -= newRanged.weight
                        }
                        else{
                            newRanged.range = [maxRange+1, maxRange+newRanged.weight]
                            maxRange += newRanged.weight
                        }
                    }
                    for(rangeCount = newRanged.range[0]; rangeCount <= newRanged.range[1]; rangeCount++){
                        foundRollResults.push(rangeCount)
                    }
                    rangedList.push(newRanged)
                }
                this.#debug("rangedList",generalUtils.createCopy(rangedList),
                    "intermediateSlot",generalUtils.createCopy(intermediateSlot),
                    "minRange",minRange,"maxRange",maxRange)
            }
        }
        const usableIntermediateSlots = intermediateSlot.filter(
            (value, index, array) => {
                return value.nSlots > 0
            }
        )
        for(var countEmpty = 0; countEmpty < usableIntermediateSlots.length; countEmpty++){
            const emptySpace = usableIntermediateSlots[countEmpty]
            let newObj = {
                weight: emptySpace.nSlots,
                range: [emptySpace.startVal, emptySpace.startVal+emptySpace.nSlots-1],
                type: foundry.CONST.TABLE_RESULT_TYPES.TEXT,
            }
            newObj[foundry.CONST.TABLE_RESULT_TYPES.TEXT] = "empty roll"
            rangedList.push(newObj)
        }
        rangedList.sort(
            (a,b) => {
                return a.range[0] - b.range[0]
            }
        )
        this.#debug("rangedList",generalUtils.createCopy(rangedList))
        if(minRange != 1){
            const reduceVal = minRange-1
            minRange -= reduceVal
            maxRange -= reduceVal
            for(var countRanged = 0; countRanged < rangedList.length; countRanged++){
                rangedList[countRanged].range[0] -= reduceVal
                rangedList[countRanged].range[1] -= reduceVal
            }
        }
        this.#debug("rangedList",generalUtils.createCopy(rangedList))
        const myFormula = '1d' + maxRange
        const myData = {
            name: tablePath,
            formula: myFormula,
            results: rangedList,
        }
        const myRollTable = await RollTable.implementation.create(myData)
        this.#debug("myRollTable",myRollTable)
        return myRollTable
    }
}

export { treasureHelper }