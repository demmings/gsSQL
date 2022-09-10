//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { TableData };
import { Sql } from './Sql.js';

class Logger {
    static log(msg) {
        console.log(msg);
    }
}
//  *** DEBUG END  ***/

function testTableData() {
    const table = new TableData();

    const itemData = new Sql()
        .addTableData('mastertransactions', 'Master Transactions!$A$1:$I', 60)
        .enableColumnTitle(true)
        .addBindNamedRangeParameter('startIncomeDate')
        .addBindNamedRangeParameter('endIncomeDate')
        .execute("select transaction_date as 'Transaction Date', sum(gross) as Gross, sum(amount) as Net " +
            "from mastertransactions " +
            "where transaction_date >=  ? and transaction_date <= ? ");
    Logger.log(itemData);

    let trans = table.loadTableData('Master Transactions!$A$1:$I', 60);
    Logger.log(trans);
    trans = table.loadTableData('Master Transactions!$A$1:$I', 60);
    Logger.log(trans);

    let arrData = table.loadTableData('accountNamesData', 60);
    Logger.log(arrData);
    arrData = table.loadTableData('accountNamesData', 60);
    Logger.log(arrData);
}

class TableData {
    /**
    * Retrieve table data from SHEET or CACHE.
    * @param {String} namedRange 
    * @param {Number} cacheSeconds - 0s Reads directly from sheet. > 21600s Sets in SCRIPT settings, else CacheService 
    * @returns {any[][]}
    */
    loadTableData(namedRange, cacheSeconds = 0) {
        if (typeof namedRange === 'undefined' || namedRange === "")
            return [];

        Logger.log("loadTableData: " + namedRange + ". Seconds=" + cacheSeconds);

        let tempData = this.getValuesCached(namedRange, cacheSeconds)

        tempData = tempData.filter(e => e.join().replace(/,/g, "").length);

        return tempData;
    }

    /**
     * Reads a RANGE of values.
     * @param {String} namedRange 
     * @param {Number} seconds 
     * @returns {any[][]}
     */
    getValuesCached(namedRange, seconds) {
        let cache;
        let arrData;

        if (seconds <= 0) {
            return TableData.loadValuesFromRangeOrSheet(namedRange);
        }
        else if (seconds > 21600) {
            cache = new ScriptSettings();
            seconds = seconds / 86400;  //  ScriptSettings put() wants days to hold.
        }
        else {
            cache = CacheService.getScriptCache();
        }

        arrData = TableData.cacheGetArray(cache, namedRange);
        if (arrData !== null) {
            Logger.log("Found in CACHE: " + namedRange + ". Items=" + arrData.length);
            return arrData;
        }

        Logger.log("Not in cache: " + namedRange);

        if (TableData.isRangeLoading(cache, namedRange)) {
            //  Just wait until data loaded elsewhere.
            arrData = this.waitForRangeToLoad(cache, namedRange, seconds);
        }
        else {
            arrData = this.lockLoadAndCache(cache, namedRange, seconds);
        }

        return arrData;
    }

    /**
     * Reads a single cell.
     * @param {String} namedRange 
     * @param {Number} seconds 
     * @returns {any}
     */
    static getValueCached(namedRange, seconds = 60) {
        const cache = CacheService.getScriptCache();

        let singleData = cache.get(namedRange);

        if (singleData === null) {
            const ss = SpreadsheetApp.getActiveSpreadsheet();
            singleData = ss.getRangeByName(namedRange).getValue();
            cache.put(namedRange, singleData, seconds)
        }

        return singleData;
    }

    /**
     * Check if data from cache is in error.
     * @param {any[][]} arrData 
     * @returns {Boolean}
     */
    static verifyCachedData(arrData) {
        let verified = true;

        for (const rowData of arrData) {
            for (const fieldData of rowData) {
                if (fieldData === "#ERROR!") {
                    Logger.log("Reading from CACHE has found '#ERROR!'.  Re-Loading...");
                    verified = false;
                    break;
                }
            }
        }

        return verified;
    }

