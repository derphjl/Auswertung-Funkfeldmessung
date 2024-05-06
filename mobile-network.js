import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';

const siteReference = "Gebäude X";

//## Type definitions. Site -> Point -> Snapshot-> Trace -> Record

// The Record is a Pairing of a single Frequency and Amplitude
/**
* @typedef Record
* @type {{
*   frequency: number;
*   amplitude: number;
* }}
*/

/**
* @typedef Parameter
* @type {{
  *   title: string;
  *   value: string;
  *   unit: string;
  * }}
  */

// The Trace represents the single Line on the screen of the Analyzer. The properties are read from the first part of the CSV.
// The Trace will also contain relevant, calculated information such as noise floor average
/**
* @typedef Trace
* @type {{
*   parameters: Parameter[];
*   records: Record[];
*   minAmplitude: number;
*   maxAmplitude: number;
*   detectedSignals: detectedSignal[];
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

//TODO: check these, make sure only BTM (downstream) frequencies are listed.
const frequenciesLte20 = {
  bandwidth: 20,
  frequencies: [1462, 1482, 1815, 1845, 1865, 2120, 2140, 2160, 2630, 2650, 2670],
};
const frequenciesLte10 = {
  bandwidth: 10,
  frequencies: [796, 806, 816, 930, 940, 950, 1830, 2685],
};
const frequenciesLte5 = {
  bandwidth: 5,
  frequencies: [957.5, 1875.5],
};

try {
  //### SECTION 0: Initialize the environment ###
  console.log('📡 Analysis of Radio Field Measurements - Mobile Network Signals 🔍');
  
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
      snapshots: [],
    }
    
    const directoryEntries = await readdir(`./results/${currentPoint}`);
    const snapshots = directoryEntries.filter((entry) => entry.match(/^\w{3}\d{4}.csv$/));
    
    //### Section 3: Within a Point, all files that match the above regex qualify as a snapshort. Iterate through the snaphots. ###
    for (let currentSnapshot of snapshots) {
      // call the snapshot type as sonst snapshot and initialize it with the currentSnapshot as refernce. This is likely a number, but could also be a name
      /**
      * @type {Snapshot}
      */
      const snapshot = {
        ref: currentSnapshot,
        traces: [],
      }
      
      //### Section 4: A Snapshot is a CSV File that is first split into lines ###
      let linesOfFile = ((await readFile(`./results/${currentPoint}/${currentSnapshot}`, { encoding: 'utf8' })).trim()).split('\n'); //read the file and split it into lines
      
      //### Section 5: To fetch the ammount and position of Traces, seach for the Keyword "Sweep" and save the correct positions ###
      //TODO: The more elegant solution would maybe be to check the split aray of elements in a line and check for a pattern of DATA - DATA - EMPTY, returning the position of the first DATA? However, this will work for now!
      const occurencesOfSweep = linesOfFile[0].split(`,`).filter((entry) => entry.match(/Sweep/));
      //occurencesOfSweep is now an array of string containing all occurences of the word "Sweep" (literally as a string containing "Sweep" at this point) in the first line of the file
      let dataIndices = []
      for (let occurenceOfSweep of occurencesOfSweep){  //for any occurence of the word "sweep", get the index position in the line, subtract one, and push it into the aray "dataIndicies"
        dataIndices.push(linesOfFile[0].split(`,`).indexOf(occurenceOfSweep) - 1);
      }
      //dataIndices is now an array containing the starting positions for the data of each trace.
      
      //## Section 6: With dataIndex now representing a single Trace, we start extracting the Data for the trace.
      for (let dataIndex of dataIndices) {
        //With dataIndex now being the starting point of the relevant Data in this loop/Trace, begin a Trace.
        //in scope, dataInxdex describes the trace start position, meaning for every line, the relevant points are, in the case of the head, dataIndex as the key, dataindex + 1 as the value and  dataIndex + 2 as the unit which shall be reduced into the value (it's probably never going to be used anyway)
        /**
        * @type {Trace}
        */
        const trace = {
          parameters : [],
          records : [],
          detectedSignals: [],
        }
        //splitIndex is the line before the line containg the keyword "Frequency [Hz]" and marks the vertical split between the parameters-part and the records-part of the trace
      let splitIndex = linesOfFile.findIndex((singleLine) => singleLine.match(new RegExp(/.*Frequency \[Hz].*/))) - 1; //first we find out where the key "Frequency [Hz] is. This splits Head and Data.
      
      //only working within the parameters-portion of the trace: the key is in the first column, the value in the second and the unit in the third. Wer are producing key-value-pairs, so the unit gets smashed onto the value if applicable.
      for (let lineOfFile of linesOfFile.slice(0,splitIndex)) {
        let elementsOfLine = lineOfFile.split(`,`);
        /**
        * @type {Parameter}
        */
        let parameter = {
          title : elementsOfLine[dataIndex],
          value : elementsOfLine[dataIndex + 1],
          unit : elementsOfLine[dataIndex + 2],
        };
        trace.parameters.push(parameter);
      }
      
      for (let lineOfFile of linesOfFile.slice(splitIndex + 2)) {
        let elementsOfLine = lineOfFile.split(`,`);
        /**
        * @type {Record}
        */
        let record = {
          frequency : elementsOfLine[dataIndex],
          amplitude : elementsOfLine[dataIndex + 1],
        };
        trace.records.push(record);
      }
      snapshot.traces.push(trace);  //push the current trace into the array of traces in the point
    } // * end of trace * 
    point.snapshots.push(snapshot); //push the current snapshot into the array of snapshots in the point
  } // * end of snapshot *
  site.points.push(point); //push the current measurement point into the array of points in site
  snapshots.length ? '' : console.log("⚠️  Folder for Point " + currentPoint + " cotains no valid snapshots!");
} // * end of point *
console.log("🎉 All points transfered into defined data structure!");   

