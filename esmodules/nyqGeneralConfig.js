export let apiName = "nyqHelp";       //this is only used the first time the module is loaded
export const apiConnectionName = "game";
export const apiFolderName = 'nyquistt-helpers'
export const moduleId = 'nyquistt-helpers'
export const nyqModPath = 'modules/' + apiFolderName;
export const importRoot = '../../../';  //get back to Data from Data/modules/nyquistt-helpers/esmodules
export let nyqCacheTimeout = 10000;     //this is only used the first time the module is loaded
export let version = "0.0.0"

export function getVersion(){
    return version
}

export function setVersion(value){
    version = value
}

/**
 * 
 * @returns 
 * {
 *  apiName: string,
 *  apiConnectionName: string
 *  moduleId: string,
 *  nyqModPath: string,
 *  nyqCachedTimeout: number,
 * }
 */
export function getApiParameters(){
    return {
        apiName: apiName,
        apiConnectionName: apiConnectionName,
        apiFolderName: apiFolderName,
        moduleId: moduleId,
        nyqModPath: nyqModPath,
        nyqCacheTimeout: game.settings.get('nyquistt-helpers',"nyqCacheTimeout")
    }
}

Hooks.on("init", async function(){
    /**
     * as it seems, settings must be registered at any init of the environment
     * their content is persistent but the game.settings does not mantain previously registered settings
     */
    //console.log("settings must be created")
    await game.settings.register(moduleId, 'nyqCacheTimeout', {
        name: "Set cache timeout for files",
        hint: "Each json file will be cached for a number of seconds specified in this field",
        scope: "world",      // This specifies a world-level setting
        config: true,        // This specifies that the setting appears in the configuration view
        requiresReload: true, // This will prompt the GM to have all clients reload the application for the setting to take effect
        type: new foundry.data.fields.NumberField({nullable: false, min: 0, max: 100, step: 1}),
        default: 10,         // The default value for the setting
        onChange: value => { // A callback function which triggers when the setting is changed
            console.log(value)
            nyqCacheTimeout = 1000 * value
        }
    })
    await game.settings.register(moduleId, 'apiName', {
        name: "Set the name of the api",
        hint: "the api will be accessible from game.<provided name>",
        scope: "world",      // This specifies a world-level setting
        config: true,        // This specifies that the setting appears in the configuration view
        requiresReload: true, // This will prompt the GM to have all clients reload the application for the setting to take effect
        type: new foundry.data.fields.StringField({nullable: false}),
        default: "nyqHelp",         // The default value for the setting
        onChange: value => { // A callback function which triggers when the setting is changed
            console.log(value)
            apiName = value
        }
    })
})

Hooks.on("setup", function(){
    nyqCacheTimeout = 1000 * game.settings.get('nyquistt-helpers',"nyqCacheTimeout")
    apiName = game.settings.get('nyquistt-helpers',"apiName")
})
