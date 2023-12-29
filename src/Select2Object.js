/*  *** DEBUG START ***

//  Remove comments for testing in NODE
import { GasSql } from "./Sql.js";
export { Select2Object };

class Logger {
    static log(msg) {
        console.log(msg);
    }
}
//  *** DEBUG END ***/

function testSel() {
    const mySql = new Select2Object();
    mySql.addTableData("master", "master_transactions");
    const tableData = mySql.execute("select * from master");
}

/**
 * @classdesc - Executes a SELECT statement on sheet data.  Returned data will be any array of objects,
 * where each item is one row of data.  The property values in the object are the column names.
 * The column names will be in lower case.  If more than one table is referenced, the column name will be:
 * "table.column", otherwise it will just be the column name.  Spaces in the column name use the underscore, so
 * something like "Transaction Date" would be referenced as "transaction_date".
 */
class Select2Object {
    constructor() {
        this.tables = [];
        this.bindVariables = [];
    }

    /**
     * 
     * @param {String} tableName - table name referenced in SELECT statement.
     * @param {*} data - double array or string.  If string it must reference A1 notation, named range or sheet name.
     * @returns {Select2Object}
     */
    addTableData(tableName, data) {
        const table = { tableName, data };
        this.tables.push(table);

        return this;
    }

    /**
     * If bind variables are used in SELECT statement, this are added here.
     * Ordering is important.  The first one added will be '?1' in the select, second is '?2' in select...
     * @param {any} bindVar 
     * @returns {Select2Object}
     */
    addBindVariable(bindVar) {
        this.bindVariables.push(bindVar);

        return this;
    }

    /**
     * Query any sheet range using standard SQL SELECT syntax and return array of table info with column names as properties.
     * @example
     * gsSQL("select * from expenses where type = ?1")
     * 
     * @param {String} statement - SQL string 
     * @returns {Object[]} - array of object data.  
     */
    execute(statement) {     //  skipcq: JS-0128
        const parms = [];

        //  Add the table name and range.
        for (let tab of this.tables) {
            parms.push(tab.tableName);
            parms.push(tab.data);
        }

        //  Add column output indicator.
        parms.push(true);   //  We want column names returned.

        //  Add bind data.
        for (let bind of this.bindVariables) {
            parms.push(bind);
        }

        const tableDataArray = GasSql.execute(statement, parms);

        if (tableDataArray === null || tableDataArray.length === 0) {
            return null;
        }

        //  First item in return array is an array of column names.
        const columnNames = this.cleanupColumnNames(tableDataArray[0]);

        return this.createTableObjectArray(columnNames, tableDataArray);
    }

    /**
     * Return column names in lower case and remove table name when only one table.
     * @param {String[]} cols 
     * @returns {String[]}
     */
    cleanupColumnNames(cols) {
        const newColumns = cols.map(v => v.toLowerCase());
        const noTableColumns = [];

        const uniqueTables = new Set();
        for (let col of newColumns) {
            let splitColumn = col.split(".");

            if (splitColumn.length > 1) {
                uniqueTables.add(splitColumn[0]);
                noTableColumns.push(splitColumn[1]);
            }
            else {
                noTableColumns.push(splitColumn[0]);
            }
        }

        //  Leave the table name in the column since we have two or more tables.
        if (uniqueTables.size > 1)
            return newColumns;

        return noTableColumns;
    }

    /**
     * 
     * @param {String[]} columnNames 
     * @param {any[]} tableDataArray 
     * @returns {Object[]}
     */
    createTableObjectArray(columnNames, tableDataArray) {
        //  Create empty table record object.
        const emptyTableRecord = this.createEmptyRecordObject(columnNames);

        //  Create table array with record data stored in an object.
        const tableData = [];
        for (let i = 1; i < tableDataArray.length; i++) {
            const newRecord = {};
            Object.assign(newRecord, emptyTableRecord);

            for (let j = 0; j < columnNames.length; j++) {
                newRecord[columnNames[j]] = tableDataArray[i][j];
            }

            tableData.push(newRecord);
        }

        return tableData;
    }

    /**
     * Creates an empty object where each column name is a property in the object.
     * @param {String[]} columnNames 
     * @returns {Object}
     */
    createEmptyRecordObject(columnNames) {
        //  Create empty table record object.
        const dataObject = {};
        for (let col of columnNames) {
            dataObject[col] = '';
        }

        return dataObject;
    }
}