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

//folder for the templates (warninf it is in a subfolder of nyqModPath)
const applicationTemplatesFolder = "nyqTemplates/createCharacter2024"

//file to be read
const classListFile = {
    path: "dnd2024",
    name: "classes",
    operations: ['addField'],
    operationKeysAndValues: {
        'fieldName': "selected",
        'fieldValue': false,
        'preserve': true,
    }
}
const backgroundListFile = {
    path: 'dnd2024',
    name: 'backgrounds',
    operations: ['addField'],
    operationKeysAndValues: {
        'fieldName': "selected",
        'fieldValue': false,
        'preserve': true,
    }
}
const specieListFile = {
    path: 'dnd2024',
    name: 'species',
    operations: ['addField'],
    operationKeysAndValues: {
        'fieldName': "selected",
        'fieldValue': false,
        'preserve': true,
    }
}
const statsListFile = {
    path: 'dnd2024',
    name: 'statList',
    operations: ['addField'],
    operationKeysAndValues: {
        'fieldName': "value",
        'fieldValue': 8,
        'preserve': true,
    }
}
const skillListFile = {
    path: 'dnd2024',
    name: 'skillList',
    operations: ['addField'],
    operationKeysAndValues: {
        'fieldName': "prof",
        'fieldValue': false,
        'preserve': true,
    }
}
const statScoreAndCostFile = {
    path: 'dnd2024',
    name: 'statCost',
    operations: ['extractValues'],
    operationKeysAndValues: {
        'keyStringList': [["score","bonus","cost"]],
        'preserve': true,
    }
}
const armorWeaponProficiencyFile = {
    path: 'dnd2024',
    name: 'armorWeaponProficiency',
    operations: ['extractValues'],
    operationKeysAndValues: {
        'keyStringList': [["name"]],
        'preserve': true,
    }
}

/*******************************************************************************
 * PARAMETERS END
 *******************************************************************************/

