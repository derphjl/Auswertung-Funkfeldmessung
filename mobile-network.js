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
  bandwidth: '20',
  frequencies: ['1462', '1482', '1815', '1845', '1865', '2120', '2140', '2160', '2630', '2650', '2670'],
};
const frequenciesLte10 = {
  bandwidth: '10',
  frequencies: ['796', '806', '816', '930', '940', '950', '1830', '2685'],
};
const frequenciesLte5 = {
  bandwidth: '5',
  frequencies: ['957.5', '1875.5'],
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
    const snapshots = directoryEntries.filter((entry) => entry.match(new RegExp(/^\w{3}\d{4}.csv$/)));
    
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
      const occurencesOfSweep = linesOfFile[0].split(`,`).filter((entry) => entry.match(new RegExp(/Sweep/)));
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
  
  trace.maxAmplitude ? getMinMaxAmplitudes(trace) : '' ; //see if the getMinMaxAmplitudes has been called alreade. If not, call it.
  let noisefloor = trace.minAmplitude;
  let bandwidth = referenceLteFrequencies.bandwidth;
  let workingSpan;
  
  for(let parameter of trace.parameters ) {
    if(parameter.title === "Span") { //iteratre through the parameters of the trace and pick the span parameter
      workingSpan = parameter.value;
      break;  //once the working span has been found, we can break out of the parameter iteration.
    }
  }
  
  let stepSize = workingSpan / trace.records.length;
  
  
  
  for (let referenceFrequency of referenceLteFrequencies.frequencies) {
    if (!(((referenceFrequency * 1000000) < trace.records[0].frequency) || ((referenceFrequency * 1000000) > trace.records[trace.records.length - 1].frequency)) ) {
      //find the index position that matches the center frequency closest
      
      //from the array of record objects, extract a list of just the frequencies and put it into the array "tempFrequencyArray"
      let tempFrequencyArray = Array.from(trace.records, (entry) => entry.frequency);
      
      // console.log("Before sort for " + referenceFrequency + ":");
      // console.log(tempFrequencyArray);
      
      
      tempFrequencyArray.sort((a, b) => {
        //check if a or be is closer to referenceFrequency. If a is closer, return positive value. if b is closer, reutn negative value
      });
      
      // console.log("After sort for " + referenceFrequency + ":");
      // console.log(tempFrequencyArray);
      
      
      //find out how many steps we need to fetch for the signal, then only evaluate the center 80%
      let bandwidthInSteps =  ((bandwidth * 1000000) / stepSize); //bandwidth is in MHz and stepSize is in Hz
      let startIterate = Math.floor((( Math.floor( bandwidthInSteps / 2 ) ) * -1 ) * 0.9);
      let stopIterate = Math.floor(( Math.floor( bandwidthInSteps / 2 ) ) * 0.9);
      for ( let i = startIterate ; i <= stopIterate ; i++ ) {
        
      }
    } else { 
      //console.log("With reference " + referenceFrequency + " and Trace starting at " + trace.records[0].frequency / 1000000 + " and ending at " + trace.records[trace.records.length - 1].frequency / 1000000 + " skipped trace due to implausibility") 
    };
  } 
}

