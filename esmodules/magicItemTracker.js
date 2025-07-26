/********************************************************************************
 * PARAMETERS
 *******************************************************************************/

//libraries of json files used by magicItemTrackerClass
const libUsed = [
    "modules/nyquistt-helpers/nyqLibs/lib-dnd5e2024.json",
]

//folder for the templates (warninf it is in a subfolder)
const applicationTemplatesFolder = "nyqTemplates/magicItemTracker"

//file for the magicItemDistribution
const magicItemDistributionFile = {
    path: "dnd5e2024",
    name: "magic-items-distribution",
}

//flag used to store info into the item tracker actor and item
const characterFlagName = "awardedItem"
const itemFlagName = "isMagicItemTracker"   //either true or false
/*awardedItem structure
{
	"level1": {
		"minLevel": 1,"maxLevel": 4,
		"common": {"max": 6,"value": 6},
		"uncommon": {"max": 4, "value": 0},
		"rare": {"max": 1,"value": 0},
		"veryRare": {"max": 0,"value": 0},
		"legendary": {"max": 0,"value": 0},
		"artifact": {"max": null,"value": 0}
	},
	"level5": {
		"minLevel": 5, "maxLevel": 10,
		"common": {"max": 10,"value": 0},
		"uncommon": {"max": 17,"value": 0},
		"rare": {"max": 6,"value": 4},
		"veryRare": {"max": 1,"value": 0},
		"legendary": {"max": 0,"value": 0},
		"artifact": {"max": null,"value": 0}
	},
	"level11": {
		"minLevel": 11,"maxLevel": 16,
		"common": {"max": 3,"value": 0},
		"uncommon": {"max": 7,"value": 0},
		"rare": {"max": 11,"value": 0},
		"veryRare": {"max": 7,"value": 0},
		"legendary": {"max": 2,"value": 0},
		"artifact": {"max": null,"value": 0}
	},
	"level17": {
		"minLevel": 17,"maxLevel": null,
		"common": {"max": 0,"value": 0},
		"uncommon": {"max": 0,"value": 0},
		"rare": {"max": 5,"value": 0},
		"veryRare": {"max": 11,"value": 0},
		"legendary": {"max": 9,"value": 0},
		"artifact": {"max": null,"value": 0}
	}
}
*/

/*******************************************************************************
 * PARAMETERS END
 *******************************************************************************/


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
const nyqDebug = nyqModRef.nyqDebug
/********************************************************************************
 * DONT TOUCH THIS - END
 *******************************************************************************/