//utility class
class createCharacter2024{
    static #identityString = "[createCharacter2024] "
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
    static dataForGetFromTable(infoObject){
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
    static async getContentFromTable(tableInfoObject){
        this.#debug("filling an array")
        this.#debug("tableInfoObject",tableInfoObject)
        const {tableName, operationData} = this.dataForGetFromTable(tableInfoObject)
        this.#debug("tableName",tableName, "operationData", operationData)
        const loadedResult = await nyqModRef.nyqTables.getFromTable(tableName, operationData);
        this.#debug("loadedResult",loadedResult)
        return loadedResult
    }
    static async createActor(actorData){
        this.#debug("creating an actor","actorData:",actorData)
        const {
            actorName, chosenClass, chosenBackground, chosenSpecie, 
            skills, stats, armorsWeaponsProfs
        } = actorData
        console.log(stats)
        let myActor = await Actor.implementation.create(
            {
                name: actorName,
                type: "character"
            }
        )
        let myId = await myActor.id;
        const statsUpdates = []
        const mySystem = {
            abilities: {
                str: {value: stats[0].value},
                dex: {value: stats[1].value},
                con: {value: stats[2].value},
                int: {value: stats[3].value},
                wis: {value: stats[4].value},
                cha: {value: stats[5].value},
            }
        }
        statsUpdates.push({_id: myId, system: mySystem})
        this.#debug("updating stats with:","statsUpdates",statsUpdates)
        const statsResult = await Actor.implementation.updateDocuments(statsUpdates)
        //create item, type feat
        const itemData = [
            {name: "Initial Character Setup", type: "feat"},
        ]
        const createdItem = await Item.create(itemData, {parent: myActor})
        const myItemID = createdItem[0]._id
        //fetch the template for the item description
        const response = await fetch(`${nyqModPath}/${applicationTemplatesFolder}/char-review-small.hbs`)
        if(!response.ok)
            return
        const templateText = await response.text()
        var myDescription = Handlebars.compile(templateText)
        const chosenClassName = chosenClass === null ? 'null' : chosenClass.name
        const chosenBGname = chosenBackground === null ? 'null' : chosenBackground.nme
        const chosenSpecieName = chosenSpecie === null ? "null" : chosenSpecie.name
        const classChoices = chosenClass === null ? 0 : chosenClass.nSkillChoices
        const BGskills = chosenBackground === null ? Array(18).fill(0) : chosenBackground.skillSelection
        const statsRecommended = chosenClass === null ? Array(6).fill(8) : chosenClass.statsRecommended
        const statsPoints = chosenBackground === null ? Array(6).fill(0) : chosenBackground.statsSelection
        const armorsWeaponsProfsClass = chosenClass === null ? Array(7).fill(0) : chosenClass.armorsWeaponsProfs
        //organize the tables
        const tableStatsHeader = ['Stat','Value','Points','Recommended'];
        let tableStats = [];
        for(var i = 0; i < stats.length; i++){
            tableStats.push(
                {
                    stat: stats[i].name,
                    value: stats[i].value,
                    recommended: statsRecommended[i],
                    points: statsPoints[i],
                }
            )
        }
        const tableSkillsHeader = ['Skill', 'from Class','from BG'];
        let tableSkills = [];
        for(var i = 0; i < skills.length; i++){
            tableSkills.push(
                {
                    skill: skills[i].name,
                    class: skills[i].prof,
                    bg: BGskills[i],
                }
            )
        }
        const tableProfHeader = ['Proficiency','Obtained'];
		let tableProf = [];
        for(var i = 0; i < armorsWeaponsProfs.length; i++){
            tableProf.push(
                {
                    proficiency: armorsWeaponsProfs[i].name,
                    obtained: armorsWeaponsProfsClass[i],
                }
            )
        }

        const context = {
            tableStatsHeader: tableStatsHeader,
            tableStats: tableStats,
            tableSkillsHeader: tableSkillsHeader,
            tableSkills: tableSkills,
            tableProfHeader: tableProfHeader,
            tableProf: tableProf,
            chosenClass: chosenClassName,
            chosenBG: chosenBGname,
            chosenSpecie: chosenSpecieName,
            skillList: skills,
            statList: stats,
            armorsWeaponsProfs: armorsWeaponsProfs,
            classChoices: classChoices,
            BGskills: BGskills,
            statsRecommended: statsRecommended,
            statsPoints: statsPoints,
            armorsWeaponsProfsClass: armorsWeaponsProfsClass,
            actorName: actorName,
        }

        let myItemSystem = {
            description: {
                value: myDescription(context),
                chat: myDescription(context),
            }
        }
        const itemDescriptionUpdates = [
            {_id: myItemID, system: myItemSystem},
        ]
        const updatedItem = await Item.implementation.updateDocuments(itemDescriptionUpdates, {parent: myActor})
    }
}

//the class to be used by the application that provides static methods
const createCharacterClass = createCharacter2024
const { ApplicationV2: nyqHelpersAppV2, HandlebarsApplicationMixin: nyqHelpersHandlebars } = foundry.applications.api

//application class
class createCharacter2024app extends nyqHelpersHandlebars(nyqHelpersAppV2){
    #identityString = "[createCharacter2024app] "
    #debug(...inputList){
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
    #log(myString, type=null){ //only strings
        nyqLog(this.#identityString + myString.toString(), type)
    }
    #debugReport(){
        //this.#debug("internal structure",this)
        //this.#debug("trackerList:",this.trackerList)
        this.#debug("classList:",this.classList)
        this.#debug("backgroundList",this.backgroundList)
        this.#debug("specieList",this.specieList)
        this.#debug("skillList",this.skillList)
        this.#debug("statsList",this.statsList)
        this.#debug("statScoreAndCost",this.statScoreAndCost)
        this.#debug("armorsWeaponsProfs",this.armorsWeaponsProfs)
        this.#debug("defaultArmorsWeaponsProfs",this.defaultArmorsWeaponsProfs)
        this.#debug("defaultSkillSelectable",this.defaultSkillSelectable)
        this.#debug("defaultStatsRecommended",this.defaultStatsRecommended)
        this.#debug("defaultBGskills",this.defaultBGskills)
        this.#debug("defaultStatsPoints",this.defaultStatsPoints)
    }
    static #debugStaticParts(){}
    pleaseReport(){
        this.#debugReport()
    }
	
	initialized = false;

    selectedClass = -1;
	selectedBG = -1;
	selectedSpecie = -1;
	selectedMode = -1; //0: class, 1: Background, 2: specie
	actorName = 'New Test Actor';

