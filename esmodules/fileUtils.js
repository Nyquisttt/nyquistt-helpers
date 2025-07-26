import * as nyqGeneralConfig from './nyqGeneralConfig.js';
import {nyqLog} from './logging.js';

const preStr = "[nyqFileUtils] ";
const identityString = "nyqFileUtils"

//import fs from 'fs';
//import path from 'path';

//function* readAllFiles(dir) {
async function* iterateJsonLibrary(libFile) {
//function* iterateJsonLibrary(libFile) {
//  const cancella = [1,2,3];
//  for(var i = 0; i < 3; i++){
//    yield cancella[i]
//  }
//  return
  nyqLog("trying iterating library " + libFile, identityString)
  const slashPosiz = libFile.lastIndexOf("/");
  const filePath = libFile.slice(0,slashPosiz);
  const fileName = libFile.slice(slashPosiz+1);
  const readJson = await readJsonFile(fileName,filePath);
  if(!Object.keys(readJson).length){
    nyqLog("the library file is empty", identityString)
    yield [undefined, undefined]
  }
  else if(!readJson.fileList){
    nyqLog("the lib file is not properly formatted", identityString)
    yield [undefined, undefined]
  }
  else{
    const fileList = readJson.fileList;
    for(const eachObject of fileList){
      if((eachObject.fileName)&&(eachObject.filePath)){
        //console.log("yiiiiealding")
        yield [eachObject.fileName, eachObject.filePath]
      }
      else if((eachObject.folder)&&(eachObject.fileList)){
        //console.log("found a folder")
        for(const eachFile of eachObject.fileList){
          yield [eachFile, eachObject.folder];
        }
      }
    }
  }
    /*
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      yield* readAllFiles(path.join(dir, file.name));
    } else {
      yield path.join(dir, file.name);
    }
  }
  */
}

function cleanNames(initName){
  return initName;
}

async function readJsonFile(fileName, filePath = `${nyqGeneralConfig.nyqModPath}/jsons`){
  nyqLog("fetching file " + fileName + " in " + filePath, identityString)
  const slashPosiz = filePath.lastIndexOf("/");
  if(slashPosiz == filePath.length-1) filePath = filePath.slice(0,slashPosiz); //without slash
  let jsonText = {};
  try {
      const fetchResponse = await fetch(`${filePath}/${fileName}`);
      if (!fetchResponse.ok) throw new Error('file cannot be fetched');
      jsonText = await fetchResponse.text();
  } catch (fetchError) {
      nyqLog("JSON file fetch failed with error: " + fetchError,identityString,'error');
      return {};
  }
  let myJson = JSON.parse(jsonText);
  myJson.fileName = fileName;
  myJson.filePath = filePath;
  return myJson;
}

async function readListOfJsonFiles(fileList){
  if(!Array.isArray(fileList)) fileList = [fileList];
  let myList = [];
  for(const eachFile of fileList){
    //look for the path
    let myFile = '';
    let myPath = undefined;
    const slashPosiz = eachFile.lastIndexOf("/");
    const jsonPosiz = eachFile.lastIndexOf(".json");
    if(jsonPosiz != eachFile.length-5){
      nyqLog("skipping non json file " + eachFile, identityString,"warn")
      continue;
    }
    if( slashPosiz == -1) {
      myFile = eachFile;
    }
    else if(slashPosiz == eachFile.length-1){
      nyqLog("skipping file " + eachFile,identityString,"warn")
      continue;
    }
    else{
      myPath = eachFile.slice(0,slashPosiz);  //without the slash
      myFile = eachFile.slice(slashPosiz+1);
    }
    const myJson = await readJsonFile(myFile,myPath);
    if(Object.keys(myJson).length) myList.push(myJson);
  }
  return myList;
}

async function handlerFilePickerSaveFile(pathString, filePickerObj){
    //console.log(pathString, filePickerObj)
    const uploadUrl = "/upload"
    let mySource = null
    for(const [key,value] of Object.entries(filePickerObj.sources)){
        if(value.target !== undefined && value.target === pathString){
            mySource = key
            break
        }
    }
    const myFile = filePickerObj.nyqData.file

    const myFormData = new FormData()
    myFormData.set("source", mySource);
    myFormData.set("target", pathString);
    myFormData.set("upload", myFile);
    const myMethod =  "POST" //"PUT" // 
    const request1 = new Request(uploadUrl,{
        method: myMethod,
        body: myFormData,
    })
    
    const myRes = await fetch(request1)
    const response = await myRes.json()
    //console.log(response)
    const {yepResolve, nopeReject} = filePickerObj.nyqPromise
    if(response.status === "success") yepResolve(response);
    else nopeReject(response)
}

async function saveObjectToFile(fileObject, fileName) {
  const myFile = new File([JSON.stringify(fileObject, null, " ")],fileName,{type: "application/json"})
  let myFilePicker = new foundry.applications.apps.FilePicker.implementation({callback: handlerFilePickerSaveFile, type: "folder", title: "Pick the folder"})
  //used to pass the this of the caller dialog to the picker funciton
  myFilePicker.nyqData = {file: myFile}
  //create the promise
  let { promise: fileIsWritten, resolve: yepResolve, reject: nopeReject } = Promise.withResolvers();
  myFilePicker.nyqPromise = {yepResolve: yepResolve, nopeReject: nopeReject}
  const pickerResult = await myFilePicker.render(true)
  return await fileIsWritten
  
}


export { iterateJsonLibrary, cleanNames, readJsonFile, readListOfJsonFiles, saveObjectToFile }