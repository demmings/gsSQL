/*  *** DEBUG START ***
//  Remove comments for testing in NODE

export { TableData };
import { ScriptSettings } from "./ScriptSettings.js";
import { Table } from "./Table.js";
import { SpreadsheetApp, CacheService, LockService, Utilities } from "../GasMocks.js";

class Logger {
    static log(msg) {
        console.log(msg);
    }
}
//  *** DEBUG END ***/

/** 
 * Interface for loading table data either from CACHE or SHEET. 
 * @class
 * @classdesc
 * * Automatically load table data from a **CACHE** or **SHEET** <br>
 * * In all cases, if the cache has expired, the data is read from the sheet. 
 * <br>
 * 
 * | Cache Seconds | Description |
 * | ---           | ---         |
 * | 0             | Data is not cached and always read directly from SHEET |
 * | <= 21600      | Data read from SHEETS cache if it has not expired |
 * | > 21600       | Data read from Google Sheets Script Settings |
 * 
 */
class TableData {       //  skipcq: JS-0128
    /**
    * Retrieve table data from SHEET or CACHE.
    * @param {String} namedRange - Location of table data.  Either a) SHEET Name, b) Named Range, c) A1 sheet notation.
    * @param {Number} cacheSeconds - 0s Reads directly from sheet. > 21600s Sets in SCRIPT settings, else CacheService 
    * @returns {any[][]}
    */
    static loadTableData(namedRange, cacheSeconds = 0) {
        if (typeof namedRange === 'undefined' || namedRange === "")
            return [];

        Logger.log(`loadTableData: ${namedRange}. Seconds=${cacheSeconds}`);

        return  Table.removeEmptyRecordsAtEndOfTable(TableData.getValuesCached(namedRange, cacheSeconds));
    }

    /**
     * Reads a RANGE of values.
     * @param {String} namedRange 
     * @param {Number} seconds 
     * @returns {any[][]}
     */
    static getValuesCached(namedRange, seconds) {
        let cache = {};
        let cacheSeconds = seconds;

        if (cacheSeconds <= 0) {
            return TableData.loadValuesFromRangeOrSheet(namedRange);
        }
        else if (cacheSeconds > 21600) {
            cache = new ScriptSettings();
            if (TableData.isTimeToRunLongCacheExpiry()) {
                cache.expire(false);
                TableData.setLongCacheExpiry();
            }
            cacheSeconds = cacheSeconds / 86400;  //  ScriptSettings put() wants days to hold.
        }
        else {
            cache = CacheService.getScriptCache();
        }

        let arrData = TableData.cacheGetArray(cache, namedRange);
        if (arrData !== null) {
            Logger.log(`Found in CACHE: ${namedRange}. Items=${arrData.length}`);
            return arrData;
        }

        Logger.log(`Not in cache: ${namedRange}`);

        arrData = TableData.lockLoadAndCache(cache, namedRange, cacheSeconds);

        return arrData;
    }

    /**
     * Is it time to run the long term cache expiry check?
     * @returns {Boolean}
     */
    static isTimeToRunLongCacheExpiry() {
        const shortCache = CacheService.getScriptCache();
        return shortCache.get("LONG_CACHE_EXPIRY") === null;
    }

    /**
     * The long term expiry check is done every 21,000 seconds.  Set the clock now!
     */
    static setLongCacheExpiry() {
        const shortCache = CacheService.getScriptCache();
        shortCache.put("LONG_CACHE_EXPIRY", 'true', 21000);
    }

    /**
     * In the interest of testing, force the expiry check.
     * It does not mean items in cache will be removed - just 
     * forces a check.
     */
    static forceLongCacheExpiryCheck() {
        const shortCache = CacheService.getScriptCache();
        if (shortCache.get("LONG_CACHE_EXPIRY") !== null) {
            shortCache.remove("LONG_CACHE_EXPIRY");
        }
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
            cache.put(namedRange, JSON.stringify(singleData), seconds);
        }
        else {
            singleData = JSON.parse(singleData);
            const tempArr = [[singleData]];
            TableData.fixJSONdates(tempArr);
            singleData = tempArr[0][0];
        }