/** 
*  ##############################################################################################  
*  ### IMPORT OF EXISTING DATA IS NOW DONE. FROM HERE ON, IT'S ANALYSIS AND MODIFICATION TIME ###
*  ##############################################################################################
*/ 

function getMinMaxAmplitudes(trace) {
  trace.minAmplitude = trace.records.toSorted((firstItem, secondItem) => firstItem.amplitude - secondItem.amplitude)[0].amplitude;
  trace.maxAmplitude = trace.records.toSorted((firstItem, secondItem) => secondItem.amplitude - firstItem.amplitude)[0].amplitude;
}

function identifyAllLteSignals(trace, referenceLteFrequencies) {
  const focusFactor = 0.9 //an LTE Signal is not uniform but more of a bell curve with a flat middle. For that reason, for amplidtude evaluation we will only look at i.e. 0.9 = 90% of each side of the signal, so the center 80%
  const noisefloor = trace.minAmplitude;
  const bandwidth = referenceLteFrequencies.bandwidth;
  let workingSpan;
  
  for(let parameter of trace.parameters ) {
    if(parameter.title === "Span") { //iteratre through the parameters of the trace and pick the span parameter
      workingSpan = parameter.value;
      break;  //once the working span has been found, we can break out of the parameter iteration.
    }
  }
  
  const stepSize = workingSpan / trace.records.length;
  
  for (let referenceFrequency of referenceLteFrequencies.frequencies) {
    if (!(((referenceFrequency * 1000000) < trace.records[0].frequency) || ((referenceFrequency * 1000000) > trace.records[trace.records.length - 1].frequency)) ) {
      //find the index position that matches the center frequency closest
      const indexOfClosestFrequency = trace.records.findIndex((entry) => Math.abs(entry.frequency - (referenceFrequency * 1000000)) < stepSize);
      
      //find out how many steps we need to fetch for the signal, then only evaluate the center 80%
      const bandwidthInSteps =  ((bandwidth * 1000000) / stepSize); //bandwidth is in MHz and stepSize is in Hz
      const signalStart = indexOfClosestFrequency + Math.floor((( Math.floor( bandwidthInSteps / 2 ) ) * -1 ) * focusFactor);
      const signalEnd = indexOfClosestFrequency + Math.floor(( Math.floor( bandwidthInSteps / 2 ) ) * focusFactor) + 1;
      // console.log("Signal is " + bandwidth + " wide. That is " + bandwidthInSteps + " steps.");
      const minSepForSignalAverage = 3; //minimum sepperation for the average of the whole signal BW against the noise floor in dB
      const minSepForSingleRecord = 2; //minimum sepperation for every record against the noise floor in dB
      
      //first check: iterate though the signal and average out the amplitude value
      let sumArray = [];
      let sumValue = 0;
      for ( let i = signalStart ; i <= signalEnd ; i++ ) {
        sumArray.push(trace.records[i].amplitude);
        sumValue += Number(trace.records[i].amplitude);
      }
      let averageAmplitudeCurrentSignal = sumValue / sumArray.length; //TODO: There has to be a better way to do this. sumArray is only used as a vessel for length, not ideal!
      let separationToNoiseFloor = Number(averageAmplitudeCurrentSignal) - Number(noisefloor);
      
      //TODO: Evaluate if a second check is needed to differanciate setups like 10 + 10 from 20. Probably not relevant?
      
      if (separationToNoiseFloor > minSepForSignalAverage) { //when the average sepparation is sastisfactory, do: second check: sepperation
        let sepIsGoodIterator = 0;
        for ( let i = signalStart ; i <= signalEnd ; i++ ) {
          if (trace.records[i].amplitude - noisefloor > minSepForSingleRecord) {
            sepIsGoodIterator++; //if the sepperation is good, count it on the iterator.
          };
        } 
        if (sepIsGoodIterator > bandwidthInSteps * 0.8) { //If at least 80% of the records in the signal have good sepperation, the signal is true!
          const detectedSignal = {
            type: 'LTE',
            frequency: referenceFrequency,
            bandwidth: bandwidth,
            //TODO: More info needed? Sep to noise floor? Amplitude? 
          }
          trace.detectedSignals.push(detectedSignal);
          
          for ( let i = signalStart ; i <= signalEnd ; i++ ) {
            trace.records[i].amplitude = noisefloor;
          }
        } 
      }
    }
  }
}

