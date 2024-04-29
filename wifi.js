import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';

const siteReference = "Gebäude X";

//## Type definitions. Site -> Point -> Network

// The Network is one Data Point of recieved SSID etc.
/**
* @typedef Network
* @type {{
* 
* }}
*  */

// The Point groups multiple Measurement Exports and represents all the measurement activity on a singular location (or point)
/**
* @typedef Point
* @type {{
*  ref: string;
*  building: string;
*  floor: string;
*  networks: Network[];
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
  
  //### SECTION 0: Initialize the environment ###
  console.log('📡 Analysis of Radio Field Measurements 🔍');
  
  /**
  * @type {Site}
  */
  const site = {
    ref: siteReference,
    points: [],
  };
  
  //### SECTION 1: Count the Folders in /results and save the value ###
  console.log("📂 Reading folder '/results'...");
  
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
  
  console.log("☝️  " + points.length + " points were found. Now going through them...");
  
  //### Section 2: Start a Loop: Commit to one Folder, get its Name and save it. Iterate. ###
  for (let currentPoint of points) {
    // call the point type as const point and initialize it with the current point string
    /**
    * @type {Point}
    */
    const point = {
      ref: currentPoint,
      building: "", //TODO: define building within each folder (i.e. "C" in a file building.txt) and read it here
      floor: "",  //TODO: define floor within each folder (i.e. "EG" in a file floor.txt) and read it here
      networks: [],
    }
    
    //In case there are multiple Access Point Lists in the Folder, we will evaluate them all. To step through them, we'll reuse the snapshot logic of mobile-networks.js, but without cascading another type deep
    const directoryEntries = await readdir(`./results/${currentPoint}`);
    const snaphots = directoryEntries.filter((entry) => entry.match(new RegExp(/^.*Access Points.*$/)));
    
    //### Section 3: Within a Point, all files that match the above regex qualify as a snapshot. Iterate through the snaphots. ###
    for (let currentSnapshot of snapshots) {
      
      //### Section 4: The Snapshot is a strange pipe sepperated file. First, split into lines. ###
      let linesOfFile = ((await readFile(`./results/${currentPoint}/${currentSnapshot}`, { encoding: 'utf8' })).trim()).split('\n'); //read the file and split it into lines
      
      /**
      * @type {Network}
      */
      let network = {};
      
      for (let i = 1 ; i < linesOfFile.length ; i++) {
        for (let j = 0; j < linesOfFile[0].split('|').length ; j++ ) {
          let key = linesOfFile[0].split('|')[j];
          let value = linesOfFile[i].split('|')[j];
          network[key]: value;
        } //finished iterating the columns at this point, the network is now fully defined
        point.networks.push(network);
      } //finished the file at this point, all networks are now in the array.
    }
    site.points.push(point); //push the current measurement point into the array of points in site
    console.log("✅ Data for Point " + currentPoint + " with " + snapshots.length + " snapshots imported!");
  } // * end of point *
  console.log("🎉 All points transfered into defined data structure!");   
  
  // //a nice intermediary goal, print some data you can select here
  // console.log("Now, as an example, a bit of data:")
  // console.log(site.points[3].snapshots[6].traces[1]);
  
  /** 
   *  ##############################################################################################
   *  ###                                                                                        ###  
   *  ### IMPORT OF EXISTING DATA IS NOW DONE. FROM HERE ON, IT'S ANALYSIS AND MODIFICATION TIME ###
   *  ###                                                                                        ###
   *  ##############################################################################################
   */ 

  //TODO: Work out analysis of the data
  
  // for (let point of site.points ) { 
  //   for(let snapshot of point.snapshots) {
  //     for(let trace of snapshot.traces) {
  //       let traceIsRelevant = false;
  //       for(let parameter of trace.parameters ) {
  //         if(parameter.title === "Trace Mode" && parameter.value === "Max Hold") {
  //           traceIsRelevant = true;
  //           break;
  //         }
  //       }
        
  //       if(traceIsRelevant) {
  //         let minAmplitude = trace.records.sort((firstItem, secondItem) => firstItem.amplitude - secondItem.amplitude)[0].amplitude;
  //         let maxAmplitude = trace.records.sort((firstItem, secondItem) => secondItem.amplitude - firstItem.amplitude)[0].amplitude;
  //         console.log("MaxHoldTrace @ trace " + trace.parameters[0].value + " snapshot " + snapshot.ref + " point " + point.ref + " noise floor " + minAmplitude + " dBm, max amplitude: " + maxAmplitude);
  //       }
        

  //     }
  //   }
  // }
  
  //TODO: Export the Analysis in a sensical way

} catch (error) {
  console.error('there was an error:', error.message);
}