        return singleData;
    }

    /**
     * For updating a sheet VALUE that may be later read from cache.
     * @param {String} namedRange 
     * @param {any} singleData 
     * @param {Number} seconds 
     */
    static setValueCached(namedRange, singleData, seconds = 60) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        ss.getRangeByName(namedRange).setValue(singleData);
        let cache = null;

        if (seconds === 0) {
            return;
        }
        else if (seconds > 21600) {
            cache = new ScriptSettings();
        }
        else {
            cache = CacheService.getScriptCache();
        }
        cache.put(namedRange, JSON.stringify(singleData), seconds);
    }

    /**
     * 
     * @param {String} namedRange 
     * @param {any[][]} arrData 
     * @param {Number} seconds 
     */
    static setValuesCached(namedRange, arrData, seconds = 60) {
        const cache = CacheService.getScriptCache();

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        ss.getRangeByName(namedRange).setValues(arrData);
        cache.put(namedRange, JSON.stringify(arrData), seconds)
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

        Logger.log(`isRangeLoading: ${namedRange}. Status: ${loading}`);

        return loading;
    }

    /**
     * Retrieve data from cache after it has loaded elsewhere.
     * @param {Object} cache 
     * @param {String} namedRange 
     * @param {Number} cacheSeconds - How long to cache results.
     * @returns {any[][]}
     */
    static waitForRangeToLoad(cache, namedRange, cacheSeconds) {
        const start = new Date().getTime();
        let current = new Date().getTime();

        Logger.log(`waitForRangeToLoad() - Start: ${namedRange}`);
        while (TableData.isRangeLoading(cache, namedRange) && (current - start) < 10000) {
            Utilities.sleep(250);
            current = new Date().getTime();
        }
        Logger.log("waitForRangeToLoad() - End");

        let arrData = TableData.cacheGetArray(cache, namedRange);

        //  Give up and load from SHEETS directly.
        if (arrData === null) {
            Logger.log(`waitForRangeToLoad - give up.  Read directly. ${namedRange}`);
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
    static lockLoadAndCache(cache, namedRange, cacheSeconds) {
        //  Only change our CACHE STATUS if we have a lock.
        const lock = LockService.getScriptLock();
        try {
            lock.waitLock(100000); // wait 100 seconds for others' use of the code section and lock to stop and then proceed
        } catch (e) {
            throw new Error("Cache lock failed");
        }

        //  It is possible that just before getting the lock, another process started caching.
        if (TableData.isRangeLoading(cache, namedRange)) {
            lock.releaseLock();
            return TableData.waitForRangeToLoad(cache, namedRange, cacheSeconds);
        }

        //  Mark the status for this named range that loading is in progress.
        cache.put(TableData.cacheStatusName(namedRange), TABLE.LOADING, 15);
        lock.releaseLock();

        //  Load data from SHEETS.
        const arrData = TableData.loadValuesFromRangeOrSheet(namedRange);

        Logger.log(`Just LOADED from SHEET: ${arrData.length}`);

        TableData.cachePutArray(cache, namedRange, cacheSeconds, arrData);

        return arrData;
    }

    /**
     * Read sheet data into double array.
     * @param {String} namedRange - named range, A1 notation or sheet name
     * @returns {any[][]} - table data.
     */
    static loadValuesFromRangeOrSheet(namedRange) {
        let tableNamedRange = namedRange;
        let output = [];

        try {
            const sheetNamedRange = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(tableNamedRange);

            if (sheetNamedRange === null) {
                //  This may be a SHEET NAME, so try getting SHEET RANGE.
                if (tableNamedRange.startsWith("'") && tableNamedRange.endsWith("'")) {
                    tableNamedRange = tableNamedRange.substring(1, tableNamedRange.length - 1);
                }
                let sheetHandle = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tableNamedRange);

                //  Actual sheet may have spaces in name.  The SQL must reference that table with
                //  underscores replacing those spaces.
                if (sheetHandle === null && tableNamedRange.indexOf("_") !== -1) {
                    tableNamedRange = tableNamedRange.replace(/_/g, " ");
                    sheetHandle = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tableNamedRange);
                }

                if (sheetHandle === null) {
                    throw new Error(`Invalid table range specified:  ${tableNamedRange}`);
                }

                const lastColumn = sheetHandle.getLastColumn();
                const lastRow = sheetHandle.getLastRow();
                output = sheetHandle.getSheetValues(1, 1, lastRow, lastColumn);
            }
            else {
                // @ts-ignore
                output = sheetNamedRange.getValues();
            }
        }
        catch (ex) {
            throw new Error(`Error reading table data: ${tableNamedRange}`);
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
        let splitCount = (json.length / (100 * 1024)) * 1.3;    // 1.3 - assumes some blocks may be bigger.
        splitCount = splitCount < 1 ? 1 : splitCount;
        const arrayLength = Math.ceil(arrData.length / splitCount);
        const putObject = {};
        let blockCount = 0;
        let startIndex = 0;
        while (startIndex < arrData.length) {
            const arrayBlock = arrData.slice(startIndex, startIndex + arrayLength);
            blockCount++;
            startIndex += arrayLength;
            putObject[`${namedRange}:${blockCount.toString()}`] = JSON.stringify(arrayBlock);
        }

        //  Update status that cache is updated.
        const lock = LockService.getScriptLock();
        try {
            lock.waitLock(100000); // wait 100 seconds for others' use of the code section and lock to stop and then proceed
        } catch (e) {
            throw new Error("Cache lock failed");
        }
        cache.putAll(putObject, cacheSeconds);
        cache.put(cacheStatusName, TABLE.BLOCKS + blockCount.toString(), cacheSeconds);

        Logger.log(`Writing STATUS: ${cacheStatusName}. Value=${TABLE.BLOCKS}${blockCount.toString()}. seconds=${cacheSeconds}. Items=${arrData.length}`);

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
            Logger.log(`Named Range Cache Status not found = ${cacheStatusName}`);
            return null;
        }

        Logger.log(`Cache Status: ${cacheStatusName}. Value=${cacheStatus}`);
        if (cacheStatus === TABLE.LOADING) {
            return null;
        }

        const blockStr = cacheStatus.substring(cacheStatus.indexOf(TABLE.BLOCKS) + TABLE.BLOCKS.length);
        if (blockStr !== "") {
            const blocks = Number(blockStr);
            for (let i = 1; i <= blocks; i++) {
                const blockName = `${namedRange}:${i.toString()}`;
                const jsonData = cache.get(blockName);

                if (jsonData === null) {
                    Logger.log(`Named Range Part not found. R=${blockName}`);
                    return null;
                }

                const partArr = JSON.parse(jsonData);
                if (TableData.verifyCachedData(partArr)) {
                    arrData = arrData.concat(partArr);
                }
                else {
                    Logger.log(`Failed to verify named range: ${blockName}`);
                    return null;
                }
            }

        }
        Logger.log(`Just LOADED From CACHE: ${namedRange}. Items=${arrData.length}`);

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

