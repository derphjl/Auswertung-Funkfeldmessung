import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';

const siteReference = "Gebäude X";

//## Type definitions. Site -> Point -> Network

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
  console.log('\n📡 Analysis of Radio Field Measurements - WiFi 🔍');
  
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
    const snapshots = directoryEntries.filter((entry) => entry.match(new RegExp(/^.*Access Points.*$/)));
    
    //### Section 3: Within a Point, all files that match the above regex qualify as a snapshot. Iterate through the snaphots. ###
    for (let currentSnapshot of snapshots) {
      
      //### Section 4: The Snapshot is a strange pipe sepperated file. First, split into lines. ###
      let linesOfFile = ((await readFile(`./results/${currentPoint}/${currentSnapshot}`, { encoding: 'utf8' })).trim()).split('\n'); //read the file and split it into lines
      
      //remove the first line of the file, it contains the header data
      let headerLine = linesOfFile.shift();
      let headerElement = headerLine.split('|');
      for (let line of linesOfFile) {
        let network = {};
        let elements = line.split('|');
        for (let i = 0; i < headerElement.length; i++) {
          network[headerElement[i]] = elements[i];
        }
        point.networks.push(network);
      }
    }
    site.points.push(point); //push the current measurement point into the array of points in site

    snapshots.length ? '' : console.log("⚠️  Folder for Point " + currentPoint + " cotains no valid snapshots!");
  } // * end of point *
  console.log("🎉 All available data transfered into defined data structure!\n");   

  /** 
   *  ##############################################################################################
   *  ### IMPORT OF EXISTING DATA IS NOW DONE. FROM HERE ON, IT'S ANALYSIS AND MODIFICATION TIME ###
   *  ##############################################################################################
   */ 

let exportNetworkList = [];
for (let point of site.points ) { 
  for(let network of point.networks) {
    let exportNetwork = {
      ssid : network['SSID'],
      bssid : network['BSSID'],
      strength : network['Strength'],
      channel : network['Center Channel'],
      width : network['Width (Range)'],
      atpoint : point.ref,
    }
    exportNetworkList.push(exportNetwork);
  }
}

//TODO: reduce this repetition thing down to one function.
let NetworkListHeader = exportNetworkList.shift();
let reducedByBssidExportNetworkList = [];
let reducedBySsidExportNetworkList = [];
let knownBssids = [];
let knownSsids = [];
reducedByBssidExportNetworkList = exportNetworkList.filter((longListEntry) => {
  if (knownBssids.includes(longListEntry.bssid)) {
    return false; //the bssid is already known, the new network should not be admitted
  } else {
    knownBssids.push(longListEntry.bssid);
    return true; //the bssid is new, the network will be added
  }
});
reducedBySsidExportNetworkList = exportNetworkList.filter((longListEntry) => {
  if (knownSsids.includes(longListEntry.ssid)) {
    return false; //the bssid is already known, the new network should not be admitted
  } else {
    knownSsids.push(longListEntry.ssid);
    return true; //the bssid is new, the network will be added
  }
});
exportNetworkList.unshift(NetworkListHeader); //add the header back to the exportNetworkList
exportNetworkList.unshift(reducedBySsidExportNetworkList); //add the header to the short list, too.

console.log("📋 Working on " + exportNetworkList.length + " input measurements.");
console.log("⚙️  I found " + reducedByBssidExportNetworkList.length + " unique BSSIDs (Hardware Access Points)");
console.log("🛜  I found " + reducedBySsidExportNetworkList.length + " unique SSIDs (Networks)\n");

  await writeFile('./results/allWifi.csv', objectsToCSV(reducedBySsidExportNetworkList));
  console.log("☑️  Export of unique SSID list complete!\n");

  function objectsToCSV(arr) {
    const array = [Object.keys(arr[0])].concat(arr)
    return array.map(row => {
      return Object.values(row).map(value => {
        return typeof value === 'string' ? JSON.stringify(value) : value
      }).toString()
    }).join('\n')
  }

} catch (error) {
  console.error('there was an error:', error.message);
}