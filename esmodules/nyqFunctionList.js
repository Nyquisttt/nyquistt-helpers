import * as generalUtils from './generalUtils.js'
import * as apiUtils from './apiUtils.js'
import {disableLogging, nyqLog} from './logging.js';

const ExportedFunctionList = [
        {
            name: "generalCheck", isAsync: false, db: "nyqCore",
            requires: [],
            executable(functionData){
                console.log("this is generalCheck")
                console.log("received input:")
                console.log(functionData)
                console.log("output will be ['ciccio','formaggio']")
                return ['ciccio','formaggio']
            }
        },
        {
            name: "generalCheck2", isAsync: false, db: "nyqCore",
            requires: [],
            executable(functionData){
                console.log("this is generalCheck2")
                console.log("received input:")
                console.log(functionData)
                console.log("output will be ['ciccio2','formaggio2']")
                return ['ciccio2','formaggio2']
            }
        },
        {
            name: "generalCheck3", isAsync: false, db: "nyqCore",
            requires: [],
            executable(functionData){
                console.log("this is generalCheck3")
                console.log("received input:")
                console.log(functionData)
                console.log("output will be ['ciccio3','formaggio3']")
                return ['ciccio3','formaggio3']
            }
        },
        {
            name: "readSequenceFromFile", isAsync: true, db: "nyqCore", 
            requires: ['jsonLibList', 'jsLibList','dbName','fileName','sequenceName','sequenceNameKey','sequenceData'],
            async executable(functionData){
                const nyqTables = apiUtils.searchInApi('nyqTables');
                let jsonLibList = functionData.jsonLibList;
                if(!Array.isArray(jsonLibList)) jsonLibList = [jsonLibList];
                for(const eachJsonLib of jsonLibList){
                    await nyqTables.checkLibrary(eachJsonLib)
                }
                const nyqFunctionEngine=apiUtils.searchInApi('nyqFunctionEngine');
                let jsLibList = functionData.jsLibList;
                if(!Array.isArray(jsLibList)) jsLibList = [jsLibList];
                for(const eachJsLib of jsLibList){
                    await nyqFunctionEngine.checkFunctionModule(eachJsLib)
                }
                const dbName = functionData.dbName;
                const fileName = functionData.fileName;
                const sequenceName = functionData.sequenceName
                const sequenceNameKey = functionData.sequenceNameKey
                const tableData= {
                    operationList: ["equalTo"],
                    keyString: [sequenceNameKey],
                    dataValue: sequenceName,
                }
                const sequenceTable = await nyqTables.getFromTable(dbName + "." + fileName,tableData)
                console.log(sequenceTable);
                const actualSequence = sequenceTable[0].sequence;
                const sequenceData = functionData.sequenceData
                return await nyqFunctionEngine.execSequence(actualSequence, sequenceData)
            }
        },
        {
            name: "readTableFromFile", isAsync: true, requires: ["jsonLibList", /*"jsLibList",*/ "tableFullName", 'operationData'], db: "nyqCore",
            async executable(functionData){
                //console.log(functionData)
                const apiRoot = apiUtils.getApiRoot();
                const nyqTables = apiUtils.searchInApi('nyqTables');
                let jsonLibList = this.generalUtils.getNestedObjectValue(functionData,'jsonLibList')
                if(!Array.isArray(jsonLibList)) jsonLibList = [jsonLibList];
                for(const eachJson of jsonLibList){
                    await nyqTables.checkLibrary(eachJson);
                }
                //const nyqFunctionEngine = apiUtils.searchInApi('nyqFunctionEngine');
                //let jsLibList = this.generalUtils.getNestedObjectValue(functionData,jsLibList);
                //if(!Array.isArray(jsLibList)) jsLibList = [jsLibList];
                //for(const eachJs of jsLibList){
                //    nyqFunctionEngine.checkFunctionModule(eachJs)
                //}
                const tableFullName = this.generalUtils.getNestedObjectValue(functionData,"tableFullName")
                const operationData = this.generalUtils.getNestedObjectValue(functionData,"operationData")
                const functionTableList = await nyqTables.getFromTable(tableFullName,operationData)
                return functionTableList;
            }
        },
        {
            name: "checkContex", isAsync: false, requires: [], db: "nyqCore",
            executable(functionData){
                console.log("check context, this:")
                console.log(this)
                console.log("functionData")
                console.log(functionData)
                console.log("this.generalUtils")
                console.log(this.generalUtils)
            }
        },
        {
            name: "wrongFunction", // [1, 2],
            isAsync: false, //"ciccio formaggio", 
            requires: ['none', 'of', 'interesting'], //4, 
            db: 'core', //[1, 2],
            executable: (a)=> console.log(a), //4,
        },
        {
            name: "checkFlattening",
            isAsync: false,
            requires: ['flatObject','nestedObject'],
            db: 'core',
            executable(functionData){
                console.log("this is checkFlattening")
                console.log("received functionData")
                console.log(functionData)
                const flatObject = functionData.flatObject;
                const nestedObject = functionData.nestedObject;
                let myFlat = {}
                let myNested = {}
                this.generalUtils.unflattenObject(myNested,flatObject);
                this.generalUtils.flattenObject(myFlat,nestedObject)
                console.log("myFlat")
                console.log(myFlat)
                console.log("myNested")
                console.log(myNested)
                console.log("checkFlattening complete")
                return ['pippo', 'pluto', 'paperino']
            }
        },
        {
            name: "checkAddingToSequence",
            isAsync: false,
            requires: ["functionName", "functionDB", "functionData", "outputManipulator", "delay"],
            db: 'core',
            executable(functionData){
                console.log("this is checkAddingToSequence")
                console.log("received functionData")
                console.log(functionData)
                this.requestSequenceElement(functionData.functionName,functionData.functionDB,functionData.functionData,functionData.outputManipulator,functionData.delay)
                console.log("checkAddingToSequence complete")
                return ["ciccio", "formaggio"]
            }
        }
]

export { ExportedFunctionList }