    skillList = []  //*contains name:, prof: true | false
    statsList = []  //*contains name:, short:, value:
    classList = []   //*contains name:,selected: true | false, ID:, statPrincipale:, nSkillChoices:, motto:, skillSelectable: [false, true, ...], statsRecommended: [15, 13, 14, 10, 12, 8], armorsWeaponsProfs: [true, false,...]
    backgroundList = [] //*contains: name:, selected: 'false', ID: 0, tool: "Calligrapher's Supplies", skills: '', stats: '', feat: 'Magic Initiate (Cleric)', skillSelection: [false,false,true,...], statsSelection: [false,true,...],
    specieList = []     //*contains: name: 'Aasimar', selected: 'false', ID: 0, size: 'Medium or Small', speed: 30, traits: 'Celestial Resistance, Darkvision, Healing Hands, Light Bearer, Celestial Revelation,',
    
	pointBuyMax = 27;
	pointBuyRemaining = 27;
    statScoreAndCost = []   //*contains "score":,"bonus":,"cost":null | number

    armorsWeaponsProfs = [] //*contains name:

	defaultArmorsWeaponsProfs = []  //* [false,false,false,false,false,false,false];
	defaultSkillSelectable = []     //* [false,...,false];
	defaultStatsRecommended = []    //* [8,8,8,8,8,8,]
	defaultBGskills = []            //*['x','x','x','x','x','x','x','x','x','x','x','x','x','x','x','x','x','x',];
	defaultStatsPoints = []         //*[' ', ' ', ' ', ' ', ' ', ' '];

    async nyqInitialize(){
        //checking libraries
        for(const eachLib of libUsed){
            const loadedLibs = await nyqModRef.nyqTables.checkLibrary(eachLib)
        }
        //reading tables
        //classList,
        this.classList = await createCharacter2024.getContentFromTable(classListFile)
        this.#debug("classList fetched from library:",this.classList)
        //backgroundList
        this.backgroundList = await createCharacter2024.getContentFromTable(backgroundListFile)
        this.#debug("backgroundList fetched from library:",this.backgroundList)
        //specieList
        this.specieList = await createCharacter2024.getContentFromTable(specieListFile)
        this.#debug("specieList fetched from library:",this.specieList)
        //statsList
        this.statsList = await createCharacter2024.getContentFromTable(statsListFile)
        this.#debug("statsList fetched from library:",this.statsList)
        //skillList
        this.skillList = await createCharacter2024.getContentFromTable(skillListFile)
        this.#debug("skillList fetched from library:",this.skillList)
        //statsScoreAndCost
        this.statScoreAndCost = await createCharacter2024.getContentFromTable(statScoreAndCostFile)
        this.#debug("statsScoreAndCost fetched from library:",this.statScoreAndCost)
        //armorWeaponsProficiency
        this.armorsWeaponsProfs = await createCharacter2024.getContentFromTable(armorWeaponProficiencyFile)
        this.#debug("armorsWeaponsProfs fetched from library:",this.armorsWeaponsProfs)
        //defaults:
        this.defaultArmorsWeaponsProfs = Array(this.armorsWeaponsProfs.length).fill(false)
        this.defaultSkillSelectable = Array(this.skillList.length).fill(false)
        this.defaultStatsRecommended = Array(this.statsList.length).fill(8)
        this.defaultBGskills = Array(this.skillList.length).fill("x")
        this.defaultStatsPoints = Array(this.statsList.length).fill(' ')

        this.#debugReport()
        this.initialized = true
    }
    nyqBool2x(myArray){
        this.#debug("nyqBool2x","myArray",myArray)
        let newArray = []
        for(const eachElement of myArray){
            if(eachElement)
                newArray.push('x')
            else
                newArray.push(' ')
        }
        return newArray
    }
	nyqProf2x(myArray){
		let newArray = [];
		for(var i = 0; i < myArray.length; i++){
			switch(myArray[i]){
				case 0: 
					newArray.push(' ');
					break;
				case 1:
					newArray.push('x');
					break;
				case 0.5:
					newArray.push('~');
					break;
				default:
					newArray.push(myArray[i]);
					break;
			}
		}
		return newArray;
	}
    resetSkillsProfs(){
        for(var i = 0; i < this.skillList.length; i++){
            this.skillList[i].prof = false
        }
    }
    updateSelected(type){
        this.#debug("updating selected of type " + type)
        let whichList = [];
        let selectedValue = -1;
        switch(type){
            case 'class':
                whichList = this.classList
                selectedValue = this.selectedClass
                break
            case 'background':
                whichList = this.backgroundList
                selectedValue = this.selectedBG
                break
            case 'specie':
                whichList = this.specieList
                selectedValue = this.selectedSpecie
                break
        }
        for(var i = 0; i < whichList.length; i++){
            whichList[i].selected = i == selectedValue ? true : false
        }
        this.#debug("done, updated list:",whichList)
    }
    checkStatPoints(statsArray){ // statsArray: array with 6 stat values
        this.#debug("checked stat array","statsArray",statsArray)
        let result = {possible: false, remainingPoints: this.pointBuyMax}
        let forbidden = false
        let totalPoint = 0
        for(var i = 0; i < statsArray.length; i++){
            const selectedValues = this.statScoreAndCost.filter(
                (value, index, array) => {
                    return value.score == statsArray[i]
                }
            )
            this.#debug("selectedValues",selectedValues)
            if((selectedValues.length == 0)||(selectedValues[0].cost == null)){
                forbidden = true
                break
            }
            totalPoint += selectedValues[0].cost
        }
        if((!forbidden)&&(totalPoint <= this.pointBuyMax)){
            result.possible = true
            result.remainingPoints = this.pointBuyMax - totalPoint
        }
        this.#debug("forbidden",forbidden,"totalPoint",totalPoint)
        return result
    }

