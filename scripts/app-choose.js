console.log("[NYQUISTT HELPERS]: javascript loaded");

const nyquisttHelpersModPath = 'modules/nyquistt-helpers/';

Hooks.on("init", function() {
	game.nyquisttHelpers = nyquisttHelpers;
	console.log("[NYQUISTT HELPERS]: init step.");
});

Hooks.on("ready", function() {
  console.log("[NYQUISTT HELPERS]: ready phase");
});

async function showMagicItemTrackerApp() {
	let myNewApp = new MagicItemTrackerApp;
	await myNewApp.render(true);
}

async function showCharacterCreationApp(){
	let myNewApp = new characterCreationApp;
	await myNewApp.render(true);
}

// Similar syntax to importing, but note that
// this is object destructuring rather than an actual import
// senza questo comando dovresti fornire l'intero path per AppV2 e Hndlebars
const { ApplicationV2: nyqHelpersAppV2, HandlebarsApplicationMixin: nyqHelpersHandlebars } = foundry.applications.api

class MagicItemTrackerApp extends nyqHelpersHandlebars(nyqHelpersAppV2){
	static PARTS = {
		headerPart: { template: `${nyquisttHelpersModPath}templates/magic-items-tracker-top.hbs`},
		buttonsPart: { template: `${nyquisttHelpersModPath}templates/magic-items-tracker-buttons.hbs`},
		trackerList: { template: `${nyquisttHelpersModPath}templates/magic-items-tracker-list-trackers.hbs`},
		modifyPart: { template: `${nyquisttHelpersModPath}templates/magic-items-tracker-modify-tracker.hbs`},
		trackerDetails: { template: `${nyquisttHelpersModPath}templates/magic-items-tracker-details.hbs`},
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
	showing = {headerPart: true, buttonsPart: true, trackerList: true, modifyPart: false, trackerDetails: false}
	trackerList = [];
	async updateCheckedTracker(){
		let trackerFound = false;
		const trackerListComplete = await game.nyquisttHelpers.API.nyqTables.getItemTrackerActors();
		for(var i = 0; i < this.trackerList.length; i++){
			if(this.trackerList[i].modified){
				for(var j = 0; j < trackerListComplete.length; j++){
					if(trackerListComplete[j].id == this.trackerList[i].id){
						trackerFound = true;
						await trackerListComplete[j].setFlag('nyquistt-helpers',"awardedItem",this.trackerList[i].awardedItem);
						const updatingResult = await game.nyquisttHelpers.API.nyqTables.updateItemTrackerActor(trackerListComplete[j]);
						console.log("[updateCheckedTracker] updating result",updatingResult)
						this.trackerList[i].modified = false;
						break;
					}
				}
				break;
			}
		}
		if(!trackerFound) this.updateTrackerList();
	}
	updateCheckedAwardedItem(awardedItemTier,awardedItemType,direction){
		for(var i = 0; i < this.trackerList.length; i++){
			if(this.trackerList[i].checked){
				this.trackerList[i].modified = true;
				const myAdd = (direction == "increase") ? 1 : -1;
				if((awardedItemType === "minLevel")||(awardedItemType === "maxLevel"))
					this.trackerList[i].awardedItem[awardedItemTier][awardedItemType] += myAdd;
				else
					this.trackerList[i].awardedItem[awardedItemTier][awardedItemType].value += myAdd;
			}
		}
	}
	getCheckedModified(){
		const checkedTrackerList = this.trackerList.filter(
			(value, index, array) => {
				return value.checked;
			}
		)
		let currentModified = false;
		if(checkedTrackerList.length){
			currentModified = checkedTrackerList[0].modified;
		}
		return currentModified;
	}
	getCheckedAwardedItem(){
		const checkedTrackerList = this.trackerList.filter(
			(value, index, array) => {
				return value.checked;
			}
		)
		let currentAwardedItem = {}
		if(checkedTrackerList.length){
			currentAwardedItem = checkedTrackerList[0].awardedItem;
		}
		return currentAwardedItem;
	}
	async updateTrackerList(){
		//this.trackerListComplete = await game.nyquisttHelpers.API.nyqTables.getItemTrackerActors()
		const trackerListComplete = await game.nyquisttHelpers.API.nyqTables.getItemTrackerActors()
		let newTrackerList = [];
		for(var i = 0; i < trackerListComplete.length; i++){
			let myObj = {
				name: trackerListComplete[i].name,
				id: await trackerListComplete[i].id,
				awardedItem: game.nyquisttHelpers.API.nyqTables.createCopy(await trackerListComplete[i].getFlag('nyquistt-helpers',"awardedItem")),
			}
			const existentTracker = this.trackerList.filter(
				(value, index, array) => {
					return value.id == myObj.id;
				}
			)
			myObj.checked = existentTracker.length ? existentTracker[0].checked : false;
			myObj.modified = existentTracker.length ? existentTracker[0].modified : false;
			if(myObj.modified){	//keep the modified version
				newTrackerList.push(game.nyquisttHelpers.API.nyqTables.createCopy(existentTracker[0]))
			}
			else //update with the new value
				newTrackerList.push(myObj);
		}
		this.trackerList = newTrackerList;
		console.log("[updateTrackerList]")
		console.log(this.trackerList)
	}
	static async myAction(event, target){
		const clickedElement = target.getAttribute("Class");
		//console.log(clickedElement)
		//console.log(event)
		//console.log(target)
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
						await game.nyquisttHelpers.API.nyqTables.createMagicItemTrackerActor(trackerName);
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
				hideMe = !this.showing.modifyPart;
				context = {
					hideMe: hideMe,
					awardedItem: this.getCheckedAwardedItem(),
					trackerListModified: this.getCheckedModified(),
				}
				break;
			case 'trackerDetails':
				hideMe = !this.showing.trackerDetails;
				context = {
					hideMe: hideMe,
					awardedItem: this.getCheckedAwardedItem(),
					trackerListModified: this.getCheckedModified(),
				}
				break;
		}
		return context;
	}
}

class characterCreationApp extends nyqHelpersHandlebars(nyqHelpersAppV2){
	
