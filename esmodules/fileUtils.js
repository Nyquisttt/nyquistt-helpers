import * as nyqGeneralConfig from './nyqGeneralConfig.js';
import {nyqLog} from './logging.js';

const preStr = "[nyqFileUtils] ";

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
  nyqLog(preStr + "trying iterating library " + libFile)
  const slashPosiz = libFile.lastIndexOf("/");
  const filePath = libFile.slice(0,slashPosiz);
  const fileName = libFile.slice(slashPosiz+1);
  const readJson = await readJsonFile(fileName,filePath);
  if(!Object.keys(readJson).length){
    nyqLog(preStr + "the library file is empty")
    yield [undefined, undefined]
  }
  else if(!readJson.fileList){
    nyqLog(preStr + "the lib file is not properly formatted")
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
  nyqLog(preStr + "fetching file " + fileName + " in " + filePath)
  const slashPosiz = filePath.lastIndexOf("/");
  if(slashPosiz == filePath.length-1) filePath = filePath.slice(0,slashPosiz); //without slash
  let jsonText = {};
  try {
      const fetchResponse = await fetch(`${filePath}/${fileName}`);
      if (!fetchResponse.ok) throw new Error('file cannot be fetched');
      jsonText = await fetchResponse.text();
  } catch (fetchError) {
      nyqLog(preStr + "JSON file fetch failed with error: " + fetchError,'error');
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
      nyqLog(preStr + "skipping non json file " + eachFile,"warn")
      continue;
    }
    if( slashPosiz == -1) {
      myFile = eachFile;
    }
    else if(slashPosiz == eachFile.length-1){
      nyqLog(preStr + "skipping file " + eachFile,"warn")
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


export { iterateJsonLibrary, cleanNames, readJsonFile, readListOfJsonFiles }