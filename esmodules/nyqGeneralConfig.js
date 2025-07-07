export const apiName = "nyqHelp";
export const apiConnectionName = "game";
export const apiFolderName = 'nyquistt-helpers'
export const moduleId = 'nyquistt-helpers'
export const nyqModPath = 'modules/' + apiFolderName;
export const importRoot = '../../../'; //get back to Data from Data/modules/nyquistt-helpers/esmodules
export let nyqCacheTimeout = 10000;

export function getApiParameters(){
    return {
        apiName: apiName,
        apiConnectionName: apiConnectionName,
        apiFolderName: apiFolderName,
        nyqModPath: nyqModPath,
        nyqCacheTimeout: nyqCacheTimeout,
        moduleId: moduleId,
    }
}