    /**
     * Checks if this range is loading elsewhere (i.e. from another call to custom function)
     * @param {String} namedRange
     * @returns {Boolean} 
     */
    static isRangeLoading(cache, namedRange) {
        let loading = false;
        const cacheData = cache.get(TableData.cacheStatusName(namedRange));

        if (cacheData !== null && cacheData === TABLE.LOADING) {
            loading = true;
        }

        Logger.log("isRangeLoading: " + namedRange + ". Status: " + loading);

        return loading;
    }

    /**
     * Retrieve data from cache after it has loaded elsewhere.
     * @param {Object} cache 
     * @param {String} namedRange 
     * @param {Number} cacheSeconds - How long to cache results.
     * @returns {any[][]}
     */
    waitForRangeToLoad(cache, namedRange, cacheSeconds) {
        const start = new Date().getTime();
        let current = new Date().getTime();

        Logger.log("waitForRangeToLoad() - Start: " + namedRange);
        while (TableData.isRangeLoading(cache, namedRange) && (current - start) < 10000) {
            Utilities.sleep(250);
            current = new Date().getTime();
        }
        Logger.log("waitForRangeToLoad() - End");

        let arrData = TableData.cacheGetArray(cache, namedRange);

        //  Give up and load from SHEETS directly.
        if (arrData === null) {
            Logger.log("waitForRangeToLoad - give up.  Read directly. " + namedRange);
            arrData = TableData.loadValuesFromRangeOrSheet(namedRange);

            if (TableData.isRangeLoading(cache, namedRange)) {
                //  Other process probably timed out and left status hanging.
                TableData.cachePutArray(cache, namedRange, cacheSeconds, arrData);
            }
        }

        return arrData;
    }

    /**
     * Read range of value from sheet and cache.
     * @param {Object} cache - cache object can vary depending where the data is stored.
     * @param {String} namedRange 
     * @param {Number} cacheSeconds 
     * @returns {any[][]} - data from range
     */
    lockLoadAndCache(cache, namedRange, cacheSeconds) {
        //  Data is now loaded in cache.
        let arrData = TableData.cacheGetArray(cache, namedRange);
        if (arrData !== null) {
            return arrData;
        }

        //  The status indicates this named range is being loaded in another process.
        if (TableData.isRangeLoading(cache, namedRange)) {
            return this.waitForRangeToLoad(cache, namedRange, cacheSeconds);
        }

        //  Only change our CACHE STATUS if we have a lock.
        const lock = LockService.getScriptLock();
        try {
            lock.waitLock(10000); // wait 10 seconds for others' use of the code section and lock to stop and then proceed
        } catch (e) {
            throw new Error("Cache lock failed");
        }

        //  It is possible that just before getting the lock, another process started caching.
        if (TableData.isRangeLoading(cache, namedRange)) {
            lock.releaseLock();
            return this.waitForRangeToLoad(cache, namedRange, cacheSeconds);
        }

        //  Mark the status for this named range that loading is in progress.
        cache.put(TableData.cacheStatusName(namedRange), TABLE.LOADING, 15);
        lock.releaseLock();

        //  Load data from SHEETS.
        arrData = TableData.loadValuesFromRangeOrSheet(namedRange);

        Logger.log("Just LOADED from SHEET: " + arrData.length);

        TableData.cachePutArray(cache, namedRange, cacheSeconds, arrData);

        return arrData;
    }

    /**
     * 
     * @param {String} namedRange 
     * @returns {any[]}
     */
    static loadValuesFromRangeOrSheet(namedRange) {
        let output = [];

        try {
            const sheetNamedRange = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(namedRange);

            if (sheetNamedRange === null) {
                //  This may be a SHEET NAME, so try getting SHEET RANGE.
                if (namedRange.startsWith("'") && namedRange.endsWith("'")) {
                    namedRange = namedRange.substring(1, namedRange.length-1);
                }
                const sheetHandle = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(namedRange);
                if (sheetHandle === null)
                    throw new Error("Invalid table range specified:  " + namedRange);

                const lastColumn = sheetHandle.getLastColumn();
                const lastRow = sheetHandle.getLastRow();
                output = sheetHandle.getSheetValues(1, 1, lastRow, lastColumn);
            }
            else {
                output = sheetNamedRange.getValues();
            }
        }
        catch (ex) {
            throw new Error("Error reading table data: " + namedRange);
        }

        return output;
    }

