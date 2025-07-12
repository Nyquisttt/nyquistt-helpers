/********************************************************************************
 * DONT TOUCH THIS
 *******************************************************************************/
//valid at import if made dynamically
const nyqModRef = game.nyqHelp
console.log(nyqModRef)

const {moduleId, apiFolderName, nyqModPath} = nyqModRef.getApiParameters()

const generalUtils = nyqModRef.generalUtils
const nyqLog = nyqModRef.nyqLog
const nyqIsDebugging = nyqModRef.nyqIsDebugging
Handlebars.registerHelper('indentTreeLeaf', function (depth) {
    let strIndent = ""
    if((depth !== null)&&(depth !== undefined)){
        for(var myCounter = 0; myCounter < depth; myCounter++){
            strIndent += "↪"
        }
    }
    strIndent += "📁 "
    return strIndent
})
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

const monsterLibPath = "dnd2024.monster.list"

const encounterBudgetFile = {
    path: 'dnd2024.encounter',
    name: 'budget',
    operations: ['extractValues'],
    operationKeysAndValues: {
        'keyStringList': [["lvl", "low", "moderate", "high"]],
        'preserve': true,
    }
}
const encounterCostFile = {
    path: 'dnd2024.encounter',
    name: 'cost',
    operations: ['extractValues'],
    operationKeysAndValues: {
        'keyStringList': [["cr", "xp"]],
        'preserve': true,
    }
}

//folder for the templates (warning it is in a subfolder)
const templatesFolder = "nyqTemplates/encounterHelper"

/*******************************************************************************
 * PARAMETERS END
 *******************************************************************************/

