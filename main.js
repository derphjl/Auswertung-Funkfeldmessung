import { match } from 'node:assert';
import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';

const siteReference = "Gebäude X";

// ## Type definitions. Site -> Point -> Snapshot-> Trace -> Record

// The Record is a Pairing of a single Frequency and Amplitude
/**
* @typedef Record
* @type {{
*   frequency: number;
*   amplitude: number;
* }}
*/

// The Trace represents the single Line on the screen of the Analyzer. The properties are read from the first part of the CSV.
// The Trace will also contain relevant, calculated information such as noise floor average
/**
* @typedef Trace
* @type {{
*   parameters: {
*     [key: string]: string;
*   };
*   records: Record[];
* }}
*/

// The Snapshotis a single CSV File, referencing file name and most likely two traces.
/**
* @typedef Snapshot
* @type {{
*  ref: string;
*  traces: Trace[];
* }}
*  */

// The Point groups multiple Measurement Exports and represents all the measurement activity on a singular location (or point)
/**
* @typedef Point
* @type {{
*  ref: string;
*  building: string;
*  floor: string;
*  snapshots: Snapshot[];
* }}
*/

// The Site is the top level, holding an array of all the point where measurements were taken
/**
* @typedef Site
* @type {{
*  ref: string;
*  points: Point[];
* }}
*/

try {
  
  // ### SECTION 0: Initialize the environment ###
  console.log('## Analysis of Radio Field Measurements ##');
  
  /**
  * @type {Site}
  */
  const site = {
    ref: siteReference,
    points: [],
  };
  
  // ### SECTION 1: Count the Folders in /results and save the value ###
  console.log("Reading folder '/results'...");
  
  const directoryEntries = await readdir(`./results`, { withFileTypes: true });
  const points = directoryEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => { 
    const numericA = Number.parseInt(a);
    const numericB = Number.parseInt(b);
    
    return (Number.isNaN(numericA) ? a : numericA) - (Number.isNaN(numericB) ? b : numericB);
  });
  // now, const measurementFolders: string[] contains the folders withing /results, sorted numerically. The numerical quantity could be accessed with measurementFolders.length
  
  // ### Section 2: Start a Loop: Commit to one Folder, get its Name and save it. Iterate. ###
  for (let currentPoint of points) {
    // call the point type as const point and initialize it with the current point string
    /**
    * @type {Point}
    */
    const point = {
      ref: currentPoint,
      building: "", //TODO: define building within each folder (i.e. "C" in a file building.txt) and read it here
      floor: "",  //TODO: define floor within each folder (i.e. "EG" in a file floor.txt) and read it here
      snapshots: [],
    }
    
    const directoryEntries = await readdir(`./results/${currentPoint}`);
    const snapshots = directoryEntries.filter((entry) => entry.match(new RegExp(/^\w{3}\d{4}.csv$/)));
    
    for (let currentSnapshot of snapshots) {
      // call the point type as const point and initialize it with the current point string
      // console.log("Current Snapshot: " + currentSnapshot);
      
      /**
      * @type {Snapshot}
      */
      const snapshot = {
        ref: currentSnapshot,
        traces: [],
      }

      let linesOfFile = ((await readFile(`./results/${currentPoint}/${currentSnapshot}`, { encoding: 'utf8' })).trim()).split('\n'); //read the file and split it into lines

      // const sweepsInfoArray = [...linesOfFile[0].matchAll("Sweep")]
      // console.log(sweepsInfoArray);

      const occurencesOfSweep = linesOfFile[0].split(`,`).filter((entry) => entry.match(new RegExp(/Sweep/)));
      //occurencesOfSweep is now an array of string containing all occurences of the word "Sweep" in the first line of the file
      let dataIndices = []
      for (let occurenceOfSweep of occurencesOfSweep){  //for any occurence of the word "sweep", get the index position in the line, subtract one, and push it into the aray "dataIndicies"
        dataIndices.push(linesOfFile[0].split(`,`).indexOf(occurenceOfSweep) - 1);
      }
      //dataIndices is now an array containing the starting positions for the data of each trace

      for (let dataIndex of dataIndices) {
      /**
      * @type {Trace}
      */
      const trace = {
        parameters : {},
        records : [],
        }
        //in scope, dataInxdex describes the trace start position, meaning for every line, the relevant points are, in the case of the head, dataIndex as the key, dataindex + 1 as the value and  dataIndex + 2 as the unit which shall be reduced into the value (it's probably never going to be used anyway)
        let splitIndex = linesOfFile.findIndex((singleLine) => singleLine.match(new RegExp(/.*Frequency \[Hz].*/))) - 1; //first we find out where the key "Frequency [Hz] is. This splits Head and Data.
        for (let lineOfFile of linesOfFile.slice(0,splitIndex)) { //In the Data-Portion (start up to splitIndex) the key is in the first column, the value in the second and the unit in the third. Wer are producing key-value-pairs, so the unit gets smashed onto the value if applicable
          let elementsOfLine = lineOfFile.split(`,`);
          let key = elementsOfLine[dataIndex];
          let value = (elementsOfLine[dataIndex + 1] + elementsOfLine[dataIndex + 2]);
          trace.parameters[key] = value;
        }
        
        for (let lineOfFile of linesOfFile.slice(splitIndex + 2)) {
          
          let elementsOfLine = lineOfFile.split(`,`);
          let singularFrequency = elementsOfLine[dataIndex];
          let singularAmplitude = elementsOfLine[dataIndex + 1];
          
          /**
          * @type {Record}
          */
          let record = {
            frequency : singularFrequency,
            amplitude : singularAmplitude,
          };
          trace.records.push(record);
        }
        snapshot.traces.push(trace);  //push the current trace into the array of traces in the point
      } // * end of trace * 
      point.snapshots.push(snapshot); //push the current snapshot into the array of snapshots in the point
    } // * end of snapshot *
    site.points.push(point); //push the current measurement point into the array of points in site
  } // * end of point *   
} catch (error) {
  console.error('there was an error:', error.message);
}