class magicItemTracker{
    static #identityString = "magicItemTracker"
    static #debug(...inputList){
		nyqDebug(this.#identityString, ...inputList)
    }
    static #log(myString, type=null){ //only strings
        nyqLog(myString.toString(),this.#identityString, type)
    }
    static #debugReport(){
        //this.#debug("internal structure",this)
        this.#debug("magicItemDistribution:",this.#magicItemDistribution)
    }
    static pleaseReport(){
        this.#debugReport()
    }
    static #magicItemDistribution = [];
    static {
        this.#initializeMe()
    }
    static async #initializeMe(){
        for(const eachLib of libUsed){
            const loadedLibs = await nyqModRef.nyqTables.checkLibrary(eachLib)
        }
        const tableName = magicItemDistributionFile.path + "." + magicItemDistributionFile.name
        const operationData = {
            operationList: ["extractValues"],
            keyStringList: [["minLevel", "maxLevel", "common", "uncommon", "rare", "veryRare", "legendary", "artifact"]],
        }
        const loadResult = await nyqModRef.nyqTables.getFromTable(tableName, operationData);
        for(const eachResult of loadResult){
            this.#magicItemDistribution.push(eachResult)
        }
        this.#debugReport()
    }
	static async createMagicItemTrackerActor(actorName = "Mr Item Tracker"){
        this.#debug("creating magic item tracker")
		const mrTrackerName = actorName;
		const checkActor = game.actors.getName(mrTrackerName);
		if(!checkActor){
            this.#debug("creating tracker actor " + mrTrackerName)
			let myActor = await Actor.implementation.create({
				name: mrTrackerName,
				type: "character",
			});
            this.#debug("created actor:",myActor)
			let myID = myActor.id;
			for(var i = 0; i < this.#magicItemDistribution.length; i++){
				const flagName = characterFlagName + ".level" + this.#magicItemDistribution[i].minLevel;
				await myActor.setFlag(moduleId,flagName + ".minLevel",this.#magicItemDistribution[i].minLevel);
				await myActor.setFlag(moduleId,flagName + ".maxLevel",this.#magicItemDistribution[i].maxLevel);
				const myKeys = Object.keys(this.#magicItemDistribution[i]);
				//console.log(myKeys)
				for(var j = 0; j < myKeys.length; j++){
					if((myKeys[j] != "minLevel") && (myKeys[j] != "maxLevel")){
						await myActor.setFlag(moduleId,flagName + "." + myKeys[j] + "." + "max",this.#magicItemDistribution[i][myKeys[j]]);
						await myActor.setFlag(moduleId,flagName + "." + myKeys[j] + "." + "value",0);
					}
				}
			}
			await this.updateItemTrackerActor(myActor.id);
            this.#debug("finished creating " + actorName)
		}
		else{
            this.#log("the tracker actor " + actorName.toString() + " already exists","warn")
		}
	}
	static async getItemTrackerActors(){
		const allActors = game.actors;
		//console.log(allActors, allActors.length)
		let resultList = [];
		for(const eachActor of allActors){
			let myObj = {};
			try{
				myObj = await eachActor.getFlag(moduleId, characterFlagName);
				if(myObj) {
                    this.#debug("found a tracker actor",eachActor)
					//console.log(myObj)
					resultList.push(eachActor);
				}
				else {
                    this.#debug(eachActor.name + " is not a tracker actor")
				}
			} catch(error) {
                this.#debug(eachActor.name + " is not a tracker actor")
				console.log(error)
			}
		}
        this.#debug("tracker actors found:",resultList)
		return resultList;
	}
    static async getItemTrackerWithId(id){
		const searchedActor = await game.actors.get(id)
		if(!searchedActor) return null
		return searchedActor
        const wholeTrackerList = await this.getItemTrackerActors()
        if(wholeTrackerList.length == 0){
            return null
        }
        const filteredList = wholeTrackerList.filter(
            (value, index, array) => {
                return value.id == id
            }
        )
        if(filteredList.length == 0){
            return null
        }
        return filteredList[0]
    }
    static async storeAwardedItemIntoActor(actorId, awardedItem){
        const theTracker = await this.getItemTrackerWithId(actorId)
		console.log(actorId)
		console.log(awardedItem)
		console.log(theTracker)
        await theTracker.setFlag(moduleId, characterFlagName, awardedItem)
    }
    static async getAwardedItemFromActor(actorId){
        const theTracker = await this.getItemTrackerWithId(actorId)
        return theTracker.getFlag(moduleId,characterFlagName)
    }
    static async updateItemTrackerActor(actorId, updates = []){
        this.#debug("tryin updating tracker actor, id: ", actorId)
        //static async updateItemTrackerActor(trackerActor,updates = []){
        const trackerActor = await this.getItemTrackerWithId(actorId);
		let validActor = false;
		let currentItems = {}
		try{
			currentItems = await trackerActor.getFlag(moduleId, characterFlagName);
			if (currentItems) validActor = true;
		} catch {
            this.#log("you must provide a valid tracker actor","warn")
		}
		if(!validActor) return {result: "error", errorType: "provide a valid tracker actor"};
		/*
		updates = [
			{
				playerLevel: 1,
				rarity: "common" | "uncommon" | "rare" | "veryRare" | "legendary",
				operation: "set" | "increase" | "decrease",
				amount: <number>,
			}
		]
		*/
		for(var i = 0; i < updates.length; i++){
			let usableLevels = this.#magicItemDistribution.filter(
				(value, index, array) => {
					return value.minLevel <= updates[i].playerLevel;
				}
			)
			usableLevels.sort(
				(a,b) => {
					return b.minLevel - a.minLevel; //descending
				}
			)
			const flagLevel = usableLevels[0].minLevel;
			//console.log(flagLevel);
			//check existance and fetch data
			const flagLong = characterFlagName + '.' + 'level' + flagLevel + '.' + updates[i].rarity + '.value';
			let validUpdate = true;
			let oldValue = 0;
			let newValue = updates[i].amount;
			if(newValue === null) validUpdate = false;
			try {
				oldValue = await trackerActor.getFlag(moduleId,flagLong);
				if(oldValue === null) validUpdate = false;
			} catch {
				validUpdate = false;
			}
			switch(updates[i].operation){
				case "set":
					break;
				case "increase":
					newValue += oldValue;
					break;
				case "decrease":
					newValue = oldValue - newValue;
					break;
				default:
					validUpdate = false;
					break;
			}
			if(!validUpdate) {
                this.#debug("skipping update number " + i)
				continue;
			}
            this.#log("updating " + flagLong + " with " + newValue)
			await trackerActor.setFlag(moduleId,flagLong,newValue);
		}
		const newAwardedItem = await trackerActor.getFlag(moduleId,characterFlagName);
		const myHTML = await this.getTrackerActorItemHTML(newAwardedItem);
        this.#debug("received item HTML:",myHTML)
		//console.log(trackerActor);
		const itemList = trackerActor.items;
		let magicItemTrackerFound = false;
		let magicItemTrackerObject = {};
		for(const singleItem of itemList){
			//console.log(singleItem)
			let isMagicItemTracker = false;
			try{
				isMagicItemTracker = singleItem.getFlag(moduleId,itemFlagName);
			} catch {
				continue;
			}
			if(!isMagicItemTracker) continue;
			magicItemTrackerFound = true;
			magicItemTrackerObject = singleItem;
			break;
		}
		if(!magicItemTrackerFound){ //create the item
			const itemOptions = {name: "Magic Item Tracker", type: "loot"};
			magicItemTrackerObject = await Item.create(itemOptions, {parent: trackerActor});
			//console.log(magicItemTrackerObject)
			await magicItemTrackerObject.setFlag(moduleId,itemFlagName,true);
            this.#debug("tracker item created for this actor",magicItemTrackerObject)
		}
		const myItemID = magicItemTrackerObject._id;
		const myItemSystem = {
			description: {
				value: myHTML,
				chat: myHTML,
			}
		};
		const myUpdates = [
			{_id: myItemID, system: myItemSystem},
		];
		const updatedItem = await Item.implementation.updateDocuments(myUpdates, {parent: trackerActor});
        this.#debug("actor updated","awarderItem:",newAwardedItem,"itemHTML:", myHTML)
		return {result: "success", awardedItem: newAwardedItem, itemHTML: myHTML}
	}
	static async getTrackerActorItemHTML(awardedItem={}){
		//console.log("[getTrackerActorItemHTML] received awardedItem")
		//console.log(awardedItem)
		let tierList = [];
		for(var i = 0; i < Object.keys(awardedItem).length; i++){
			tierList.push("Tier " + (i+1));
		}
		const tableLines = this.nyqTransposeAwardedItem(awardedItem);
		//console.log(tableLines)
		const context = {
			tierList: tierList,
			tableLines: tableLines,
		}
		//console.log("[getTrackerActorItemHTML] HTML context")
		//console.log(context);
		const response = await fetch(`${nyqModPath}/${applicationTemplatesFolder}/tracker-actor-item-description.hbs`);
		if (!response.ok) return 'empty';
		//extract text
		const templateText = await response.text();
		//compile the tamplate
		var myDescription = Handlebars.compile(templateText);
		const myHTML = await myDescription({context: context});
		//console.log(myHTML);
		return myHTML;
	}
    //awardedItem structure:
		/*
		{
			"level1": {
				"minLevel": 1,"maxLevel": 4,
				"common": {"max": 6,"value": 6},
				"uncommon": {"max": 4, "value": 0},
				"rare": {"max": 1,"value": 0},
				"veryRare": {"max": 0,"value": 0},
				"legendary": {"max": 0,"value": 0},
				"artifact": {"max": null,"value": 0}
			},
			"level5": {
				"minLevel": 5, "maxLevel": 10,
				"common": {"max": 10,"value": 0},
				"uncommon": {"max": 17,"value": 0},
				"rare": {"max": 6,"value": 4},
				"veryRare": {"max": 1,"value": 0},
				"legendary": {"max": 0,"value": 0},
				"artifact": {"max": null,"value": 0}
			},
			"level11": {
				"minLevel": 11,"maxLevel": 16,
				"common": {"max": 3,"value": 0},
				"uncommon": {"max": 7,"value": 0},
				"rare": {"max": 11,"value": 0},
				"veryRare": {"max": 7,"value": 0},
				"legendary": {"max": 2,"value": 0},
				"artifact": {"max": null,"value": 0}
			},
			"level17": {
				"minLevel": 17,"maxLevel": null,
				"common": {"max": 0,"value": 0},
				"uncommon": {"max": 0,"value": 0},
				"rare": {"max": 5,"value": 0},
				"veryRare": {"max": 11,"value": 0},
				"legendary": {"max": 9,"value": 0},
				"artifact": {"max": null,"value": 0}
			}
		}
		*/
    static nyqTransposeAwardedItem(awardedItem){
        const awardedItemList = []
        for(const [key, value] of Object.entries(awardedItem)){
            awardedItemList.push(value)
        }
        awardedItemList.sort(
            (a,b) => {
                return a.minLevel - b.minLevel //ascending
            }
        )
        //const awardedItemList = this.nyqListifyObject(awardedItem,"minLevel","ascending") //now i have an array
		let tableLines = [];
		let rollTotals = []
		const tierKeys = Object.keys(awardedItemList[0]);
		for(var i = 0; i < tierKeys.length; i++){  //need to transpose the table: the keys of each awardedItemList[i] are the first colun values of the final table
			let newLine = [];
			newLine.push(tierKeys[i]);
			for(var j = 0; j < awardedItemList.length; j++){ //the number of columns is the number of rows of awardedItemList
				if((tierKeys[i] === "minLevel") || (tierKeys[i] === "maxLevel"))
					newLine.push(awardedItemList[j][tierKeys[i]] !== null && awardedItemList[j][tierKeys[i]] !== Infinity && awardedItemList[j][tierKeys[i]] !== "Infinity" ? awardedItemList[j][tierKeys[i]] : "??");
				else{
					let newString = (awardedItemList[j][tierKeys[i]].value !== null && awardedItemList[j][tierKeys[i]].value !== Infinity && awardedItemList[j][tierKeys[i]].value !== "Infinity") ? awardedItemList[j][tierKeys[i]].value : "??"
					newString += "/";
					newString += (awardedItemList[j][tierKeys[i]].max !== null && awardedItemList[j][tierKeys[i]].max !== Infinity && awardedItemList[j][tierKeys[i]].max !== "Infinity") ? awardedItemList[j][tierKeys[i]].max : "??";
					newLine.push(newString);
					if(rollTotals[j] === undefined) rollTotals[j] = 0
					rollTotals[j] += (awardedItemList[j][tierKeys[i]].max !== null && awardedItemList[j][tierKeys[i]].max !== Infinity && awardedItemList[j][tierKeys[i]].max !== "Infinity") ? awardedItemList[j][tierKeys[i]].max : 0
					rollTotals[j] -= (awardedItemList[j][tierKeys[i]].value !== null && awardedItemList[j][tierKeys[i]].value !== Infinity && awardedItemList[j][tierKeys[i]].value !== "Infinity") ? awardedItemList[j][tierKeys[i]].value : 0
				}
			}
			tableLines.push(newLine);
		}
		let newLine = ['Rolls']
		for(const eachTotal of rollTotals){
			newLine.push('[[/r 1d' + eachTotal.toString() + ']]')
		}
		tableLines.push(newLine)
		//console.log(rollTotals)
		//console.log(tableLines)
		return tableLines;
	}
}


//the class to be used by the application that provides static methods
const magicItemTrackerClass = magicItemTracker



const { ApplicationV2: nyqHelpersAppV2, HandlebarsApplicationMixin: nyqHelpersHandlebars } = foundry.applications.api

class MagicItemTrackerApp extends nyqHelpersHandlebars(nyqHelpersAppV2){
    #identityString = "MagicItemTrackerApp"
    #debug(...inputList){
		nyqDebug(this.#identityString, ...inputList)
    }
    #log(myString, type=null){ //only strings
        nyqLog(myString.toString(), this.#identityString, type)
    }
    #debugReport(){
        //this.#debug("internal structure",this)
        this.#debug("trackerList:",this.trackerList)
    }
    pleaseReport(){
        this.#debugReport()
    }
    //what to show in the specific app instance
	showing = {headerPart: true, buttonsPart: true, trackerList: true, modifyPart: false, trackerDetails: false}
    //the list of trackers found in the specific application instance
    //each element of the list is
    //{
    // name: ,
    // id: ,
    // [characterFlagName]: ,
    // checked: ,
    // modified: ,
    //}
	trackerList = [];
    //read all the tracker actors from the game
	async updateTrackerList(){
		this.#debug("updating tracker list")
		const trackerListComplete = await magicItemTrackerClass.getItemTrackerActors()
		let newTrackerList = [];
		for(var i = 0; i < trackerListComplete.length; i++){
			let myObj = {
				name: trackerListComplete[i].name,
				id: await trackerListComplete[i].id,
				awardedItem: generalUtils.createCopy(await magicItemTrackerClass.getAwardedItemFromActor(trackerListComplete[i].id)),
			}
			const existentTracker = this.trackerList.filter(
				(value, index, array) => {
					return value.id == myObj.id;
				}
			)
			myObj.checked = existentTracker.length ? existentTracker[0].checked : false;
			myObj.modified = existentTracker.length ? existentTracker[0].modified : false;
			if(myObj.modified){	//keep the modified version
				newTrackerList.push(generalUtils.createCopy(existentTracker[0]))
			}
			else //update with the new value
				newTrackerList.push(myObj);
		}
		this.trackerList = newTrackerList;
		console.log("[updateTrackerList]")
		console.log(this.trackerList)
		this.#debugReport()
	}
    //udates the trackers actors
	async updateCheckedTracker(){
		this.#debug("updating checked tracker")
		let checkedTrackerExists = false;
		for(var i = 0; i < this.trackerList.length; i++){
			if(this.trackerList[i].checked){
				const existentTracker = await magicItemTrackerClass.getItemTrackerWithId(this.trackerList[i].id)
				if(existentTracker !== null){
					checkedTrackerExists = true
					await magicItemTrackerClass.storeAwardedItemIntoActor(existentTracker.id, this.trackerList[i].awardedItem);
					const updatingResult = await magicItemTrackerClass.updateItemTrackerActor(existentTracker.id);
					console.log("[updateCheckedTracker] updating result",updatingResult)
					this.trackerList[i].modified = false;
					break
				}
			}
		}
		if(!checkedTrackerExists){
			this.updateTrackerList()
		}
		this.#debugReport()
	}
	updateCheckedAwardedItem(awardedItemTier,awardedItemType,direction){
		this.#debug("updating checked awarded item")
		for(var i = 0; i < this.trackerList.length; i++){
			if(this.trackerList[i].checked){
				this.trackerList[i].modified = true;
				/*if(isNaN(this.trackerList[i].awardedItem[awardedItemTier][awardedItemType])){
					this.trackerList[i].awardedItem[awardedItemTier][awardedItemType] = 0
				}
				else*/
				if(this.trackerList[i].awardedItem[awardedItemTier][awardedItemType] === Infinity){
					this.trackerList[i].awardedItem[awardedItemTier][awardedItemType] = 0
				}
				else if(this.trackerList[i].awardedItem[awardedItemTier][awardedItemType] === "Infinity"){
					this.trackerList[i].awardedItem[awardedItemTier][awardedItemType] = 0
				}
				else{
					const myAdd = (direction == "increase") ? 1 : -1;
					if((awardedItemType === "minLevel")||(awardedItemType === "maxLevel"))
						this.trackerList[i].awardedItem[awardedItemTier][awardedItemType] += myAdd;
					else
						this.trackerList[i].awardedItem[awardedItemTier][awardedItemType].value += myAdd;
				}
			}
		}
		this.#debugReport()
	}
	checkedModified(){
		let currentModified = false;
		const checkedTrackerList = this.trackerList.filter(
			(value, index, array) => {
				return value.checked;
			}
		)
		if(checkedTrackerList.length){
			currentModified = checkedTrackerList[0].modified;
		}
		return currentModified;
	}
	checkedAwardedItem(){
		const checkedTrackerList = this.trackerList.filter(
			(value, index, array) => {
				return value.checked;
			}
		)
		console.log("checkedTrackerList")
		console.log(checkedTrackerList)
		let currentAwardedItem = {}
		if(checkedTrackerList.length){
			console.log("checkedTrackerList[0].awardedItem")
			console.log(checkedTrackerList[0].awardedItem)
			currentAwardedItem = checkedTrackerList[0].awardedItem;
		}
		return currentAwardedItem;
	}
	static async myAction(event, target){
		const clickedElement = target.getAttribute("Class");
		console.log(clickedElement)
		console.log(event)
		console.log(target)
		switch(clickedElement){
			case "nyqButton":
				let buttonID = target.getAttribute('id');
				switch(buttonID){
					case "btnListTrackers":
						this.showing.trackerList = !this.showing.trackerList;
						break;
					case "btnModifyTracker":
						this.showing.modifyPart = !this.showing.modifyPart;
						break;
					case "btnTrackerAdd":
						let mySelector = this.element.querySelectorAll('.txtTrackerAdd');
						//console.log(mySelector)
						let trackerName = mySelector[0].value;
						await magicItemTrackerClass.createMagicItemTrackerActor(trackerName);
						break;
					case "btnUpdateCheckedTracker":
						await this.updateCheckedTracker()
						break;
				}
				this.render(true);
				break;
			case "itemTrackerCheck":
				let checkID = target.getAttribute('id');
				for(var i = 0; i < this.trackerList.length; i++){
					if(this.trackerList[i].id == checkID){
						this.trackerList[i].checked = !this.trackerList[i].checked;
						this.showing.modifyPart = this.trackerList[i].checked;
					} else {
						this.trackerList[i].checked = false;
					}
				}
				this.render(true);
				break;
			case "awardedItemValueButton":
				this.trackerListModified = true;
				const awardedItemValueID = target.getAttribute('id');
				const [awardedItemTier, awardedItemType] = awardedItemValueID.split(".");
				const direction = target.getAttribute('data-type');
				//console.log(awardedItemTier,awardedItemType,direction)
				this.updateCheckedAwardedItem(awardedItemTier,awardedItemType,direction);
				this.render(true)
				break;
		}
	}

    /**
     * foundry appV2 specifics
     */
	static PARTS = {
		headerPart: { template: `${nyqModPath}/${applicationTemplatesFolder}/magic-items-tracker-top.hbs`},
		buttonsPart: { template: `${nyqModPath}/${applicationTemplatesFolder}/magic-items-tracker-buttons.hbs`},
		trackerList: { template: `${nyqModPath}/${applicationTemplatesFolder}/magic-items-tracker-list-trackers.hbs`},
		modifyPart: { template: `${nyqModPath}/${applicationTemplatesFolder}/magic-items-tracker-modify-tracker.hbs`},
		trackerDetails: { template: `${nyqModPath}/${applicationTemplatesFolder}/magic-items-tracker-details.hbs`},
	}
	static DEFAULT_OPTIONS = {
		position: {
			left: 100,
			width: 700,
			height: 800,
		},
		window: {
			resizable: true,
			title: "Magic Items Tracker",
			icon: "fa-solid fa-user-plus",
			contentClasses: ['nyqWindowContent'],
		},
		actions: {
			myAction: MagicItemTrackerApp.myAction
		}
	}
	_configureRenderOptions(options){
		super._configureRenderOptions(options);
		options.parts =['headerPart'];
		options.parts.push('buttonsPart');
		options.parts.push('trackerList');
		options.parts.push('modifyPart');
		options.parts.push('trackerDetails');
	}
	async _preparePartContext(partId, context) {
		let hideMe = false;
		switch(partId){
			case 'headerPart':
				hideMe = !this.showing.headerPart;
				context = {
					hideMe: hideMe,
				}
				break;
			case 'buttonsPart':
				hideMe = !this.showing.buttonsPart;
				context = {
					hideMe: hideMe,
				}
				break;
			case 'trackerList':
				hideMe = !this.showing.trackerList;
				await this.updateTrackerList();
				context = {
					trackerList: this.trackerList,
					hideMe: hideMe,
				}
				break;
			case 'modifyPart':
				this.#debugReport()
				console.log(this.checkedAwardedItem())
				console.log(this.checkedModified())
				hideMe = !this.showing.modifyPart;
				context = {
					hideMe: hideMe,
					awardedItem: this.checkedAwardedItem(),
					trackerListModified: this.checkedModified(),
				}
				console.log(context)
				break;
			case 'trackerDetails':
				this.#debugReport()
				console.log(this.checkedAwardedItem())
				console.log(this.checkedModified())
				hideMe = !this.showing.trackerDetails;
				context = {
					hideMe: hideMe,
					awardedItem: this.checkedAwardedItem(),
					trackerListModified: this.checkedModified(),
				}
				console.log(context)
				break;
		}
		return context;
	}
}

function showMagicItemTrackerApp() {
	let myNewApp = new MagicItemTrackerApp;
	myNewApp.render(true);
}


export  { magicItemTracker, MagicItemTrackerApp, showMagicItemTrackerApp }