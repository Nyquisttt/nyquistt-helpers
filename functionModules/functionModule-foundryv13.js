//import * as generalUtils from './generalUtils.js'
//import {nyqLog} from './logging.js';

const ExportedFunctionList = [
        {
            name: "actorCreate", isAsync: true, requires: ["name", "type"], db: "foundryv13",
            async executable(functionData){
                const myName = this.generalUtils.getNestedObjectValue(functionData,"name");
                const myType = this.generalUtils.getNestedObjectValue(functionData,"type");
                const myData = {name: myName, type: myType};
                //console.log("myData")
                //console.log(myData)
                //return {id: 1551}
                let myActor = await Actor.implementation.create(myData);
                return myActor;
            }
        },
]

export { ExportedFunctionList }