    static myAction(event, target){
        //console.log("this is myAction")
        const clickedElement = target.getAttribute("Class");
        switch(clickedElement){
            case 'nyqButton':
                let selectedMode = target.getAttribute('id')
                switch(selectedMode){
                    case 'btnClasses':
                        this.selectedMode = this.selectedMode == 0 ? -1 : 0
                        break
                    case 'btnBG':
                        this.selectedMode = this.selectedMode == 1 ? -1 : 1
                        break
                    case 'btnSpecies':
                        this.selectedMode = this.selectedMode == 2 ? -1 : 2
                        break
                }
                this.render(true)
                break
            case 'singleClassName':
                let chosenClass = parseInt(target.getAttribute('data-classID'))
                this.selectedClass = chosenClass == this.selectedClass ? -1 : chosenClass
                this.updateSelected('class')
                this.resetSkillsProfs()
                this.render(true)
                break
            case 'singleBGname':
                let chosenBG = parseInt(target.getAttribute('data-ID'))
                this.selectedBG = chosenBG == this.selectedBG ? -1 : chosenBG
                this.updateSelected('background')
                //this.resetSkillsProfs()
                this.render(true)
                break
            case 'singleSpecieName':
                let chosenSpecie = parseInt(target.getAttribute('data-ID'))
                this.selectedSpecie = chosenSpecie == this.selectedSpecie ? -1 : chosenSpecie
                this.updateSelected('specie')
                this.render(true)
                break
            case 'nyqStoreName':
                let mySelector = this.element.querySelectorAll('.aName')
                this.actorName = mySelector[0].value
                break
            case 'nyqStoreResult':
                const actorData = {
                    actorName: this.actorName,
                    chosenClass: this.selectedClass > -1 ? this.classList[this.selectedClass] : null,
                    chosenBackground: this.selectedBG > -1 ? this.backgroundList[this.selectedBG] : null,
                    chosenSpecie: this.selectedSpecie > -1 ? this.specieList[this.selectedSpecie] : null,
                    skills: this.skillList,
                    stats: this.statsList,
                    armorsWeaponsProfs: this.armorsWeaponsProfs,
                }
                createCharacter2024.createActor(actorData) //this is async!
                break
            case 'checkSkillList':
                let selectedSkill = parseInt(target.getAttribute('data-ID'))
                this.skillList[selectedSkill].prof = !this.skillList[selectedSkill].prof
                break
            case 'stat-value-button':
                let newStatList = []
                for(const eachStat of this.statsList){
                    newStatList.push(eachStat.value)
                }
                let selectedStat = parseInt(target.getAttribute('data-id'))
                let selectedDirection = target.getAttribute('data-type')
                newStatList[selectedStat] += selectedDirection =='increase' ? 1 : -1
                const statCheck = this.checkStatPoints(newStatList)
                console.log(statCheck)
                console.log(newStatList)
                console.log(this.statsList)
                if(statCheck.possible){
                    this.statsList[selectedStat].value = newStatList[selectedStat]
                    this.pointBuyRemaining = statCheck.remainingPoints
                }
                this.render(true)
                break
        }

        createCharacter2024app.#debugStaticParts()
    }
    static PARTS = {
		header: { template: `${nyqModPath}/${applicationTemplatesFolder}/header.hbs`},
		classList: {template: `${nyqModPath}/${applicationTemplatesFolder}/class-list.hbs`},
		backgroundList: {template: `${nyqModPath}/${applicationTemplatesFolder}/background-list.hbs`},
		speciesList: {template: `${nyqModPath}/${applicationTemplatesFolder}/species-list.hbs`},
		charReview: {template: `${nyqModPath}/${applicationTemplatesFolder}/char-review.hbs`},
		footer: {template: `${nyqModPath}/${applicationTemplatesFolder}/footer.hbs`},
		//footer: {template: "templates/generic/form-footer.hbs",},
	}
	static DEFAULT_OPTIONS = {
		position: {
			left: 100,
			width: 700,
			height: 700,
		},
		window: {
			resizable: true,
			title: "New Character Assist",
			icon: "fa-solid fa-user-plus",
			contentClasses: ['nyqWindowContent'],
		},
		actions: {
			myAction: createCharacter2024app.myAction
		}
	}
	_configureRenderOptions(options){
		super._configureRenderOptions(options);
		options.parts =['header'];
		options.parts.push('footer');
		options.parts.push('classList');
		options.parts.push('backgroundList');
		options.parts.push('speciesList');
		options.parts.push('charReview');
	}
    async _preparePartContext(partId, context){
        if(!this.initialized) {
            await this.nyqInitialize()
        }
        let hideMe = true;
        switch(partId){
            case 'header':
                console.log(game.i18n.localize("header.text"))
                break;
            case 'footer':
				context = {
					buttons: [
						{ type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" },
						{ type: "reset", action: "reset", icon: "fa-solid fa-undo", label: "SETTINGS.Reset" },
					]
				}
				break;
            case 'classList':
                if(this.selectedMode == 0)
                    hideMe = false
                context = {
                    classes: this.classList,
                    hideMe: hideMe,
                }
                //console.log(this.classList)
                break;
            case 'backgroundList':
                if(this.selectedMode == 1)
                    hideMe = false
                context = {
                    backgrounds: this.backgroundList,
                    hideMe: hideMe,
                }
                break;
            case 'speciesList':
                if(this.selectedMode == 2)
                    hideMe = false
                context = {
                    species: this.specieList,
                    hideMe: hideMe
                }
                break;
            case 'charReview':{
                let chosenClassName = this.selectedClass > -1 ? this.classList[this.selectedClass].name : 'null'
                let classChoices = this.selectedClass > -1 ? this.classList[this.selectedClass].nSkillChoices : 0
                let statsRecommended = this.selectedClass > -1 ? this.classList[this.selectedClass].statsRecommended : this.defaultStatsRecommended
                let armorsWeaponsProfsClass = this.selectedClass > -1 ? this.nyqProf2x(this.classList[this.selectedClass].armorsWeaponsProfs) : this.defaultArmorsWeaponsProfs
                let skillsSelectables = this.selectedClass > -1 ? this.classList[this.selectedClass].skillSelectable : this.defaultSkillSelectable
                let skillChecks = [];
                for(var i = 0; i < this.skillList.length; i++){
                    let newObj = {
                        name: this.skillList[i].name,
                        checked: this.skillList[i].prof,
                        disabled: !skillsSelectables[i],
                    }
                    skillChecks.push(newObj)
                }
                let chosenBGName = this.selectedBG > -1 ? this.backgroundList[this.selectedBG].name : 'null'
                let BGskills = this.selectedBG > -1 ? this.nyqBool2x(this.backgroundList[this.selectedBG].skillSelection) : this.defaultBGskills
                let statsPoints = this.selectedBG > -1 ? this.nyqBool2x(this.backgroundList[this.selectedBG].statsSelection) : this.defaultStatsPoints
                let chosenSpecieName = this.selectedSpecie > -1 ? this.specieList[this.selectedSpecie].name : 'null'
				context = {
					skillChecks: skillChecks,
					chosenClass: chosenClassName,
					chosenBG: chosenBGName,
					chosenSpecie: chosenSpecieName,
					skillList: this.skillList,
					statList: this.statsList,
					armorsWeaponsProfs: this.armorsWeaponsProfs,
					classChoices: classChoices,
					BGskills: BGskills,
					statsRecommended: statsRecommended,
					statsPoints: statsPoints,
					armorsWeaponsProfsClass: armorsWeaponsProfsClass,
					actorName: this.actorName,
					pointBuyRemaining: this.pointBuyRemaining,
				}
                break;
            }
        }
        return context
    }
}

function showCreateCharacterApp() {
    let myNewApp = new createCharacter2024app;
    myNewApp.render(true);
}

export { createCharacter2024, createCharacter2024app, showCreateCharacterApp}