// a GSM Signal has a Bandwith of 200kHz. Neighbouring Signals may be cut off here, TODO Fix
function identifyAllGSMSignals(trace) {

  const bandwidth = 0.2;
  const focusFactor = 15; //here, we "abuse" focusFacor as "smear factor" in order to liberally delete all of the GSM signal.
  let workingSpan;
  for(let parameter of trace.parameters ) {
    if(parameter.title === "Span") { //iteratre through the parameters of the trace and pick the span parameter
      workingSpan = parameter.value;
      break;  //once the working span has been found, we can break out of the parameter iteration.
    }
  }
  let frequencyMaxAmplitude = trace.records.toSorted((firstItem, secondItem) => secondItem.amplitude - firstItem.amplitude)[0].frequency;
  let indexMaxAmplitude = trace.records.findIndex((element) => element.frequency === frequencyMaxAmplitude);
  
  const stepSize = workingSpan / trace.records.length;
  const bandwidthInSteps =  ((bandwidth * 1000000) / stepSize); //bandwidth is in MHz and stepSize is in Hz
  const noisefloor = trace.minAmplitude;
  const minSep = 20;

  while ( (trace.records[indexMaxAmplitude].amplitude - noisefloor) >= minSep ) {

    let closestChannel = (Math.round(frequencyMaxAmplitude / (bandwidth * 1000000)) * (bandwidth * 1000000));
    let signalStart = indexMaxAmplitude + Math.floor((( Math.floor( bandwidthInSteps / 2 ) ) * -1 ) * focusFactor);
    let signalEnd = indexMaxAmplitude + Math.floor(( Math.floor( bandwidthInSteps / 2 ) ) * focusFactor) + 1;

    const detectedSignal = {
      type: 'GSM',
      frequency: closestChannel / 1000000,
      //TODO: More info needed? Sep to noise floor? Amplitude? 
    }
    trace.detectedSignals.push(detectedSignal);
    
    //eliminate the signal (with smear left and right)
    for ( let i = signalStart ; i <= signalEnd ; i++ ) {
      if (trace.records[i]) { trace.records[i].amplitude = noisefloor };
    }

    //find the new peak
    frequencyMaxAmplitude = trace.records.toSorted((firstItem, secondItem) => secondItem.amplitude - firstItem.amplitude)[0].frequency;
    indexMaxAmplitude = trace.records.findIndex((element) => element.frequency === frequencyMaxAmplitude);
  }
}

for (let point of site.points) { 
  console.log("\n Now working Point " + point.ref);
  for(let snapshot of point.snapshots) {
    for(let trace of snapshot.traces) {
      let isMaxHold = false;
      let isBelow2 = false;
      for(let parameter of trace.parameters ) {
        
        if(parameter.title === "Trace Mode" && parameter.value === "Max Hold") {
          isMaxHold = true;   //Clear Write Traces are much too unstable to be analyzed and should be disregarded
        }

        if(parameter.title === "Center Frequency" && parameter.value < 2000000000 ) {
          isBelow2 = true;    //GSM can only occur in the 800/900 and the 1800 Band, anything beyong 2GHz is off limits and can be disregarded
        }

        if(isMaxHold && isBelow2) {
          //A relevant trace has been identified and will be passed on to the evaluator functions
          console.log("Results for " + snapshot.ref);
          getMinMaxAmplitudes(trace);
          identifyAllLteSignals(trace, frequenciesLte20);
          identifyAllLteSignals(trace, frequenciesLte10);
          identifyAllLteSignals(trace, frequenciesLte5);
          identifyAllGSMSignals(trace);
          
          break;
        }   
      }
      trace.detectedSignals.length ? console.log(trace.detectedSignals) : '';
    }  
  }
}

//TODO: Hoist the detected signals from the trace object up to the point object as that is where they logically belong.

} catch (error) {
  console.error('there was an error:', error.message);
}