    /**
     * Takes array data to be cached, breaks up into chunks if necessary, puts each chunk into cache and updates status.
     * @param {Object} cache 
     * @param {String} namedRange 
     * @param {Number} cacheSeconds 
     * @param {any[][]} arrData 
     */
    static cachePutArray(cache, namedRange, cacheSeconds, arrData) {
        const cacheStatusName = TableData.cacheStatusName(namedRange);
        const json = JSON.stringify(arrData);

        //  Split up data (for re-assembly on get() later)
        let splitCount = (json.length / (100 * 1024)) * 1.2;    // 1.2 - assumes some blocks may be bigger.
        splitCount = splitCount < 1 ? 1 : splitCount;
        const arrayLength = Math.round(arrData.length / splitCount);
        const putObject = {};
        let blockCount = 0;
        let startIndex = 0;
        while (startIndex < arrData.length) {
            const arrayBlock = arrData.slice(startIndex, startIndex + arrayLength);
            blockCount++;
            startIndex += arrayLength;
            putObject[namedRange + ":" + blockCount.toString()] = JSON.stringify(arrayBlock);
        }

        //  Update status that cache is updated.
        const lock = LockService.getScriptLock();
        try {
            lock.waitLock(10000); // wait 10 seconds for others' use of the code section and lock to stop and then proceed
        } catch (e) {
            throw new Error("Cache lock failed");
        }
        cache.putAll(putObject, cacheSeconds);
        cache.put(cacheStatusName, TABLE.BLOCKS + blockCount.toString(), cacheSeconds);

        Logger.log("Writing STATUS: " + cacheStatusName + ". Value=" + TABLE.BLOCKS + blockCount.toString() + ". seconds=" + cacheSeconds + ". Items=" + arrData.length);

        lock.releaseLock();
    }

    /**
     * Reads cache for range, and re-assembles blocks into return array of data.
     * @param {Object} cache 
     * @param {String} namedRange 
     * @returns {any[][]}
     */
    static cacheGetArray(cache, namedRange) {
        let arrData = [];

        const cacheStatusName = TableData.cacheStatusName(namedRange);
        const cacheStatus = cache.get(cacheStatusName);
        if (cacheStatus === null) {
            Logger.log("Named Range Cache Status not found = " + cacheStatusName);
            return null;
        }
        else {
            Logger.log("Cache Status: " + cacheStatusName + ". Value=" + cacheStatus);
            if (cacheStatus === TABLE.LOADING)
                return null;
        }

        const blockStr = cacheStatus.substring(cacheStatus.indexOf(TABLE.BLOCKS) + TABLE.BLOCKS.length);
        if (blockStr !== "") {
            const blocks = parseInt(blockStr);
            for (let i = 1; i <= blocks; i++) {
                const blockName = namedRange + ":" + i.toString();
                const jsonData = cache.get(blockName);

                if (jsonData === null) {
                    Logger.log("Named Range Part not found. R=" + blockName);
                    return null;
                }

                const partArr = JSON.parse(jsonData);
                if (TableData.verifyCachedData(partArr)) {
                    arrData = arrData.concat(partArr);
                }
                else {
                    Logger.log("Failed to verify named range: " + blockName);
                    return null;
                }
            }

        }
        Logger.log("Just LOADED From CACHE: " + namedRange + ". Items=" + arrData.length);

        //  The conversion to JSON causes SHEET DATES to be converted to a string.
        //  This converts any DATE STRINGS back to javascript date.
        TableData.fixJSONdates(arrData);

        return arrData;
    }

    /**
     * 
     * @param {any[][]} arrData 
     */
    static fixJSONdates(arrData) {
        const ISO_8601_FULL = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(([+-]\d\d:\d\d)|Z)?$/i

        for (const row of arrData) {
            for (let i = 0; i < row.length; i++) {
                const testStr = row[i];
                if (ISO_8601_FULL.test(testStr)) {
                    row[i] = new Date(testStr);
                }
            }
        }
    }

    /**
     * 
     * @param {String} namedRange 
     * @returns {String}
     */
    static cacheStatusName(namedRange) {
        return namedRange + TABLE.STATUS;
    }
}

