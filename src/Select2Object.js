/*  *** DEBUG START ***

//  Remove comments for testing in NODE
import { GasSql } from "./Sql.js";
export { Select2Object };

//  *** DEBUG END ***/

/**
 * @classdesc - Executes a SELECT statement on sheet data.  Returned data will be any array of objects,
 * where each item is one row of data.  The property values in the object are the column names.
 * The column names will be in lower case.  If more than one table is referenced, the column name will be:
 * "table.column", otherwise it will just be the column name.  Spaces in the column name use the underscore, so
 * something like "Transaction Date" would be referenced as "transaction_date".
 */
class Select2Object {           // skipcq: JS-0128
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
        for (const tab of this.tables) {
            parms.push(tab.tableName, tab.data);
        }

        //  Add column output indicator.
        parms.push(true);   //  We want column names returned.

        //  Add bind data.
        for (const bind of this.bindVariables) {
            parms.push(bind);
        }

        const tableDataArray = GasSql.execute(statement, parms);

        if (tableDataArray === null || tableDataArray.length === 0) {
            return null;
        }

        //  First item in return array is an array of column names.
        const columnNames = Select2Object.cleanupColumnNames(tableDataArray[0]);

        return Select2Object.createTableObjectArray(columnNames, tableDataArray);
    }

    /**
     * Return column names in lower case and remove table name when only one table.
     * @param {String[]} cols 
     * @returns {String[]}
     */
    static cleanupColumnNames(cols) {
        const newColumns = cols.map(v => v.toLowerCase());
        const noTableColumns = [];

        const uniqueTables = new Set();
        for (const col of newColumns) {
            const splitColumn = col.split(".");

            if (splitColumn.length > 1) {
                uniqueTables.add(splitColumn[0]);
                noTableColumns.push(splitColumn[1]);
            }
            else {
                noTableColumns.push(splitColumn[0]);
            }
        }

        //  Leave the table name in the column since we have two or more tables.
        if (uniqueTables.size > 1) {
            return newColumns;
        }

        return noTableColumns;
    }

    /**
     * First row MUST be column names.
     * @param {any[][]} tableDataArray 
     * @returns {Object[]}
     */
    static convertTableArrayToObjectArray(tableDataArray) {
        //  First item in return array is an array of column names.
        const propertyNames = Select2Object.convertColumnTitleToPropertyName(tableDataArray[0]);

        return Select2Object.createTableObjectArray(propertyNames, tableDataArray);
    }

    /**
     * 
     * @param {Object[]} objectArray 
     * @param {String[]} columnTitles 
     * @param {Boolean} outputTitleRow
     * @returns {any[][]}
     */
    static convertObjectArrayToTableArray(objectArray, columnTitles, outputTitleRow = true) {
        const propertyNames = Select2Object.convertColumnTitleToPropertyName(columnTitles);
        const tableArray = [];

        if (outputTitleRow)
            tableArray.push(columnTitles);

        for (const objectRow of objectArray) {
            const row = [];

            for (const prop of propertyNames) {
                row.push(objectRow[prop]);
            }

            tableArray.push(row);
        }

        return tableArray;
    }

    /**
     * 
     * @param {Object} object 
     * @param {String[]} columnTitles 
     * @returns {String[]}
     */
    static convertObjectToArray(object, columnTitles) {
        const propertyNames = Select2Object.convertColumnTitleToPropertyName(columnTitles);
        const row = [];
        for (const prop of propertyNames) {
            row.push(object[prop]);
        }

        return row;
    }

    /**
     * Convert a sheet column name into format used for property name (spaces to underscore && lowercase)
     * @param {String[]} columnTitles 
     * @returns {String[]}
     */
    static convertColumnTitleToPropertyName(columnTitles) {
        const columnNames = [...columnTitles];
        const srcColumns = columnNames.map(col => col.trim()).map(col => col.toLowerCase()).map(col => col.replaceAll(' ', '_'));

        return srcColumns;
    }

    /**
     * Get column number - starting at 1 in object.
     * @param {Object} object 
     * @param {String} columnTitle 
     * @returns {Number}
     */
    static getColumnNumber(object, columnTitle) {
        const prop = Select2Object.convertColumnTitleToPropertyName([columnTitle])[0];
        let col = 1;
        for (const propName in object) {        // skipcq: JS-0051
            if (propName === prop) {
                return col;
            }
            col++;
        }

        return -1;
    }

    /**
     * 
     * @param {String[]} columnNames 
     * @param {any[]} tableDataArray 
     * @returns {Object[]}
     */
    static createTableObjectArray(columnNames, tableDataArray) {
        //  Create empty table record object.
        const emptyTableRecord = Select2Object.createEmptyRecordObject(columnNames);

        //  Create table array with record data stored in an object.
        const tableData = [];
        for (let i = 1; i < tableDataArray.length; i++) {
            const newRecord = {};
            Object.assign(newRecord, emptyTableRecord);

            for (const [index, col] of columnNames.entries()) {
                newRecord[col] = tableDataArray[i][index];
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
    static createEmptyRecordObject(columnNames) {
        //  Create empty table record object.
        const dataObject = {};
        for (const col of columnNames) {
            dataObject[col] = '';
        }

        dataObject.get = function (columnTitle) {
            const prop = Select2Object.convertColumnTitleToPropertyName([columnTitle])[0];
            return this[prop];
        };

        dataObject.set = function (columnTitle, value) {
            const prop = Select2Object.convertColumnTitleToPropertyName([columnTitle])[0];
            this[prop] = value;
        }

        return dataObject;
    }
}