// a GSM Signal has a Bandwith of 200kHz. Neighbouring Signals may be cut off here, TODO Fix
function identifyAllGSMSignals(trace) {
  
  trace.maxAmplitude ? getMinMaxAmplitudes(trace) : '' ; //see if the getMinMaxAmplitudes has been called alreade. If not, call it.
  let workingTrace = trace; //we will be mutating this trace later, so we'll create a working copy in the scope of the analysis.
  let workingFrequency = trace.records.toSorted((firstItem, secondItem) => secondItem.amplitude - firstItem.amplitude)[0].frequency;
  let workingAmplitude = trace.maxAmplitude;  //for the first iteration, the max amplitude from the getMinMaxAmplitudes function is used.
  let workingIndex = trace.records.findIndex((element) => element.frequency === workingFrequency);
  let signalWidth = 400000; //with RBW = 300kHz setting the signal width smaller does not make any sense. TODO: find a value that works well.
  let trueSignalWidth = 200000;
  let workingSpan;
  let amplitudeIsNoticableThreshold = 0.9; //this ratio has to be statisfied for the detection to contunue (0.1 = only comically strong signals will be detected, 0.99 = every teeny blip will be detected)
  let signalIsNotFlukeValue = 0.95; //when a peak is being detected, we take it and the values around it and average it out. This average must be withing i.e. 95% of the peak value to not be a fluke (0.999 = almost everything will count as a fluke, 0.1 = this calculation might as well not exist and would only disqualify values that have a physically impobbible drop in amplitude from one record to the next.)

  for(let parameter of workingTrace.parameters ) {
    if(parameter.title === "Span") { //iteratre through the parameters of the trace and pick the span parameter
      workingSpan = parameter.value;
      break;  //once the working span has been found, we can break out of the parameter iteration.
    }
  }

  //check how many records we need to delete to hold the whole signal    
  let stepSize = workingSpan / workingTrace.records.length;
  let stepAmmount = Math.ceil(( signalWidth / 2 ) / stepSize);
  
  while (workingAmplitude > Number(trace.minAmplitude) * amplitudeIsNoticableThreshold) {    
    //if we don't "have enough space", meaning that the max amplitude is too close to the beginning or end of the data, there are fallbacks required. With the spectrum rider, there are always 710 data points.
    //TODO: In that case, dont just give up, maxbe find the max value in a workable context? maybe dial down the analysis or make it one-sided? idk.
    if (workingIndex > 5 || workingIndex < 705){
      let addition = 0; //Average out the working position with the ones around it (one left, one right). This makes sure the measurement is not a fluke. The average should be smaller, but not too small
      for (let i = -1 ; i < 2 ; i++){
        addition += Number(workingTrace.records[workingIndex + i].amplitude);
      }
      let averageAroundIndex = addition / 3;

      if ((workingTrace.records[workingIndex].amplitude / averageAroundIndex) > signalIsNotFlukeValue){

          let sepperationValueBelow = workingTrace.records[workingIndex].amplitude / workingTrace.records[workingIndex - stepAmmount].amplitude;
          let sepperationValueAbove = workingTrace.records[workingIndex].amplitude / workingTrace.records[workingIndex + stepAmmount].amplitude;

          if ((sepperationValueAbove < 0.9) && (sepperationValueBelow) < 0.9) {
            let candidateFrequency = workingTrace.records[workingIndex].frequency;
            let candidateFrequencyOnChannel = ((Math.round(candidateFrequency / trueSignalWidth) * trueSignalWidth)) ;
            console.log("Sepperation is good! A valid GSM signal seems to be at " + candidateFrequencyOnChannel);

          }
      } else {
        // console.log("💥 Not plausible: The amplitude at frequency " + Math.trunc(workingFrequency/1000)/1000 + " MHz violates the ratio test.");
      }
    } else {
      //console.log("💥 Problematic! The max-point is too close to the edge. Ignoring for now.")
    };

    //cleanup: remove the peak some signal around it. this enables us to find the next candidate for max amplitude detection    
    for (let i = -stepAmmount ; i <= stepAmmount ; i++ ) {
      if (workingTrace.records[workingIndex + i]) { workingTrace.records[workingIndex + i].amplitude = workingTrace.minAmplitude };  //reduce the signal down to the noise floor
    }

    //fetch the new value for max amplitude, print.
    workingFrequency = trace.records.toSorted((firstItem, secondItem) => secondItem.amplitude - firstItem.amplitude)[0].frequency;
    workingAmplitude = workingTrace.records.toSorted((firstItem, secondItem) => secondItem.amplitude - firstItem.amplitude)[0].amplitude;
    workingIndex = trace.records.findIndex((element) => element.frequency === workingFrequency);

  } //end of while. if we pass this point, there is no longer adequate sepperation to identify any signal. the evaluation for this trace is not complete. 
}

for (let point of site.points) { 
  console.log("\n Now at Point " + point.ref);
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
          console.log("Go for " + snapshot.ref);
          identifyAllLteSignals(trace, frequenciesLte20);
          // identifyAllLteSignals(trace, frequenciesLte10);
          // identifyAllLteSignals(trace, frequenciesLte5);
          //identifyAllGSMSignals(trace);
          
          break;
        }        
      }
    }  
  }
}

} catch (error) {
  console.error('there was an error:', error.message);
}