const TABLE = {
    STATUS: "__STATUS__",
    LOADING: "LOADING",
    BLOCKS: "BLOCKS="
}


function testMyScriptsettings() {
    const testSettings = new ScriptSettings();

    testSettings.put("abcKEY", 123.45, 7);
    testSettings.put("defKEY", 234.56, 6);
    testSettings.put("ghiKEY", 345.67, 5);
    testSettings.put("jklKEY", 456.78, -1);

    let temp = testSettings.get("garbage");
    Logger.log(temp);
    temp = testSettings.get("abcKEY");
    Logger.log(temp);
    temp = testSettings.get("defKEY");
    Logger.log(temp);
    temp = testSettings.get("ghiKEY");
    Logger.log(temp);
    temp = testSettings.get("jklKEY");
    Logger.log(temp);
}

class ScriptSettings {
    /**
     * For storing cache data for very long periods of time.
     */
    constructor() {
        this.scriptProperties = PropertiesService.getScriptProperties();
    }

    /**
     * Get script property using key.  If not found, returns null.
     * @param {String} propertyKey 
     * @returns {any}
     */
    get(propertyKey) {
        const myData = this.scriptProperties.getProperty(propertyKey);

        if (myData === null)
            return null;

        /** @type {PropertyData} */
        const myPropertyData = JSON.parse(myData);

        return PropertyData.getData(myPropertyData);
    }

    /**
     * Put data into our PROPERTY cache, which can be held for long periods of time.
     * @param {String} propertyKey - key to finding property data.
     * @param {any} propertyData - value.  Any object can be saved..
     * @param {Number} daysToHold - number of days to hold before item is expired.
     */
    put(propertyKey, propertyData, daysToHold = 1) {
        //  Create our object with an expiry time.
        const objData = new PropertyData(propertyData, daysToHold);

        //  Our property needs to be a string
        const jsonData = JSON.stringify(objData);

        this.scriptProperties.setProperty(propertyKey, jsonData);
    }

    /**
     * 
     * @param {Object} propertyDataObject 
     * @param {Number} daysToHold 
     */
    putAll(propertyDataObject, daysToHold = 1) {
        const keys = Object.keys(propertyDataObject);

        for (const key of keys) {
            this.put(key, propertyDataObject[key], daysToHold);
        }
    }

    /**
     * Removes script settings that have expired.
     * @param {Boolean} deleteAll - true - removes ALL script settings regardless of expiry time.
     */
    expire(deleteAll) {
        const allKeys = this.scriptProperties.getKeys();

        for (const key of allKeys) {
            const myData = this.scriptProperties.getProperty(key);

            if (myData !==null) {
                let propertyValue = null;
                try {
                    propertyValue = JSON.parse(myData);
                }
                catch (e) {
                    Logger.log("Script property data is not JSON. key=" + key);
                }

                if (propertyValue !== null && (PropertyData.isExpired(propertyValue) || deleteAll)) {
                    this.scriptProperties.deleteProperty(key);
                    Logger.log("Removing expired SCRIPT PROPERTY: key=" + key);
                }
            }
        }
    }
}

class PropertyData {
    /**
     * 
     * @param {any} propertyData 
     * @param {Number} daysToHold 
     */
    constructor(propertyData, daysToHold) {
        const someDate = new Date();

        /** @property {String} */
        this.myData = JSON.stringify(propertyData);
        /** @property {Date} */
        this.expiry = someDate.setDate(someDate.getDate() + daysToHold);
    }

    /**
     * 
     * @param {PropertyData} obj 
     * @returns 
     */
    static getData(obj) {
        let value = null;
        try {
            if (!PropertyData.isExpired(obj))
                value = JSON.parse(obj.myData);
        }
        catch (ex) {
            Logger.log("Invalid property value.  Not JSON: " + ex.toString());
        }

        return value;
    }

    /**
     * 
     * @param {PropertyData} obj 
     * @returns 
     */
    static isExpired(obj) {
        const someDate = new Date();
        const expiryDate = new Date(obj.expiry);
        return (expiryDate.getTime() < someDate.getTime())
    }
}