class encounterHelper{
    static #identityString = "[encounterHelper] "
    static #debug(...inputList){
        if(!nyqIsDebugging()) return;
        for(const eachInput of inputList){
            if(typeof eachInput == "string"){
                this.#log(eachInput,"debug")
            }
            else{
                console.log(eachInput)
            }
        }
    }
    static #log(myString, type=null){ //only strings
        nyqLog(this.#identityString + myString.toString(), type)
    }
    static #debugReport(){
        //this.#debug("magicItemDistribution:",this.#magicItemDistribution)
    }
    static pleaseReport(){
        this.#debugReport()
    }

    static encounterBudget = [] //contains: {"lvl": 1, "low": 50, "moderate": 75, "high": 100},
    static encounterCost = []   //contains: {"cr": "0", "xp":10},
    static difficultyLevelList = []
    static crList = []          //contains: {crString: crReal: pos:}
    static #ready = this.#initialize()//false
    //static {
    //    this.#ready = this.#initialize()
    //}

    static #dataForGetFromTable(infoObject){
        let returnObj =  {
            tableName: infoObject.path + "." + infoObject.name,
            operationData: {
                operationList: infoObject.operations,
            }
        }
        for(const [key,value] of Object.entries(infoObject.operationKeysAndValues)){
            returnObj.operationData[key] = value
        }
        return returnObj
    }
    static async #getContentFromTable(tableInfoObject){
        this.#debug("filling an array")
        this.#debug("tableInfoObject",tableInfoObject)
        const {tableName, operationData} = this.#dataForGetFromTable(tableInfoObject)
        this.#debug("tableName",tableName, "operationData", operationData)
        const loadedResult = await nyqModRef.nyqTables.getFromTable(tableName, operationData);
        this.#debug("loadedResult",loadedResult)
        return loadedResult
    }
    static async #initialize(){
        for(const eachLib of libUsed){
            const loadedLib = await nyqModRef.nyqTables.checkLibrary(eachLib)
        }
        this.encounterBudget = await this.#getContentFromTable(encounterBudgetFile)
        this.#debug("encounterBudget fetched from library",this.encounterBudget)
        const firstRow = this.encounterBudget[0]
        for(const [key, value] of Object.entries(firstRow)){
            if(key !== 'lvl'){
                this.difficultyLevelList.push(key)
            }
        }
        this.encounterCost = await this.#getContentFromTable(encounterCostFile)
        this.#debug("encounterCost fetched from library",this.encounterCost)
        for(var countCR = 0; countCR < this.encounterCost.length; countCR++){
            const crString = this.encounterCost[countCR].cr
            let crReal
            switch(crString){
                case '1/8':
                    crReal = 1.0/8.0
                    break
                case '1/4':
                    crReal = 1.0/4.0
                    break
                case '1/2':
                    crReal = 1.0/2.0
                    break
                default:
                    crReal = parseInt(crString)
                    break
            }
            this.crList.push({crString: crString, crReal: crReal,})
        }
        this.crList.sort(
            (a,b) => {
                return a.crReal - b.crReal
            }
        )
        for(var countCR = 0; countCR < this.crList.length; countCR++){
            this.crList[countCR].pos = countCR
        }
        this.#debug("crList", this.crList)
        return true
    }
    static async computeBudgetFromPlayerlist(playerList){
        await this.#ready
        let totalBudget = {}
        for(const eachDifficultyLevel of this.difficultyLevelList){
            totalBudget[eachDifficultyLevel] = 0
        }
        for(const eachPlayer of playerList){
            if(eachPlayer.lvl > 0){
                for(const eachDifficultyLevel of this.difficultyLevelList){
                    const levelValues = this.encounterBudget.filter(
                        (value, indes, array) => {
                            return value.lvl === eachPlayer.lvl
                        }
                    )[0]
                    totalBudget[eachDifficultyLevel] += levelValues[eachDifficultyLevel]
                }
            }
        }
        return totalBudget
    }
    static async computeBudgetFromExistingTokens(){
        await this.#ready
        let myPlayerList = [];
        const allToken = await canvas.tokens.documentCollection;
        for (const eachElement of allToken){
            //console.log(eachElement);
            //console.log(eachElement.actor.type)
            if((eachElement.actor) && (eachElement.actor.type === "character")){
                const objClasses = eachElement.actor.classes;
                const myClasses = Object.keys(objClasses);
                //console.log(objClasses);
                let myLvl = 0;
                for (let myClass of myClasses) {
                    //console.log(objClasses[myClass])
                    //console.log(objClasses[myClass].system.levels)
                    myLvl += objClasses[myClass].system.levels;
                }
                myPlayerList.push({lvl: myLvl});
            }
            //else console.log('non character')
        }
        let computedBudget = await this.computeBudgetFromPlayerlist(myPlayerList)
        computedBudget.nTokens = myPlayerList.length
        computedBudget.playerList = myPlayerList
        return computedBudget
    }
    static async getEncounterCrGivenMaxXp(maxXp, minXp = 0){
        await this.#ready
        let filteredList = []
        for(const eachCost of this.encounterCost){
            if((eachCost.xp <= maxXp)&&(eachCost.xp >= minXp)){
                let newObj = {crString: eachCost.cr, xp: eachCost.xp}
                switch(eachCost.cr){
                    case "1/8":
                        newObj.crNum = 1.0/8.0
                        break
                    case "1/4":
                        newObj.crNum = 1.0/4.0
                        break
                    case "1/2":
                        newObj.crNum = 1.0/2.0
                        break
                    default:
                        newObj.crNum = parseInt(eachCost.cr)
                        break
                }
                filteredList.push(newObj)
            }
        }
        return filteredList
    }
    static async randomizeEncounterGivenTotalXp(totalXp, minXp = 0){
        await this.#ready
        let remainingXp = totalXp
        let returnList = []
        while(remainingXp > 0){
            const allValues = await this.getEncounterCrGivenMaxXp(remainingXp, minXp)
            const possibleValues = allValues.filter(
                (value, index, array) => {
                    //return value.crNum !== 0
                    return value.xp !== 0
                }
            )
            if(possibleValues.length == 0){
                break
            }
            const myRandomIndex = Math.floor(Math.random() * possibleValues.length)
            returnList.push(possibleValues[myRandomIndex])
            remainingXp -= possibleValues[myRandomIndex].xp
        }
        returnList.sort(
            (a,b) => {
                return a.crNum - b.crNum //ascending
            }
        )
        return {remainingXp: remainingXp, randomizedList: returnList}
    }
    //static async getMonsters(keyList, cr = null, upToCr = false, format = 'raw'){
    static async getMonsters(operationDataArray, format = 'raw',titles=[], orderedBy = "", orderDirection = "ascending"){
        await this.#ready
        this.#debug("getting monsters","operationDataArray:",operationDataArray,"format",format)
        const tableName = monsterLibPath
        let completeTable = []
        for(var countTables = 0; countTables < operationDataArray.length; countTables++){
            const gettedTable = await nyqModRef.nyqTables.getFromTable(tableName,operationDataArray[countTables])
            if(gettedTable.length > 0){
                completeTable.push(gettedTable)
            }
        }
        let outputResult, context, myHTML, myDescription
        if((format === "singleHTMLtable")||(format === "multipleHTMLtables")){
            const fetchResponse = await fetch(`${nyqModPath}/${templatesFolder}/table-to-htmltable.hbs`);
            if (!fetchResponse.ok){
                outputResult = null;
            }
            else{
                const templateText = await fetchResponse.text();
                myDescription = Handlebars.compile(templateText)
                if(format === "singleHTMLtable"){
                    context = {
                        useDetails: false,
                        listOfTables: [
                            {
                                title: titles.length > 0 ? titles[0] : '',
                                rows: [],
                            }
                        ],
                    }
                    for(var countTables = 0; countTables < completeTable.length; countTables++){
                        context.listOfTables[0].rows = context.listOfTables[0].rows.concat(completeTable[countTables])
                    }
                    if(orderedBy !== ""){
                        context.listOfTables[0].rows.sort(
                            (a,b) => {
                                return orderDirection === "ascending" ? a[orderedBy] - b[orderedBy] : b[orderedBy] - a[orderedBy]
                            }
                        )
                    }
                }
                else{
                    context = {
                        useDetails: true,
                        listOfTables: [],
                    }
                    for(var countTables = 0; countTables < completeTable.length; countTables++){
                        let partialTable = completeTable[countTables]
                        if(orderedBy !== ""){
                            partialTable.sort(
                                (a,b) => {
                                    return orderDirection === "ascending" ? a[orderedBy] - b[orderedBy] : b[orderedBy] - a[orderedBy]
                                }
                            )
                        }
                        context.listOfTables.push(
                            {title: titles[countTables], rows: partialTable}
                        )
                    }
                }
                this.#debug("context",context)
                myHTML = await myDescription(context)
                this.#debug("myHTML length: " + myHTML.length, "myTHML:", myHTML)
                outputResult = myHTML
            }
        }
        else{
            outputResult = completeTable
        }
        this.#debug("outputResult",outputResult)
        return outputResult
    }
    static async getMonstersByCR(crValues, keyStringList = ["Name", "Type", "XP", "Crstring", "CRreal"]){
        await this.#ready
        if(!Array.isArray(crValues)){
            crValues = [crValues]
        }
        if(!keyStringList.includes("Crstring")){
            keyStringList.push("Crstring")
        }
        if(!keyStringList.includes("CRreal")){
            keyStringList.push("CRreal")
        }
        crValues.sort(
            (a,b) => {
                const cr1 = this.crList.filter(
                    (value, index, array) => {
                        return value.crString == a
                    }
                )[0].pos
                const cr2 = this.crList.filter(
                    (value, index, array) => {
                        return value.crString == b
                    }
                )[0].pos
                return cr1-cr2
            }
        )
        let operationDataArray = []
        let titles = []
        for(var countCR = 0; countCR < crValues.length; countCR++){
            operationDataArray.push(
                {
                    operationList: ["equalTo", "extractValues"],
                    preserve: true,
                    keyStringList: [keyStringList],
                    keyString: "Crstring",
                    dataValue: [crValues[countCR]],
                }
            )
            titles.push("CR: " + crValues[countCR])
        }
        const format = 'multipleHTMLtables' // 'singleHTMLtable' // 'raw'
        const orderedBy = "CRreal"
        const orderDirection = "ascending"
        return await this.getMonsters(operationDataArray,format,titles,orderedBy,orderDirection)
    }
    static async gimmeCRinRange(range){
        await this.#ready
        const pos1 = this.crList.filter(
            (value, index, array) => {
                return value.crString == range[0]
            }
        )[0].pos
        const pos2 = this.crList.filter(
            (value, index, array) => {
                return value.crString == range[1]
            }
        )[0].pos
        let resultList = []
        for(var countPos = Math.min(pos1,pos2); countPos <= Math.max(pos1,pos2); countPos++){
            resultList.push(this.crList[countPos])
        }
        return resultList
    }
    static findActorsInFolder(typeList = [], crFilterList = [], folderID = null){
        //await this.#ready
        let initList
        if(folderID === null){
            initList = game.actors.filter(
                (value, index, array) => {
                    return value.folder === null
                }
            )
        }
        else{
            initList = game.actors.filter(
                (value, index, array) => {
                    return (value.folder !== null)&&(value.folder.id == folderID)
                }
            )
        }
        const filteredList = initList.filter(
            (value,index,array) => {
                return (
                    (
                        (typeList.length == 0) ||
                        (typeList.includes(value.type))
                    ) && ( 
                        (crFilterList.length == 0) || 
                        ((value.system.details.cr !== undefined)&&(crFilterList.includes(value.system.details.cr))) 
                    ) 
                )
            }
        )
        return filteredList
    }
    static findSubfolders(folderID = null){
        let filteredList
        if(folderID === null){
            filteredList = game.actors.folders.filter(
                (value,index,array) => {
                    return value.depth == 1
                }
            )
        }
        else{
            const requestedFolder = game.actors.folders.filter(
                (value,index,array) => {
                    return value.id == folderID
                }
            )
            if(requestedFolder.length == 0) return null
            const children = requestedFolder[0].children
            filteredList = []
            for(const eachChild of children){
                filteredList.push(eachChild.folder)
            }
        }
        return filteredList
    }
    static findActorsInSubfolders(typeList = [], crFilterList = [], folderID = null, dropActors = false){
        let objReturn = {id:folderID, actorList: [], folderList:[]}
        if(folderID === null){
            objReturn.depth = 0
            objReturn.name= "Root"
        }
        else{
            const requestedFolder = game.actors.folders.filter(
                (value,index,array) => {
                    return value.id == folderID
                }
            )
            if(requestedFolder.length == 0) return null
            objReturn.depth = requestedFolder[0].depth
            objReturn.name = requestedFolder[0].name
        }
        if(!dropActors){
            const myActors = this.findActorsInFolder(typeList, crFilterList, folderID);
            for(const eachActor of myActors){
                objReturn.actorList.push(
                    {
                        id: eachActor.id, 
                        name: eachActor.name,
                        type: eachActor.type, 
                        cr: eachActor.system.details.cr,
                        details: generalUtils.createCopy(eachActor.system.details),
                    }
                )
            }
        }
        const mySubfolders = this.findSubfolders(folderID)
        if(mySubfolders === null) return null
        for(const eachSub of mySubfolders){
            objReturn.folderList.push(
                this.findActorsInSubfolders(typeList, crFilterList, eachSub.id, dropActors)
            )
        }
        objReturn.hasActors = objReturn.actorList.length > 0 ? true : false
        objReturn.hasFolder = objReturn.folderList.length > 0 ? true : false
        return objReturn
    }
    static async HTMLofActorsInSubfolders(folderObj){
        const partResponse = await fetch(`${nyqModPath}/${templatesFolder}/actors-in-subfolders-partial.hbs`)
        if(!partResponse.ok) return
        const partText = await partResponse.text() 
        var partCompiled = Handlebars.compile(partText)
        Handlebars.registerPartial('actorsInSubfoldersPartial', partCompiled);
        const templateResponse = await fetch(`${nyqModPath}/${templatesFolder}/actors-in-subfolders.hbs`)
        if(!templateResponse.ok) return
        const templateText = await templateResponse.text()
        var templateCompiled = Handlebars.compile(templateText)
        const myHTML = templateCompiled(folderObj)
        return myHTML
    }
}

export { encounterHelper }