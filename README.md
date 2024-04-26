# Auswertung-Funkfeldmessung
 
This script structures and analyses Radio Field Measurements taken with an R&S FPH or any other Device adhering to the same data structure in CSV exports.

# Philosophy of Measurements and Conversion of Exports into useful data structure

The CSV exports have to be sorted into measurement points by hand.

One instance of execution counts as one site of measurements. A site can have multiple floors and multiple buildings.

The measurements are split into points. One point represents a grouping of measurement activity in a singular location.

One Piece of Measurement Activity is called a snapshot. One snapshot contains multiple traces. Ususally, that will be a Clear/Write Trace, a Max Hold Trace etc.

A Trace is a collection of value pairs frequency - amplitude. We call these pairings "records"

The programm can be executed next to a folder "results".

Within this folder, you should create as many folders as you have points. The files for these points should be in these folders. The names of the points ( = the names of the foldes ) have to be nummerically sortable. Using 0,1,2,3,... as names for your Points is a good start, but you could also do 3333,3334,3335,3336 for examlple.

Within the folder of a point (/results/01/) only files that are named correctly are read. Three Letters, Four Numbers, dot csv.

ABC0001.csv works, ABCD0001.csv does not.

The exports have to be structured approximately like the R&S FPH does it: The data is represented in columns (boo!) with every "headline" containing the key "Name, Sweep (T1)" etc.