	static PARTS = {
		header: { template: `${nyquisttHelpersModPath}templates/header.hbs`},
		classList: {template: `${nyquisttHelpersModPath}templates/class-list.hbs`},
		backgroundList: {template: `${nyquisttHelpersModPath}templates/background-list.hbs`},
		speciesList: {template: `${nyquisttHelpersModPath}templates/species-list.hbs`},
		charReview: {template: `${nyquisttHelpersModPath}templates/char-review.hbs`},
		footer: {template: `${nyquisttHelpersModPath}templates/footer.hbs`},
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
			myAction: characterCreationApp.myAction
		}
	}
	
	/**
	* @param {PointerEvent} event - The originating click event
	* @param {HTMLElement} target - the capturing HTML element which defined a [data-action]
	*/
	
	selectedClass = -1;
	selectedBG = -1;
	selectedSpecie = -1;
	selectedMode = -1; //0: class, 1: Background, 2: specie
	initialized = false;
	actorName = 'New Test Actor';
	
	skillList = [
			{name: 'Acrobatics', prof: false},
			{name: 'Animal Handling', prof: false},
			{name: 'Arcana', prof: false},
			{name: 'Athletics', prof: false},
			{name: 'Deception', prof: false},
			{name: 'History', prof: false},
			{name: 'Insight', prof: false},
			{name: 'Intimidation', prof: false},
			{name: 'Investigation', prof: false},
			{name: 'Medicine', prof: false},
			{name: 'Nature', prof: false},
			{name: 'Perception', prof: false},
			{name: 'Performance', prof: false},
			{name: 'Persuasion', prof: false},
			{name: 'Religion', prof: false},
			{name: 'Sleight of Hand', prof: false},
			{name: 'Stealth', prof: false},
			{name: 'Survival', prof: false},
	];

	nyqResetSkills(){
		for(var i = 0; i < this.skillList.length; i++){
			this.skillList[i].prof = false;
		}
	}

	nyqSkillProfs(){
		let result = [];
		for(var i = 0; i < this.skillList.length; i++){
			result.push(this.skillList[i].prof);
		}
		return result;
	}

	//<input type="checkbox" id="scales" name="scales" checked />
	nyqSkills2Checks(enabledList = new Array(this.skillList.length).fill(true)){
		let checkList = [];
		for(var i = 0; i < this.skillList.length; i ++){
			let newCheck = '<input type="checkbox" class="checkSkillList" data-action="myAction" id="chech_skill_' + i + '" data-id="' + i + '" name="check_' + this.skillList[i].name + '"';
			newCheck += (this.skillList[i].prof) ? ' checked' : '';
			newCheck += (enabledList[i]) ? '' : ' disabled';
			newCheck += ' />';
			checkList.push(newCheck);
		}
		return checkList;
	}

	statsList = [
		{name: 'STRENGTH', short: 'STR', value: 8},
		{name: 'DEXTERITY', short: 'DEX', value: 8},
		{name: 'CONSTITUTION', short: 'CON', value: 8},
		{name: 'INTELLIGENCE', short: 'INT', value: 8},
		{name: 'WISDOM', short: 'WIS', value: 8},
		{name: 'CHARISMA', short: 'CHA', value: 8},
	]

	pointBuyMax = 27;
	pointBuyRemaining = 27;

	possibleStatScore = [
		{"score":0,"bonus":-5,"cost":null},
		{"score":1,"bonus":-5,"cost":null},
		{"score":2,"bonus":-4,"cost":null},
		{"score":3,"bonus":-4,"cost":-9},
		{"score":4,"bonus":-3,"cost":-6},
		{"score":5,"bonus":-3,"cost":-4},
		{"score":6,"bonus":-2,"cost":-2},
		{"score":7,"bonus":-2,"cost":-1},
		{"score":8,"bonus":-1,"cost":0},
		{"score":9,"bonus":-1,"cost":1},
		{"score":10,"bonus":0,"cost":2},
		{"score":11,"bonus":0,"cost":3},
		{"score":12,"bonus":1,"cost":4},
		{"score":13,"bonus":1,"cost":5},
		{"score":14,"bonus":2,"cost":7},
		{"score":15,"bonus":2,"cost":9},
		{"score":16,"bonus":3,"cost":12},
		{"score":17,"bonus":3,"cost":15},
		{"score":18,"bonus":4,"cost":19},
		{"score":19,"bonus":4,"cost":null},
		{"score":20,"bonus":5,"cost":null}
	];

	nyqResetStats(){
		for(var i = 0; i < this.statsList.length; i++){
			this.statsList[i].value = 8;
		}
	}

	nyqComputeStatPoints(statsArray){
		/*
		let canc=[];//undefined
		canc.length=21;
		let canc2 = canc.keys();//iterator
		console.log(canc2);
		let canc3=[];//filled with indexes of canc - 10
		for (const key of canc2){
			let myVal = {score: key, bonus: Math.floor((key-10)/2),};
			if(key == 8) myVal.cost = 0;
			else if((key > 8) &&(key < 14)) myVal.cost = key-8;
			else if ((key > 13)&&(key < 16)) myVal.cost = (key-13)*2+5;
			else if((key > 15)&&(key < 18)) myVal.cost = (key-15)*3+9;
			else if(key == 18) myVal.cost = 19;
			else if(key > 18) myVal.cost = null;
			else if((key < 8)&&(key > 5)) myVal.cost = key-8;
			else if((key < 6)&&(key > 3)) myVal.cost = (key-6)*2-2;
			else if((key < 4)&&(key > 2)) myVal.cost = (key-4)*3-6;
			else if(key < 3) myVal.cost = null;
			canc3.push(myVal);
		}
		console.log(JSON.stringify(canc3))
		*/
		let result = {possible: false, remainingPoints: this.pointBuyMax};
		let impossible = false;
		let totalPoint = 0;
		for(var i = 0; i < statsArray.length; i++){
			if(this.possibleStatScore[statsArray[i]].cost === null){
				impossible = true;
				break;
			}
			totalPoint += this.possibleStatScore[statsArray[i]].cost;
		}
		if((!impossible) && (totalPoint <= this.pointBuyMax)){
			result.possible = true;
			result.remainingPoints = this.pointBuyMax-totalPoint;
		}
		console.log(result)
		return result;
	}

	armorsWeaponsProfs = [
		{name: 'Simple Weapons'},
		{name: 'Martial Weapons'},
		{name: 'Light Armor'},
		{name: 'Medium Armor'},
		{name: 'Heavy Armor'},
		{name: 'Shields'},
		{name: 'Weapon Mastery'},
	];

	defaultArmorsWeaponsProfs= [0,0,0,0,0,0,0];
	defaultSkillSelectable = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,];
	defaultStatsRecommended = [8,8,8,8,8,8,]

	dnd24Classes = [
						{
							name: 'Barbarian',
							selected: 'false',
							classID: 0,
							statPrincipale: 'Strength',
							nSkillChoices: 2,
							motto: 'Mi piace il furore della battaglia.',
							skillSelectable: [0,1,0,1,0,0,0,1,0,0,1,1,0,0,0,0,0,1,],
							statsRecommended: [15, 13, 14, 10, 12, 8],
							armorsWeaponsProfs: [1,1,1,1,0,1,2],
						},
						{
							name: 'Bard', 
							selected: 'false',
							classID: 1,
							statPrincipale: 'Charisma',
							nSkillChoices: 3,
							motto: 'Mi piace guardare un pubblico rapito.',
							skillSelectable: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,],
							statsRecommended: [8, 14, 12, 13, 10, 15],
							armorsWeaponsProfs: [1,0,1,0,0,0,0],
						},
						{
							name: 'Cleric', 
							selected: 'false',
							classID: 2,
							statPrincipale: 'Wisdom',
							nSkillChoices: 2,
							motto: 'Mi piace perdermi nella benedizione divina.',
							skillSelectable: [0,0,0,0,0,1,1,0,0,1,0,0,0,1,1,0,0,0,],
							statsRecommended: [14, 8, 13, 10, 15, 12],
							armorsWeaponsProfs: [1,0,1,1,0,1,0],
						},
						{
							name: 'Druid', 
							selected: 'false',
							classID: 3,
							statPrincipale: 'Wisdom',
							nSkillChoices: 2,
							motto: 'Mi piace essere circondato dalla natura.',
							skillSelectable: [0,1,1,0,0,0,1,0,0,1,1,1,0,0,1,0,0,1,],
							statsRecommended: [8, 12, 14, 13, 15, 10],
							armorsWeaponsProfs: [1,0,1,0,0,1,0],
						},
						{
							name: 'Fighter', 
							selected: 'false',
							classID: 4,
							statPrincipale: 'Strength or Dexterity',
							nSkillChoices: 2,
							motto:'Mi piace confondere i nemici con la precisione della mia tecnica.',
							skillSelectable: [1,1,0,1,0,1,1,1,0,0,0,1,0,1,0,0,0,1,],
							statsRecommended: [15, 14, 13, 8, 10, 12],
							armorsWeaponsProfs: [1,1,1,1,1,1,3],
						},
						{
							name: 'Monk', 
							selected: 'false',
							classID: 5,
							statPrincipale: 'Dexterity and Wisdom',
							nSkillChoices: 2,
							motto:'Ho il controllo assoluto del mio corpo.',
							skillSelectable: [1,0,0,1,0,1,1,0,0,0,0,0,0,0,1,0,1,0,],
							statsRecommended: [12, 15, 13, 10, 14, 8],
							armorsWeaponsProfs: [1,0.5,0,0,0,0,2],
						},
						{
							name: 'Paladin', 
							selected: 'false',
							classID: 6,
							statPrincipale: 'Strength and Charisma',
							nSkillChoices: 2,
							motto:'Vivo per realizzare le mie promesse.',
							skillSelectable: [0,0,0,1,0,0,1,1,0,1,0,0,0,1,1,0,0,0,],
							statsRecommended: [15, 10, 13, 8, 12, 14],
							armorsWeaponsProfs: [1,1,1,1,1,1,2],
						},
						{
							name: 'Ranger', 
							selected: 'false',
							classID: 7,
							statPrincipale: 'Dexterity and Wisdom',
							nSkillChoices: 3,
							motto:'Mi piace addentrarmi nei luoghi incontaminati e selvaggi.',
							skillSelectable: [0,1,0,1,0,0,1,0,1,0,1,1,0,0,0,0,1,1,],
							statsRecommended: [12, 15, 13, 8, 14, 10],
							armorsWeaponsProfs: [1,1,1,1,0,1,2],
						},
						{
							name: 'Rogue', 
							selected: 'false',
							classID: 8,
							statPrincipale: 'Dexterity',
							nSkillChoices: 4,
							motto:'Adoro nascondermi e attaccare di soppiatto.',
							skillSelectable: [1,0,0,1,1,0,1,1,1,0,0,1,0,1,0,1,1,0,],
							statsRecommended: [12, 15, 13, 14, 10, 8],
							armorsWeaponsProfs: [1,0.5,1,0,0,0,2],
						},
						{
							name: 'Sorcerer', 
							selected: 'false',
							classID: 9,
							statPrincipale: 'Charisma',
							nSkillChoices: 2,
							motto:'Bramo il potere e anelo il controllo.',
							skillSelectable: [0,0,1,0,1,0,1,1,0,0,0,0,0,1,1,0,0,0,],
							statsRecommended: [10, 13, 14, 8, 12, 15],
							armorsWeaponsProfs: [1,0,0,0,0,0,0],
						},
						{
							name: 'Warlock', 
							selected: 'false',
							classID: 10,
							statPrincipale: 'Charisma',
							nSkillChoices: 2,
							motto:"Sono intrigato da tutto cio' che e' occulto",
							skillSelectable: [0,0,1,0,1,1,0,1,1,0,1,0,0,0,1,0,0,0,],
							statsRecommended: [8, 14, 13, 12, 10, 15],
							armorsWeaponsProfs: [1,0,1,0,0,0,0],
						},
						{
							name: 'Wizard', 
							selected: 'false',
							classID: 11,
							statPrincipale: 'Intelligence',
							nSkillChoices: 2,
							motto:'Adoro i libri. E le biblioteche. E i manuali.',
							skillSelectable: [0,0,1,0,0,1,1,0,1,1,0,0,0,0,1,0,0,0,],
							statsRecommended: [8, 12, 13, 15, 14, 10],
							armorsWeaponsProfs: [1,0,0,0,0,0,0],
						},
					];

	defaultBGskills = ['x','x','x','x','x','x','x','x','x','x','x','x','x','x','x','x','x','x',];
	defaultStatsPoints = [' ', ' ', ' ', ' ', ' ', ' '];

	dnd24Backgrounds = [
		{
			name: 'Acolyte',
			selected: 'false',
			ID: 0,
			tool: "Calligrapher's Supplies",
			skills: '',
			stats: '',
			feat: 'Magic Initiate (Cleric)',
			skillSelection: [0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,],
			statsSelection: [0,0,0,1,1,1],
		},
		{
			name: 'Artisan',
			selected: 'false',
			ID: 1,
			tool: 'Choose one',
			skills: '',
			stats: '',
			feat: 'Crafter',
			skillSelection: [0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,],
			statsSelection: [1,1,0,1,0,0],
		},
		{
			name: 'Charlatan',
			selected: 'false',
			ID: 2,
			tool: 'Forgery Kit',
			skills: '',
			stats: '',
			feat: 'Skilled',
			skillSelection: [0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,],
			statsSelection: [0,1,1,0,0,1],
		},
		{
			name: 'Criminal',
			selected: 'false',
			ID: 3,
			tool: "Thieves' Tools",
			skills: '',
			stats: '',
			feat: 'Alert',
			skillSelection: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,],
			statsSelection: [0,1,1,1,0,0],
		},
		{
			name: 'Entertainer',
			selected: 'false',
			ID: 4,
			tool: 'Choose one instrument',
			skills: '',
			stats: '',
			feat: 'Musician',
			skillSelection: [1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,],
			statsSelection: [1,1,0,0,0,1],
		},
		{
			name: 'Farmer',
			selected: 'false',
			ID: 5,
			tool: "Carpenter's Tools",
			skills: '',
			stats: '',
			feat: 'Tough',
			skillSelection: [0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,],
			statsSelection: [1,0,1,0,1,0],
		},
		{
			name: 'Guard',
			selected: 'false',
			ID: 6,
			tool: 'Choose one gaming set',
			skills: '',
			stats: '',
			feat: 'Alert',
			skillSelection: [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,],
			statsSelection: [1,0,0,1,1,0],
		},
		{
			name: 'Guide',
			selected: 'false',
			ID: 7,
			tool: "Cartographer's Tools",
			skills: '',
			stats: '',
			feat: 'Magic Initiate (Druid)',
			skillSelection: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,],
			statsSelection: [0,1,1,0,1,0],
		},
		{
			name: 'Hermit',
			selected: 'false',
			ID: 8,
			tool: 'Herbalism Kit',
			skills: '',
			stats: '',
			feat: 'Healer',
			skillSelection: [0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,],
			statsSelection: [0,0,1,0,1,1],
		},
		{
			name: 'Merchant',
			selected: 'false',
			ID: 9,
			tool: "Navigator's Tools",
			skills: '',
			stats: '',
			feat: 'Lucky',
			skillSelection: [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,],
			statsSelection: [0,0,1,1,0,1],
		},
		{
			name: 'Noble',
			selected: 'false',
			ID: 10,
			tool: 'Choose one gaming set',
			skills: '',
			stats: '',
			feat: 'Skilled',
			skillSelection: [0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,],
			statsSelection: [1,0,0,1,0,1],
		},
		{
			name: 'Sage',
			selected: 'false',
			ID: 11,
			tool: "Calligrapher's Supplies",
			skills: '',
			stats: '',
			feat: 'Magic Initiate (Wizard)',
			skillSelection: [0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,],
			statsSelection: [0,0,1,1,1,0],
		},
		{
			name: 'Sailor',
			selected: 'false',
			ID: 12,
			tool: "Navigator's Tools",
			skills: '',
			stats: '',
			feat: 'Tavern Brawler',
			skillSelection: [1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,],
			statsSelection: [1,1,0,0,1,0],
		},
		{
			name: 'Scribe',
			selected: 'false',
			ID: 13,
			tool: "Calligrapher's Supplies",
			skills: '',
			stats: '',
			feat: 'Skilled',
			skillSelection: [0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,],
			statsSelection: [0,1,0,1,1,0],
		},
		{
			name: 'Soldier',
			selected: 'false',
			ID: 14,
			tool: 'Choose one gaming set',
			skills: '',
			stats: '',
			feat: 'Savage Attacker',
			skillSelection: [0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,],
			statsSelection: [1,1,1,0,0,0],
		},
		{
			name: 'Wayfarer',
			selected: 'false',
			ID: 15,
			tool: "Thieves' Tools",
			skills: '',
			stats: '',
			feat: 'Lucky',
			skillSelection: [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,],
			statsSelection: [0,1,0,0,1,1],
		},
	];

	dnd24Species = [
		{
			name: 'Aasimar',
			selected: 'false',
			ID: 0,
			size: 'Medium or Small',
			speed: 30,
			traits: 'Celestial Resistance, Darkvision, Healing Hands, Light Bearer, Celestial Revelation,',
		},
		{
			name: 'Dragonborn',
			selected: 'false',
			ID: 1,
			size: 'Medium',
			speed: 30,
			traits: 'Draconic Ancestry, Breath Weapon, Damage Resistance, Darkvision, Draconic Flight',
		},
		{
			name: 'Dwarf',
			selected: 'false',
			ID: 2,
			size: 'Medium',
			speed: 30,
			traits: 'Darkvision, Dwarver Resilience, Dwarven Toughness, Stonecunning',
		},
		{
			name: 'Elf',
			selected: 'false',
			ID: 3,
			size: 'Medium',
			speed: 30,
			traits: 'Darkvision, Elven Lineage, Fey Ancestry, Keen Senses, Trance',
		},
		{
			name: 'Gnome',
			selected: 'false',
			ID: 4,
			size: 'Small',
			speed: 30,
			traits: 'Darkvision, Gnomish Cunning, Gnomish Lineage',
		},
		{
			name: 'Goliath',
			selected: 'false',
			ID: 5,
			size: 'Medium',
			speed: 35,
			traits: 'Giant Ancestry, Large Form, Powerful Build',
		},
		{
			name: 'Halfling',
			selected: 'false',
			ID: 6,
			size: 'Small',
			speed: 30,
			traits: 'Brave, Halfling Nimbelness, Luck, Naturally Stealthy',
		},
		{
			name: 'Human',
			selected: 'false',
			ID: 7,
			size: 'Medium or Small',
			speed: 30,
			traits: 'Resourceful, Skillful, Versatile',
		},
		{
			name: 'Orc',
			selected: 'false',
			ID: 8,
			size: 'Medium',
			speed: 30,
			traits: 'Adrenaline Rush, Darkvision, Relentless Endurance',
		},
		{
			name: 'Tiefling',
			selected: 'false',
			ID: 9,
			size: 'Medium or Small',
			speed: 30,
			traits: 'Darkvision, Fiendish Legacy, Otherworldly Presence',
		},
	];

	nyqInitialize(){
		if (this.initialized) return;
		for(var i = 0; i < this.dnd24Backgrounds.length; i++){
			let stringSkills = '';
			let stringStats = '';
			for(var j = 0; j < this.skillList.length; j++){
				if(this.dnd24Backgrounds[i].skillSelection[j]){
					stringSkills += (stringSkills.length) ? (', ') : '';
					stringSkills += this.skillList[j].name;
				}
			}
			this.dnd24Backgrounds[i].skills = stringSkills;
			for(var j = 0; j < this.statsList.length; j++){
				if(this.dnd24Backgrounds[i].statsSelection[j]){
					stringStats += (stringStats.length) ? ', ' : '';
					stringStats += this.statsList[j].short;
				}
			}
			this.dnd24Backgrounds[i].stats = stringStats;
			//console.log("stringSkills: " + stringSkills);
			//console.log("stringStats: " + stringStats);
		}
		this.initialized = true;
	}

	nyqStringify(myArray){
		let newArray = [];
		for(var i = 0; i < myArray.length; i++){
			if(myArray[i]) newArray.push('x');
			else newArray.push(' ');
		}
		return newArray;
	}

	nyqStringifyProficiencies(myArray){
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

	async nyqCreateActor(){
		//create an actor
		let myActor = await Actor.implementation.create({
			name: this.actorName,
			type: "character",
		});
		let myID = myActor.id;
		//update stats
		let myUpdates = [];
		if(this.selectedClass > -1){
			let myStats = this.dnd24Classes[this.selectedClass].statsRecommended;
			let mySystem = {
				abilities: {
					str: {value: this.statsList[0].value},
					dex: {value: this.statsList[1].value},
					con: {value: this.statsList[2].value},
					int: {value: this.statsList[3].value},
					wis: {value: this.statsList[4].value},
					cha: {value: this.statsList[5].value},
				}
			}
			myUpdates.push({_id: myID, system: mySystem});
		}
		const updated = await Actor.implementation.updateDocuments(myUpdates);
		//create an item, type feat
		const data = [{name: "Initial Character Setup", type: "feat"}];
		let createdItem = await Item.create(data, {parent: myActor});
		let myItemID = createdItem[0]._id;
		//fetch the template for the item description
		const response = await fetch(`${nyquisttHelpersModPath}templates/char-review-small.hbs`);
		if (!response.ok) return;
		const templateText = await response.text();
		//compile the tamplate
		var myDescription = Handlebars.compile(templateText);
		//create the data for the template
		let chosenClass = 'null';
		let chosenBG = 'null';
		let chosenSpecie = 'null';
		if(this.selectedClass > -1)
			chosenClass = this.dnd24Classes[this.selectedClass].name;
		if(this.selectedBG > -1)
			chosenBG = this.dnd24Backgrounds[this.selectedBG].name;
		if(this.selectedSpecie > -1)
			chosenSpecie = this.dnd24Species[this.selectedSpecie].name;

		//let classesSkillSelectable = this.defaultSkillSelectable;
		let classChoices = 0;
		if(this.selectedClass > -1){
			//classesSkillSelectable = this.nyqStringify(this.dnd24Classes[this.selectedClass].skillSelectable);
			classChoices = this.dnd24Classes[this.selectedClass].nSkillChoices;
		}

		let BGskills = this.defaultBGskills;
		if(this.selectedBG > -1){
			BGskills = this.nyqStringify(this.dnd24Backgrounds[this.selectedBG].skillSelection);
		}
		let statsRecommended = this.defaultStatsRecommended;
		if(this.selectedClass > -1){
			statsRecommended = this.dnd24Classes[this.selectedClass].statsRecommended;
		}
		let statsPoints = this.defaultStatsPoints;
		if(this.selectedBG > -1){
			statsPoints = this.nyqStringify(this.dnd24Backgrounds[this.selectedBG].statsSelection);
		}
		let armorsWeaponsProfsClass = this.defaultArmorsWeaponsProfs;
		if(this.selectedClass > -1)
			armorsWeaponsProfsClass = this.nyqStringifyProficiencies(this.dnd24Classes[this.selectedClass].armorsWeaponsProfs);
		//re-organize tables
		let tableStatsHeader = ['Stat','Value','Points','Recommended'];
		let tableStats = [];
		for(var i = 0; i < this.statsList.length; i++){
			tableStats.push(
				{
					stat: this.statsList[i].name,
					value: this.statsList[i].value,
					recommended: statsRecommended[i],
					points: statsPoints[i],
				}
			);
		}
		let tableSkillsHeader = ['Skill', 'from Class','from BG'];
		let tableSkills = [];
		for(var i = 0; i < this.skillList.length; i++){
			tableSkills.push(
				{
					skill: this.skillList[i].name,
					class: this.skillList[i].prof ? 'x' : ' ',
					bg: BGskills[i],
				}
			);
		}
		//console.log(tableSkillsHeader)
		//console.log(tableSkills)
		let tableProfHeader = ['Proficiency','Obtained'];
		let tableProf = [];
		for(var i = 0; i < this.armorsWeaponsProfs.length; i++){
			tableProf.push(
				{
					proficiency: this.armorsWeaponsProfs[i].name,
					obtained: armorsWeaponsProfsClass[i],
				}
			);
		}


		const context = {
			tableStatsHeader: tableStatsHeader,
			tableStats: tableStats,
			tableSkillsHeader: tableSkillsHeader,
			tableSkills: tableSkills,
			tableProfHeader: tableProfHeader,
			tableProf: tableProf,
			chosenClass: chosenClass,
			chosenBG: chosenBG,
			chosenSpecie: chosenSpecie,
			skillList: this.skillList,
			statList: this.statsList,
			armorsWeaponsProfs: this.armorsWeaponsProfs,
			classChoices: classChoices,
			BGskills: BGskills,
			statsRecommended: statsRecommended,
			statsPoints: statsPoints,
			armorsWeaponsProfsClass: armorsWeaponsProfsClass,
			actorName: this.actorName,
		}

  		// execute the compiled template and print the output to the console
  		//console.log(myDescription(context));
		//apply the description to the item.
		let myItemSystem = {
			description: {
				value: myDescription(context),
				chat: myDescription(context),
			}
		};
		myUpdates = [
			{_id: myItemID, system: myItemSystem},
		];
		const updatedItem = await Item.implementation.updateDocuments(myUpdates, {parent: myActor});
		//const updatedItem = await createdItem[0].implementation.updateDocuments(myUpdates);
	}
	
	static myAction(event, target) {
	
		const clickedElement = target.getAttribute("Class");
		//console.log(clickedElement)
		//console.log(event)
		//console.log(target)
		switch(clickedElement){
			case 'singleClassName':
				let selectedClass = parseInt(target.getAttribute('data-classID'));
				if(this.selectedClass == selectedClass)
					this.selectedClass = -1;
				else
					this.selectedClass = selectedClass;
				for (var i = 0; i < this.dnd24Classes.length; i++) { 
					if(i == this.selectedClass)
						this.dnd24Classes[i].selected = 'true';
					else
						this.dnd24Classes[i].selected = 'false';
				}
				this.nyqResetSkills();
				//this.render({parts: ['classList', 'charReview']});
				this.render(true);
				break;
			case 'singleBGname':
				let selectedBG = parseInt(target.getAttribute('data-ID'));
				if(this.selectedBG == selectedBG)
					this.selectedBG = -1;
				else
					this.selectedBG = selectedBG;
				for (var i = 0; i < this.dnd24Backgrounds.length; i++) { 
					if(i == this.selectedBG)
						this.dnd24Backgrounds[i].selected = 'true';
					else
						this.dnd24Backgrounds[i].selected = 'false';
				}
				this.render(true);
				break;
			case 'singleSpecieName':
				let selectedSpecie = parseInt(target.getAttribute('data-ID'));
				if(this.selectedSpecie == selectedSpecie)
					this.selectedSpecie = -1;
				else
					this.selectedSpecie = selectedSpecie;
				for (var i = 0; i < this.dnd24Species.length; i++) { 
					if(i == this.selectedSpecie)
						this.dnd24Species[i].selected = 'true';
					else
						this.dnd24Species[i].selected = 'false';
				}
				this.render(true);
				break;
			case 'nyqButton':
				let selectedMode = target.getAttribute('id');
				switch(selectedMode){
					case 'btnClasses':
						if(this.selectedMode == 0)
							this.selectedMode = -1;
						else
							this.selectedMode = 0;
						break;
					case 'btnBG':
						if(this.selectedMode == 1)
							this.selectedMode = -1;
						else
							this.selectedMode = 1;
						break;
					case 'btnSpecies':
						if(this.selectedMode == 2)
							this.selectedMode = -1;
						else
							this.selectedMode = 2;
						break;
				}
				this.render(true);
				break;
			case 'nyqStoreResult':
				this.nyqCreateActor();
				break;
			case 'nyqStoreName':
				let mySelector = this.element.querySelectorAll('.aName');
				//console.log(mySelector)
				this.actorName = mySelector[0].value;
				break;
			case 'checkSkillList':
				let selectedSkill = parseInt(target.getAttribute('data-ID'));
				this.skillList[selectedSkill].prof = !this.skillList[selectedSkill].prof;
				break;
			case 'stat-value-button':
				let newStatList = [];
				for(var i = 0; i < this.statsList.length; i++){
					newStatList.push(this.statsList[i].value);
				}
				let selectedStat = parseInt(target.getAttribute('data-id'));
				let selectedDirection = target.getAttribute('data-type');
				if(selectedDirection=='increase')
					newStatList[selectedStat] += 1;
				else
					newStatList[selectedStat] -= 1;
				const statsCheckResult = this.nyqComputeStatPoints(newStatList);
				console.log(statsCheckResult)
				if(statsCheckResult.possible){
					if(selectedDirection=='increase')
						this.statsList[selectedStat].value++;
					else
						this.statsList[selectedStat].value--;
					this.pointBuyRemaining = statsCheckResult.remainingPoints;
				}
				this.render(true);
				break;
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

	async _preparePartContext(partId, context) {

		if(!this.initialized) this.nyqInitialize();

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
				//if(this.selectedClass > -1)
				//	this.dnd24Classes[this.selectedClass].selected='true';
				if(this.selectedMode==0) 
					hideMe = false;
				context = {
					classes: this.dnd24Classes,
					hideMe: hideMe,
				}
				break;
			case 'backgroundList':
				if(this.selectedMode==1) 
					hideMe = false;
				context = {
					backgrounds: this.dnd24Backgrounds,
					hideMe: hideMe,
				}
				break;
			case 'speciesList':
				if(this.selectedMode==2) 
					hideMe = false;
				context = {
					species: this.dnd24Species,
					hideMe: hideMe,
				}
				break;
			case 'charReview':
				let chosenClass = 'null';
				let chosenBG = 'null';
				let chosenSpecie = 'null';
				if(this.selectedClass > -1)
					chosenClass = this.dnd24Classes[this.selectedClass].name;
				if(this.selectedBG > -1)
					chosenBG = this.dnd24Backgrounds[this.selectedBG].name;
				if(this.selectedSpecie > -1)
					chosenSpecie = this.dnd24Species[this.selectedSpecie].name;
				let classChoices = 0;
				if(this.selectedClass > -1){
					classChoices = this.dnd24Classes[this.selectedClass].nSkillChoices;
				}
				let BGskills = this.defaultBGskills;
				if(this.selectedBG > -1){
					BGskills = this.nyqStringify(this.dnd24Backgrounds[this.selectedBG].skillSelection);
				}
				let statsRecommended = this.defaultStatsRecommended;
				if(this.selectedClass > -1){
					statsRecommended = this.dnd24Classes[this.selectedClass].statsRecommended;
				}
				let statsPoints = this.defaultStatsPoints;
				if(this.selectedBG > -1){
					statsPoints = this.nyqStringify(this.dnd24Backgrounds[this.selectedBG].statsSelection);
				}

				let armorsWeaponsProfsClass = this.defaultArmorsWeaponsProfs;
				if(this.selectedClass > -1)
					armorsWeaponsProfsClass = this.nyqStringifyProficiencies(this.dnd24Classes[this.selectedClass].armorsWeaponsProfs);

				let skillChecks=[];
				if(this.selectedClass == -1)
					skillChecks = this.nyqSkills2Checks(new Array(this.skillList.length).fill(false));
				else
					skillChecks = this.nyqSkills2Checks(this.dnd24Classes[this.selectedClass].skillSelectable);
				//console.log(skillChecks);

				context = {
					skillChecks: skillChecks,
					chosenClass: chosenClass,
					chosenBG: chosenBG,
					chosenSpecie: chosenSpecie,
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
		return context;
	}
	
}

class nyqTables{
	//tables
	static encounterXpBudgetByLevel = [
		{lvl: 1, low: 50, moderate: 75, high: 100},
		{lvl: 2, low: 100, moderate: 150, high: 200},
		{lvl: 3, low: 150, moderate: 225, high: 400},
		{lvl: 4, low: 250, moderate: 375, high: 500},
		{lvl: 5, low: 500, moderate: 750, high: 1100},
		{lvl: 6, low: 600, moderate: 1000, high: 1400},
		{lvl: 7, low: 750, moderate: 1300, high: 1700},
		{lvl: 8, low: 1000, moderate: 1700, high: 2100},
		{lvl: 9, low: 1300, moderate: 2000, high: 2600},
		{lvl: 10, low: 1600, moderate: 2300, high: 3100},
		{lvl: 11, low: 1900, moderate: 2900, high: 4100},
		{lvl: 12, low: 2200, moderate: 3700, high: 4700},
		{lvl: 13, low: 2600, moderate: 4200, high: 5400},
		{lvl: 14, low: 2900, moderate: 4900, high: 6200},
		{lvl: 15, low: 3300, moderate: 5400, high: 7800},
		{lvl: 16, low: 3800, moderate: 6100, high: 9800},
		{lvl: 17, low: 4500, moderate: 7200, high: 11700},
		{lvl: 18, low: 5000, moderate: 8700, high: 14200},
		{lvl: 19, low: 5500, moderate: 10700, high: 17200},
		{lvl: 20, low: 6400, moderate: 13200, high: 22000},
	];
	static encounterXpByCR = [
		{cr: '0', xp:10},
		{cr: '1/8', xp:25},
		{cr: '1/4', xp:50},
		{cr: '1/2', xp:100},
		{cr: '1', xp:200},
		{cr: '2', xp:450},
		{cr: '3', xp:700},
		{cr: '4', xp:1100},
		{cr: '5', xp:1800},
		{cr: '6', xp:2300},
		{cr: '7', xp:2900},
		{cr: '8', xp:3900},
		{cr: '9', xp:5000},
		{cr: '10', xp:5900},
		{cr: '11', xp:7200},
		{cr: '12', xp:8400},
		{cr: '13', xp:10000},
		{cr: '14', xp:11500},
		{cr: '15', xp:13000},
		{cr: '16', xp:15000},
		{cr: '17', xp:18000},
		{cr: '18', xp:20000},
		{cr: '19', xp:22000},
		{cr: '20', xp:25000},
		{cr: '21', xp:33000},
		{cr: '22', xp:41000},
		{cr: '23', xp:50000},
		{cr: '24', xp:62000},
		{cr: '25', xp:75000},
		{cr: '26', xp:90000},
		{cr: '27', xp:105000},
		{cr: '28', xp:120000},
		{cr: '29', xp:135000},
		{cr: '30', xp:155000},
	];
	static xpVsLevel = [
		{lvl: 1, xp: 0},
		{lvl: 2, xp: 300},
		{lvl: 3, xp: 900},
		{lvl: 4, xp: 2700},
		{lvl: 5, xp: 6500},
		{lvl: 6, xp: 14000},
		{lvl: 7, xp: 23000},
		{lvl: 8, xp: 34000},
		{lvl: 9, xp: 48000},
		{lvl: 10, xp: 64000},
		{lvl: 11, xp: 85000},
		{lvl: 12, xp: 100000},
		{lvl: 13, xp: 120000},
		{lvl: 14, xp: 140000},
		{lvl: 15, xp: 165000},
		{lvl: 16, xp: 195000},
		{lvl: 17, xp: 225000},
		{lvl: 18, xp: 265000},
		{lvl: 19, xp: 305000},
		{lvl: 20, xp: 355000},
	];
	static magicItemsAmountByLevel = [];
	static treasureIndividualByCR = [
		{minCR: 0, plat: '0', gold: '3d6', silver: '0', copper: '0'},
		{minCR: 5, plat: '0', gold: '(2d8)*10', silver: '0', copper: '0'},
		{minCR: 11, plat: '(2d10)*10', gold: '0', silver: '0', copper: '0'},
		{minCR: 17, plat: '(2d8)*100', gold: '0', silver: '0', copper: '0'},
	];
	static trasureHoardByCR = [
		{minCR: 0, plat: '0', gold: '(2d4)*100', silver: '0', copper: '0', magicItem: '1d4-1',},
		{minCR: 5, plat: '0', gold: '(8d10)*100', silver: '0', copper: '0', magicItem: '1d3',},
		{minCR: 11, plat: '', gold: '(8d8)*1000', silver: '0', copper: '0', magicItem: '1d4',},
		{minCR: 17, plat: '', gold: '(6d10)*10000', silver: '0', copper: '0', magicItem: '1d6',},
	];
	static monsterList;
	static rollTablesFiles = [
		'arcana-common.json',
		'arcana-uncommon.json',
		'arcana-rare.json',
		'arcana-very-rare.json',
		'arcana-legendary.json',
		'armaments-common.json',
		'armaments-uncommon.json',
		'armaments-rare.json',
		'armaments-very-rare.json',
		'armaments-legendary.json',
		'Implements-common.json',
		'Implements-uncommon.json',
		'Implements-rare.json',
		'Implements-very-rare.json',
		'Implements-legendary.json',
		'relics-common.json',
		'relics-uncommon.json',
		'relics-rare.json',
		'relics-very-rare.json',
		'relics-legendary.json',
	];
	static rollTables;
	static awardMagicItem = [
		{
			minLevel: 1, maxLevel: 4,
			common: 6, uncommon: 4,
			rare: 1, veryRare: 0,
			legendary: 0,
			artifact: Infinity,
		},
		{
			minLevel: 5, maxLevel: 10,
			common: 10, uncommon: 17,
			rare: 6, veryRare: 1,
			legendary: 0,
			artifact: Infinity,
		},
		{
			minLevel: 11, maxLevel: 16,
			common: 3, uncommon: 7,
			rare: 11, veryRare: 7,
			legendary: 2,
			artifact: Infinity,
		},
		{
			minLevel: 17, maxLevel: Infinity,
			common: 0, uncommon: 0,
			rare: 5, veryRare: 11,
			legendary: 9,
			artifact: Infinity,
		},
	];

	static {
		console.log("nyqTables static initialization:")
		this.monsterList = this.csv2array("2024Bestiary_mod.csv",'<->');
		this.rollTables = this.readListOfJsonFiles(this.rollTablesFiles);
	}

	static nyqListifyObject(inputObject, orderBy="", orderDirection = "ascending"){
		let outputList = []
		for (const [key, value] of Object.entries(inputObject)){
			outputList.push(value);
		}
		if(orderBy !== ""){
			outputList.sort(
				(a,b) => {
					if(orderDirection === "ascending")
						return a[orderBy] - b[orderBy]; //ascending
					else
						return b[orderBy] - a[orderBy]; //descending
				}
			)
		}
		return outputList;
	}

	static nyqTranslationAwardedItem(awardedItem){
		const awardedItemList = this.nyqListifyObject(awardedItem,"minLevel","ascending") //now i have an array
		let tableLines = [];
		const tierKeys = Object.keys(awardedItemList[0]);
		for(var i = 0; i < tierKeys.length; i++){  //need to translate the table: the keys of each awardedItemList[i] are the first colun values of the final table
			let newLine = [];
			newLine.push(tierKeys[i]);
			for(var j = 0; j < awardedItemList.length; j++){ //the number of columns is the number of rows of awardedItemList
				if((tierKeys[i] === "minLevel") || (tierKeys[i] === "maxLevel"))
					newLine.push(awardedItemList[j][tierKeys[i]] !== null ? awardedItemList[j][tierKeys[i]] : "??");
				else{
					let newString = (awardedItemList[j][tierKeys[i]].value !== null) ? awardedItemList[j][tierKeys[i]].value : "??"
					newString += "/";
					newString += (awardedItemList[j][tierKeys[i]].max !== null) ? awardedItemList[j][tierKeys[i]].max : "??";
					newLine.push(newString);
				}
			}
			tableLines.push(newLine);
		}
		return tableLines;
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

	static async getTrackerActorItemHTML(awardedItem={}){
		console.log("[getTrackerActorItemHTML] received awardedItem")
		console.log(awardedItem)
		let tierList = [];
		for(var i = 0; i < Object.keys(awardedItem).length; i++){
			tierList.push("Tier " + (i+1));
		}
		const tableLines = this.nyqTranslationAwardedItem(awardedItem);
		const context = {
			tierList: tierList,
			tableLines: tableLines,
		}
		console.log("[getTrackerActorItemHTML] HTML context")
		console.log(context);
		const response = await fetch(`${nyquisttHelpersModPath}templates/tracker-actor-item-description.hbs`);
		if (!response.ok) return 'empty';
		//extract text
		const templateText = await response.text();
		//compile the tamplate
		var myDescription = Handlebars.compile(templateText);
		const myHTML = await myDescription({context: context});
		//console.log(myHTML);
		return myHTML;
	}

	static async updateItemTrackerActor(trackerActor,updates = []){
		let validActor = false;
		let currentItems = {}
		try{
			currentItems = await trackerActor.getFlag('nyquistt-helpers','awardedItem');
			if (currentItems) validActor = true;
		} catch {
			console.log("[updateItemTrackerActor] provide a valid tracker actor");
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
			let usableLevels = this.awardMagicItem.filter(
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
			const flagLong = 'awardedItem.' + 'level' + flagLevel + '.' + updates[i].rarity + '.value';
			let validUpdate = true;
			let oldValue = 0;
			let newValue = updates[i].amount;
			if(newValue === null) validUpdate = false;
			try {
				oldValue = await trackerActor.getFlag('nyquistt-helpers',flagLong);
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
				console.log("[updateItemTrackerActor] skipping update number " + i)
				continue;
			}
			console.log("[updateItemTrackerActor] updating " + flagLong + " with " + newValue)
			await trackerActor.setFlag('nyquistt-helpers',flagLong,newValue);
		}
		const newAwardedItem = await trackerActor.getFlag('nyquistt-helpers','awardedItem');
		const myHTML = await this.getTrackerActorItemHTML(newAwardedItem);
		//console.log(trackerActor);
		const itemList = trackerActor.items;
		let magicItemTrackerFound = false;
		let magicItemTrackerObject = {};
		for(const singleItem of itemList){
			//console.log(singleItem)
			let isMagicItemTracker = false;
			try{
				isMagicItemTracker = singleItem.getFlag("nyquistt-helpers","isMagicItemTracker");
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
			await magicItemTrackerObject.setFlag("nyquistt-helpers","isMagicItemTracker",true);
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
		return {result: "success", awardedItem: newAwardedItem, itemHTML: myHTML}
	}

	static async getItemTrackerActors(){
		const allActors = game.actors;
		//console.log(allActors, allActors.length)
		let resultList = [];
		for(const eachActor of allActors){
			let myObj = {};
			try{
				myObj = await eachActor.getFlag('nyquistt-helpers','awardedItem');
				if(myObj) {
					console.log("[getItemTrackerActors] found an Item Tracker",eachActor);
					//console.log(myObj)
					resultList.push(eachActor);
				}
				else {
					console.log("[getItemTrackerActors] " + eachActor.name + " is not a tracker actor");
				}
			} catch(error) {
				console.log(eachActor.name + " is not a tracker actor");
				console.log(error)
			}
		}
		console.log("[getItemTrackerActors] result List")
		console.log(resultList)
		return resultList;
	}

	static async createMagicItemTrackerActor(actorName = "Mr Item Tracker"){
		const mrTrackerName = actorName;
		const checkActor = game.actors.getName(mrTrackerName);
		if(!checkActor){
			console.log("[createMagicItemTrackerActor] creating the tracker actor " + mrTrackerName)
			let myActor = await Actor.implementation.create({
				name: mrTrackerName,
				type: "character",
			});
			let myID = myActor.id;
			for(var i = 0; i < this.awardMagicItem.length; i++){
				const flagName = "awardedItem.level" + this.awardMagicItem[i].minLevel;
				await myActor.setFlag('nyquistt-helpers',flagName + ".minLevel",this.awardMagicItem[i].minLevel);
				await myActor.setFlag('nyquistt-helpers',flagName + ".maxLevel",this.awardMagicItem[i].maxLevel);
				const myKeys = Object.keys(this.awardMagicItem[i]);
				console.log(myKeys)
				for(var j = 0; j < myKeys.length; j++){
					if((myKeys[j] != "minLevel") && (myKeys[j] != "maxLevel")){
						await myActor.setFlag('nyquistt-helpers',flagName + "." + myKeys[j] + "." + "max",this.awardMagicItem[i][myKeys[j]]);
						await myActor.setFlag('nyquistt-helpers',flagName + "." + myKeys[j] + "." + "value",0);
					}
				}
			}
			await this.updateItemTrackerActor(myActor);
			console.log("[createMagicItemTrackerActor] actor " + actorName + " created")
			//console.log(myActor);
			//create an item, type loot
			//let awardedItemsArray = [];
			//for(var i = 0; i < this.awardMagicItem.length; i++){
			//	let newObj = {name: "Items from level " + this.awardMagicItem[i].minLevel, type: "loot"};
			//	awardedItemsArray.push(newObj);
			//};
			//console.log(awardedItemsArray);
			//let createdItems = await Item.create(awardedItemsArray, {parent: myActor});
			//for(var i = 0; i < this.awardMagicItem.length; i++){
			//	const keysArray = Object.keys(this.awardMagicItem[i]);
			//	let newObj2 = {};
			//	for(var j = 0; j < keysArray.length; j++){
			//		newObj2[keysArray[j]] = this.awardMagicItem[i][keysArray[j]];
			//		if((keysArray[j] != "minLevel") && (keysArray[j] != "maxLevel"))
			//			newObj2[keysArray[j] + "Awarded"] = 0;
			//	}
			//	const myString = JSON.stringify(newObj2);
			//	const myItemID = createdItems[i]._id;
			//	const myItemSystem = {
			//		description: {
			//			value: myString,
			//			chat: myString,
			//		}
			//	};
			//	const myUpdates = [
			//		{_id: myItemID, system: myItemSystem},
			//	];
			//	const updatedItem = await Item.implementation.updateDocuments(myUpdates, {parent: myActor});
			//}
		}
		else{
			console.log("[createMagicItemTrackerActor] tracker actor already exists")
		}
	}

	static async createRollTableByName(name){
		console.log("[createRollTableByName] received name",name)
		const myList = (await this.rollTables).filter(
			(value, index, array) => {
				return value.name == name;
			}
		)
		if(!myList.length) return "error";
		const myTable = myList[0];
		console.log(myTable);
		let myData = {
			name: myTable.name,
			formula: myTable.formula,
			results: [],
		}
		for(var i = 0; i < myTable.results.length; i++){
			let myObj = this.createCopy(myTable.results[i]);
			myObj.type = foundry.CONST.TABLE_RESULT_TYPES.TEXT;
			myData.results.push(myObj);
		}
		console.log(myData)
		const myRollTable = await RollTable.implementation.create(myData);
		console.log(myRollTable)
		return "done"
	}

	static async gimmeRollTableNames(){
		await this.rollTables;
		let myNameList = [];
		//console.log(this.rollTables)
		//return [];
		(await this.rollTables).forEach(
			(value, index, array) => {
				myNameList.push(value.name);
			}
		)
		return myNameList;
	}

	static async readListOfJsonFiles(fileList){
		let myList = [];
		for(const eachFile of fileList){
			console.log("[readListOfJsonFiles] fetching " + eachFile);
			const myJson = await this.readJsonFile(eachFile);
			myList.push(myJson);
		}
		console.log("[readListOfJsonFiles] list of json: ", myList)
		return myList;
	}

	static async readJsonFile(fileName){
		const fetchResponse = await fetch(`${nyquisttHelpersModPath}jsons/${fileName}`);
		if (!fetchResponse.ok) return {};
		const jsonText = await fetchResponse.text();
		const myJson = JSON.parse(jsonText);
		return myJson;
	}

	//utilities
	static createCopy(myObj){
		return JSON.parse(JSON.stringify(myObj));
	}

	static encountersGivenMaxXP(maxXP, minXP = 0){
		//returns all the CRs that are compatible with maxXP and minXP
		//console.log('MAX XP:' + maxXP);
		const result = this.encounterXpByCR.filter(
			(element, index, array) => {
				//console.log(element);
				return (element.xp <= maxXP) && (element.xp >= minXP);
			}
		);
		return result;
	}

	static encountersGivenTotalXp(totalXP, minXP = 0){
		//returns a list of CRs (monsters) that together amount to totalXP (as close as possible) and individually provide at least minXP
		let myMonsterList = [];
		while(totalXP > 0){
			const possibleMonsters = this.encountersGivenMaxXP(totalXP, minXP); //shallow copy because of filter in encountersGivenMaxXP
			if(possibleMonsters.length == 0) {
				//console.log('quitting, remaining XP:' + totalXP);
				break;
			}
			const randInt = Math.floor(Math.random() * possibleMonsters.length);
			myMonsterList.push(this.createCopy(possibleMonsters[randInt]));
			totalXP -= possibleMonsters[randInt].xp;
		}
		return {remainingXP: totalXP, monsters: myMonsterList};
	}

	static computeBudget(playersList, encType = "moderate"){
		/* 
		computes the XP budget for a fight performed by the playersList with difficulty encType
		playersList = [{lvl: xx}];
		encType = low | moderate | high
		*/
		let totalBudget = 0;
		for(var i = 0; i < playersList.length; i++){
			if(playersList[i].lvl > 0)
				totalBudget += this.encounterXpBudgetByLevel.filter(
					(element) => {return element.lvl == playersList[i].lvl}
				)[0][encType];
		}
		return totalBudget;
	}

	static xpByLevel(lvl){
		//returns the XP needed to reach level lvl
		if(lvl < 1) return 0;
		return this.xpVsLevel.filter(
			(element) => {return element.lvl == lvl}
		)[0].xp;
	};

	static deltaXpByLevel(lvl){
		//computes the XP needed to go from lvl-1 to lvl
		if(lvl < 2) return 0;
		return this.xpByLevel(lvl) - this.xpByLevel(lvl-1);
	};

	static async advancementByLvlHtml(){
		//creates the HTML string that represents a table with the amount of fights for the 3 possible difficulty level needed to increase the player level for each level (0-20)
		let tableAdvancement = [];
		for (var myLevel2 = 0; myLevel2 < 21; myLevel2++){
			const deltaXP = game.cc2024.API.nyqTables.deltaXpByLevel(myLevel2);
			//console.log('level: ' + myLevel2 + ' xp: ' + deltaXP);
			const budgetLow = game.cc2024.API.nyqTables.computeBudget([{lvl: myLevel2-1}],'low');
			const budgetModerate = game.cc2024.API.nyqTables.computeBudget([{lvl: myLevel2-1}],'moderate');
			const budgetHigh = game.cc2024.API.nyqTables.computeBudget([{lvl: myLevel2-1}],'high');
			//console.log('budget (low,moderate,high): ' + budgetLow + ', ' + budgetModerate + ', ' + budgetHigh);
			const newField = {lvl: myLevel2, deltaXP: deltaXP, low: (deltaXP/budgetLow).toFixed(2), moderate: (deltaXP/budgetModerate).toFixed(2), high: (deltaXP/budgetHigh).toFixed(2)};
			tableAdvancement.push(newField);
		}
		//console.log(tableAdvancement)
		//read template
		const response = await fetch(`${nyquisttHelpersModPath}templates/xp-advancement-by-fight-difficulty.hbs`);
		if (!response.ok) return 'empty';
		//extract text
		const templateText = await response.text();
		//compile the tamplate
		var myDescription = Handlebars.compile(templateText);
		const myHTML = await myDescription({tableAdvancement: tableAdvancement});
		//console.log(myHTML);
		return myHTML;
	}

	static async getIndividualTreasureRollStrings(CR){
		//provides the individual treasure roll strings for a monster with given CR
		if(CR < 0) CR = 0;
		const possibleTreasureStrings = this.treasureIndividualByCR.filter(
			(element) => { return element.minCR <= CR }
		);
		possibleTreasureStrings.sort(
			(a,b) => { 
				//console.log(String(a.minCR) + String(b.minCR));
				return b.minCR - a.minCR //descending
			} 
		)
		//console.log(possibleTreasureStrings);
		const actualTreasureString = possibleTreasureStrings[0];
		//console.log(actualTreasureString);
		return actualTreasureString;
	}

	static async getTreasureHoardRollStrings(CR){
		//provides the individual treasure roll strings for a monster with given CR
		if(CR < 0) CR = 0;
		const possibleTreasureStrings = this.trasureHoardByCR.filter(
			(element) => { return element.minCR <= CR }
		);
		possibleTreasureStrings.sort(
			(a,b) => { 
				//console.log(String(a.minCR) + String(b.minCR));
				return b.minCR - a.minCR //descending
			} 
		)
		//console.log(possibleTreasureStrings);
		const actualTreasureString = possibleTreasureStrings[0];
		//console.log(actualTreasureString);
		return actualTreasureString;
	}

	static async rollIndividualTreasure(CR, showDice = false){
		//rolls the individual treasure for a monster with given CR
		const rollStrings = await this.getIndividualTreasureRollStrings(CR);
		let plat = new Roll(rollStrings.plat);
		let gold = new Roll(rollStrings.gold);
		let silver = new Roll(rollStrings.silver);
		let copper = new Roll(rollStrings.copper);

		let myResult = {};

		if(rollStrings.plat != '0'){
			await plat.evaluate();
			//console.log('plat: ' + plat.result);
			if(showDice) await plat.toMessage();
			myResult.plat = {total: plat.total, result: plat.result};
		} else {
			myResult.plat = {total: 0, result: 0};
		};
		if(rollStrings.gold != '0'){
			await gold.evaluate();
			//console.log(gold);
			//console.log('gold: ' + gold.result);
			if(showDice) await gold.toMessage();
			myResult.gold = {total: gold.total, result: gold.result};
		} else {
			myResult.gold = {total: 0, result: 0};
		};
		if(rollStrings.silver != '0'){
			await silver.evaluate();
			//console.log('silver: ' + silver.result);
			if(showDice) await silver.toMessage();
			myResult.silver = {total: silver.total, result: silver.result};
		} else {
			myResult.silver = {total: 0, result: 0};
		};
		if(rollStrings.copper != '0'){
			await copper.evaluate();
			//console.log('copper: ' + copper.result);
			if(showDice) await copper.toMessage();
			myResult.copper = {total: copper.total, result: copper.result};
		} else {
			myResult.copper = {total: 0, result: 0};
		};
		//console.log(r.result);   // 16 + 2 + 4
		//console.log(r.total);    // 22
		return myResult;
	}

	static async rollHoardTreasure(CR, showDice = false){
		//rolls the individual treasure for a monster with given CR
		const rollStrings = await this.getTreasureHoardRollStrings(CR);
		let plat = new Roll(rollStrings.plat);
		let gold = new Roll(rollStrings.gold);
		let silver = new Roll(rollStrings.silver);
		let copper = new Roll(rollStrings.copper);
		let magicItem = new Roll(rollStrings.magicItem);

		let myResult = {};

		if(rollStrings.plat != '0'){
			await plat.evaluate();
			//console.log('plat: ' + plat.result);
			if(showDice) await plat.toMessage();
			myResult.plat = {total: plat.total, result: plat.result};
		} else {
			myResult.plat = {total: 0, result: 0};
		};
		if(rollStrings.gold != '0'){
			await gold.evaluate();
			//console.log(gold);
			//console.log('gold: ' + gold.result);
			if(showDice) await gold.toMessage();
			myResult.gold = {total: gold.total, result: gold.result};
		} else {
			myResult.gold = {total: 0, result: 0};
		};
		if(rollStrings.silver != '0'){
			await silver.evaluate();
			//console.log('silver: ' + silver.result);
			if(showDice) await silver.toMessage();
			myResult.silver = {total: silver.total, result: silver.result};
		} else {
			myResult.silver = {total: 0, result: 0};
		};
		if(rollStrings.copper != '0'){
			await copper.evaluate();
			//console.log('copper: ' + copper.result);
			if(showDice) await copper.toMessage();
			myResult.copper = {total: copper.total, result: copper.result};
		} else {
			myResult.copper = {total: 0, result: 0};
		};
		if(rollStrings.magicItem != '0'){
			await magicItem.evaluate();
			//console.log('copper: ' + copper.result);
			if(showDice) await magicItem.toMessage();
			myResult.magicItem = {total: magicItem.total, result: magicItem.result};
		} else {
			myResult.magicItem = {total: 0, result: 0};
		};
		//console.log(r.result);   // 16 + 2 + 4
		//console.log(r.total);    // 22
		return myResult;
	}

	static async csv2array(fileName,splitter,dirName='csv'){
		const myQuots = ["'", '"'];
		//fetch del file
		const response = await fetch(`${nyquisttHelpersModPath}${dirName}/${fileName}`);
		if (!response.ok) return;
		let csvText = await response.text();
		//prima riga
		let keys = [];
		let rest = [];
		let nextRow = [];
		let keysDone = false;
		let done = false;
		while(!done){
			let nextString = "";
			//console.log("text length: ",csvText.length);
			//check for the start of a quote
			let quoted = false;
			let quoteUsed = "";
			for(var i = 0; i < myQuots.length; i++){
				if(csvText.indexOf(myQuots[i]) == 0){
					quoted = true;
					quoteUsed = myQuots[i];
					break;
				}
			}
			if(quoted){
				//console.log("found a quote")
				const quotedEnd = csvText.indexOf(quoteUsed,1);
				nextString = csvText.slice(quoteUsed.length,quotedEnd);
				csvText = csvText.slice(quotedEnd+1);
				nextRow.push(nextString);
				continue;
			}
			//check for new line and the splitter
			let chokeEnd = 0;
			let nextJump = 0;
			let newLine = false;
			const splitterPos = csvText.indexOf(splitter);
			const newlinePos = csvText.indexOf("\n");
			if(splitterPos == 0){ //the spitter is the next character
				csvText = csvText.slice(splitter.length)
				continue
			}
			else if( (newlinePos == -1) && (splitterPos == -1) ) {  //final record with end of file or just end of file
				console.log("final record or end of file")
				newLine = true;
				chokeEnd = csvText.length;
				nextJump = 0;
			}
			else if( (newlinePos != -1) && (splitterPos == -1) ) {
				newLine = true;
				chokeEnd = newlinePos;
				nextJump = "\n".length;
			}
			else { // both different from -1
				newLine = (newlinePos < splitterPos) ? true : false;
				chokeEnd = (newlinePos < splitterPos) ? newlinePos : splitterPos;
				nextJump = (newlinePos < splitterPos) ? "\n".length : splitter.length;
			}
			nextString = csvText.slice(0,chokeEnd);
			csvText = csvText.slice(chokeEnd+nextJump);
			nextRow.push(nextString);
			if(newLine){
				if(keysDone) {
					rest.push(nextRow);
				}
				else {
					for(var i = 0; i < nextRow.length; i++){
						keys.push(nextRow[i])
					}
					keysDone = true;
				}
				nextRow = [];
			}
			if(csvText.length==0){
				console.log("end of file")
				done=true;
			}
		}
		//console.log("keys:")
		//console.log(keys)
		//console.log("keys.length: " + keys.length)
		//console.log("rest:")
		//console.log(rest)
		let myResult = [];
		for(var i = 0; i < rest.length; i++){
			let myRow = {};
			for(var j = 0; j < keys.length; j++){
				myRow[keys[j]] = rest[i][j];
				//if((i==100)&&(j==2)) {
				//	console.log("i==100, j==2")
				//	console.log("keys[j]: " + keys[j] + " rest[i][j]:" +rest[i][j])
				//};
			}
			//if(i==100) {
			//	console.log("i==100")
			//	console.log("myRow:", myRow)
			//};
			myResult.push(myRow);
		}
		return myResult;

		//const [keys, ...rest] = csvText.trim().split("\n").map((item) => item.split(splitter));
		//const formedArr = rest.map((item) => {
		//	const object = {};
		//	keys.forEach((key, index) => (object[key] = item.at(index)));
		//	return object;
		//});
		//return formedArr;
	}

	static extractCR(monsterObj){
		//console.log(monsterObj);
		if(monsterObj.CR === undefined) return -1;
		//console.log(monsterObj);
		const myCR = monsterObj.CR;
		//console.log(myCR)
		const parenthesisPos = myCR.indexOf("(");
		let actualCR = "";
		if(parenthesisPos > -1) actualCR = myCR.slice(0,parenthesisPos);
		actualCR = actualCR.trim();
		//console.log(actualCR)
		return actualCR;
	}

	static floatCR(cr){
		let myCR = 0.0;
		switch(cr){
			case "1/8":
				myCR = 1.0/8.0;
				break
			case "1/4":
				myCR = 1.0/4.0;
				break
			case "1/2":
				myCR = 1.0/2.0;
				break
			default:
				myCR = parseInt(cr);
				break
		}
		//console.log("cr: " + cr + " myCR: " + myCR);
		return myCR;
	}

	static async getMonstersByCR(CR){
		//to do: filter this.monsterList by CR
		//console.log(this.monsterList);
		const myList = await this.monsterList.then(
			(value) => {
				const myList = value.filter(
					(element) => {
						const actualCR = this.extractCR(element);
						//console.log(actualCR,CR)
						return actualCR == CR;
					}
				)
				return myList;
			}
		)
		//const myList = this.monsterList.filter(
		//	(element) => {
		//		const actualCR = this.extractCR(element);
		//		return actualCR == CR;
		//	}
		//)
		//console.log(myList);
		return myList;
	}

	static async tableHTML(initialListOfTables, myListOfHeaders = []){
		let listOfTables = [];
		if(myListOfHeaders.length){ //reformat the objects
			for(var i = 0; i < initialListOfTables.length; i++){
				let newTable = {
					title: initialListOfTables[i].title,
					rows: [],
				};
				for(var j = 0; j < initialListOfTables[i].rows.length; j++){
					let newObj = {}
					for(var k = 0; k < myListOfHeaders.length; k ++){
						newObj[myListOfHeaders[k]] = initialListOfTables[i].rows[j][myListOfHeaders[k]];
					}
					newTable.rows.push(newObj);
				}
				listOfTables.push(newTable);
			}
		}
		else{
			listOfTables = initialListOfTables;
		}
		const response = await fetch(`${nyquisttHelpersModPath}templates/list-of-tables.hbs`);
		if (!response.ok) return 'empty';
		//extract text
		const templateText = await response.text();
		//compile the tamplate
		var myDescription = Handlebars.compile(templateText);
		const myHTML = await myDescription({listOfTables: listOfTables});
		//console.log(myHTML);
		return myHTML;
	}
}

//game.nyquisttHelpers.API.testFunction()
const nyquisttHelpers = {
	API: {
		showMagicItemTrackerApp: showMagicItemTrackerApp,
		showCharacterCreationApp: showCharacterCreationApp,
		nyqTables: nyqTables,
	},
}

