//import * as generalUtils from './generalUtils.js'
//import {nyqLog} from './logging.js';

const ExportedFunctionList = [
        {
            name: "actorStatsUpdate", isAsync: true, requires: ["_id", "system.abilities.str", "system.abilities.dex", "system.abilities.con", "system.abilities.int", "system.abilities.wis", "system.abilities.cha" ],
            db: "dnd5e-5p0p3",
            async executable(functionData){
                const myID = this.generalUtils.getNestedObjectValue(functionData,"_id");
                const mySystem = {
                    abilities: {
                        str: {value: this.generalUtils.getNestedObjectValue(functionData,"system.abilities.str")},
                        dex: {value: this.generalUtils.getNestedObjectValue(functionData,"system.abilities.dex")},
                        con: {value: this.generalUtils.getNestedObjectValue(functionData,"system.abilities.con")},
                        int: {value: this.generalUtils.getNestedObjectValue(functionData,"system.abilities.int")},
                        wis: {value: this.generalUtils.getNestedObjectValue(functionData,"system.abilities.wis")},
                        cha: {value: this.generalUtils.getNestedObjectValue(functionData,"system.abilities.cha")},
                    }
                }
                const myUpdates = [{_id: myID, system: mySystem}];
                //console.log("myUpdates")
                //console.log(myUpdates)
                //return {ciccio:"formaggio"}
                const updated = await Actor.implementation.updateDocuments(myUpdates);
                return updated;
            }
        },
]

export { ExportedFunctionList }