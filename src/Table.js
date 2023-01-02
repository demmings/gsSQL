//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { Table, Schema };
import { DERIVEDTABLE, VirtualFields, VirtualField } from './Views.js';
import { TableData } from './TableData.js';

class Logger {
    static log(msg) {
        console.log(msg);
    }
}

//  *** DEBUG END  ***/

//  skipcq: JS-0128
class Table {
    /**
     * 
     * @param {String} tableName 
     */
    constructor(tableName) {
        this.tableName = tableName.toUpperCase();
        this.tableData = [];
        this.indexes = new Map();
        this.hasColumnTitle = true;
        /** @type {Schema} */
        this.schema = new Schema()
            .setTableName(tableName)
            .setTable(this);
    }

    /**
     * 
     * @param {String} tableAlias 
     * @returns {Table}
     */
    setTableAlias(tableAlias) {
        this.schema.setTableAlias(tableAlias);
        return this;
    }

    /**
     * 
     * @param {Boolean} hasTitle 
     * @returns {Table}
     */
    setHasColumnTitle(hasTitle) {
        this.hasColumnTitle = hasTitle;

        return this;
    }

    /**
     * Load sheets named range of data into table.
     * @param {String} namedRange 
     * @param {Number} cacheSeconds
     * @returns {Table}
     */
    loadNamedRangeData(namedRange, cacheSeconds = 0) {
        this.tableData = TableData.loadTableData(namedRange, cacheSeconds);

        if (!this.hasColumnTitle) {
            this.addColumnLetters(this.tableData);
        }

        Logger.log(`Load Data: Range=${namedRange}. Items=${this.tableData.length}`);
        this.loadSchema();

        return this;
    }

    /**
     * 
     * @param {any[]} tableData - Loaded table data with first row titles included.
     * @returns {Table}
     */
    loadArrayData(tableData) {
        if (typeof tableData === 'undefined' || tableData.length === 0)
            return this;

        if (!this.hasColumnTitle) {
            this.addColumnLetters(tableData);
        }

        this.tableData = tableData;
        this.loadSchema();

        return this;
    }

    /**
     * 
     * @param {any[][]} tableData 
     * @returns {any[][]}
     */
    addColumnLetters(tableData) {
        if (tableData.length === 0)
            return [[]];

        const newTitleRow = [];

        for (let i = 1; i <= tableData[0].length; i++) {
            newTitleRow.push(this.numberToSheetColumnLetter(i));
        }
        tableData.unshift(newTitleRow);

        return tableData;
    }

    /**
     * 
     * @param {Number} number 
     * @returns {String}
     */
    numberToSheetColumnLetter(number) {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        let result = ""

        let charIndex = number % alphabet.length
        let quotient = number / alphabet.length
        if (charIndex - 1 === -1) {
            charIndex = alphabet.length
            quotient--;
        }
        result = alphabet.charAt(charIndex - 1) + result;
        if (quotient >= 1) {
            result = this.numberToSheetColumnLetter(quotient) + result;
        }

        return result;
    }

    /**
     * 
     * @returns {Table}
     */
    loadSchema() {
        this.schema
            .setTableData(this.tableData)
            .load();

        return this;
    }

    /**
     * 
     * @param {String} fieldName 
     * @returns {Number}
     */
    getFieldColumn(fieldName) {
        return this.schema.getFieldColumn(fieldName);
    }

    /**
    * Get field column index (starts at 0) for field names.
    * @param {String[]} fieldNames 
    * @returns {Number[]}
    */
    getFieldColumns(fieldNames) {
        return this.schema.getFieldColumns(fieldNames);
    }

    /**
     * 
     * @returns {VirtualField[]}
     */
    getAllVirtualFields() {
        return this.schema.getAllVirtualFields();
    }

    /**
     * 
     * @returns {String[]}
     */
    getAllFieldNames() {
        return this.schema.getAllFieldNames();
    }

    /**
     * 
     * @returns {String[]}
     */
    getAllExtendedNotationFieldNames() {
        return this.schema.getAllExtendedNotationFieldNames();
    }

    /**
     * 
     * @returns {Number}
     */
    getColumnCount() {
        const fields = this.getAllExtendedNotationFieldNames();
        return fields.length;
    }

    /**
     * Return range of records from table.
     * @param {Number} startRecord - 1 is first record
     * @param {Number} lastRecord - -1 for all. Last = RecordCount().    
     * @param {Number[]} fields 
     * @returns {any[][]}
     */
    getRecords(startRecord, lastRecord, fields) {
        const selectedRecords = [];

        let minStartRecord = startRecord;
        if (minStartRecord < 1) {
            minStartRecord = 1;
        }

        let maxLastRecord = lastRecord;
        if (maxLastRecord < 0) {
            maxLastRecord = this.tableData.length - 1;
        }

        for (let i = minStartRecord; i <= maxLastRecord && i < this.tableData.length; i++) {
            const row = [];

            for (const col of fields) {
                row.push(this.tableData[i][col]);
            }

            selectedRecords.push(row);
        }

        return selectedRecords;
    }

    /**
     * 
     * @param {String} fieldName 
     * @returns 
     */
    addIndex(fieldName) {
        const indexedFieldName = fieldName.trim().toUpperCase();
        const fieldValuesMap = new Map();

        const fieldIndex = this.schema.getFieldColumn(indexedFieldName);
        for (let i = 1; i < this.tableData.length; i++) {
            const value = this.tableData[i][fieldIndex];

            if (value !== "") {
                let rowNumbers = [];
                if (fieldValuesMap.has(value))
                    rowNumbers = fieldValuesMap.get(value);

                rowNumbers.push(i);
                fieldValuesMap.set(value, rowNumbers);
            }
        }

        this.indexes.set(indexedFieldName, fieldValuesMap);
    }

    /**
     * Return all row ID's where FIELD = SEARCH VALUE.
     * @param {String} fieldName 
     * @param {any} searchValue 
     * @returns {Number[]}
     */
    search(fieldName, searchValue) {
        const rows = [];
        const searchName = fieldName.trim().toUpperCase();

        const searchFieldCol = this.schema.getFieldColumn(searchName);
        if (searchFieldCol === -1)
            return rows;

        const fieldValuesMap = this.indexes.get(searchName);
        if (fieldValuesMap.has(searchValue))
            return fieldValuesMap.get(searchValue);
        return rows;
    }

    /**
     * 
     * @param {Table} concatTable 
     */
    concat(concatTable) {
        const fieldsThisTable = this.schema.getAllFieldNames();
        const fieldColumns = concatTable.getFieldColumns(fieldsThisTable);
        const data = concatTable.getRecords(1, -1, fieldColumns);
        this.tableData = this.tableData.concat(data);
    }

}

class Schema {
    constructor() {
        this.tableName = "";
        this.tableAlias = "";
        this.tableData = [];
        this.tableInfo = null;
        this.isDerivedTable = this.tableName === DERIVEDTABLE;

        /** @type {Map<String,Number>} */
        this.fields = new Map();
        /** @type {VirtualFields} */
        this.virtualFields = new VirtualFields();
    }

    /**
     * 
     * @param {String} tableName 
     * @returns {Schema}
     */
    setTableName(tableName) {
        this.tableName = tableName.toUpperCase();
        return this;
    }

    /**
     * 
     * @param {String} tableAlias 
     * @returns {Schema}  
     */
    setTableAlias(tableAlias) {
        this.tableAlias = tableAlias.toUpperCase();
        return this;
    }

    /**
     * 
     * @param {any[][]} tableData 
     * @returns {Schema}
     */
    setTableData(tableData) {
        this.tableData = tableData;
        return this;
    }

    /**
     * 
     * @param {Table} tableInfo 
     * @returns {Schema}
     */
    setTable(tableInfo) {
        this.tableInfo = tableInfo;
        return this;
    }

    /**
     * 
     * @returns {String[]}
     */
    getAllFieldNames() {
        /** @type {String[]} */
        const fieldNames = [];

        // @ts-ignore
        for (const key of this.fields.keys()) {
            if (key !== "*")
                fieldNames.push(key);
        }

        return fieldNames;
    }

    /**
     * All table fields names with 'TABLE.field_name'.
     * @returns {String[]}
     */
    getAllExtendedNotationFieldNames() {
        /** @type {String[]} */
        const fieldNames = [];

        // @ts-ignore
        for (const [key, value] of this.fields.entries()) {
            if (value !== null) {
                const fieldParts = key.split(".");
                if (typeof fieldNames[value] === 'undefined' ||
                    (fieldParts.length === 2 && (fieldParts[0] === this.tableName || this.isDerivedTable)))
                    fieldNames[value] = key;
            }
        }

        return fieldNames;
    }

    /**
     * 
     * @returns {VirtualField[]}
     */
    getAllVirtualFields() {
        return this.virtualFields.getAllVirtualFields();
    }

    /**
     * 
     * @param {String} field 
     * @returns {Number}
     */
    getFieldColumn(field) {
        const cols = this.getFieldColumns([field]);
        return cols[0];
    }

    /**
    * Get field column index (starts at 0) for field names.
    * @param {String[]} fieldNames 
    * @returns {Number[]}
    */
    getFieldColumns(fieldNames) {
        /** @type {Number[]} */
        const fieldIndex = [];

        for (const field of fieldNames) {
            let i = -1;

            if (this.fields.has(field.trim().toUpperCase()))
                i = this.fields.get(field.trim().toUpperCase());

            fieldIndex.push(i);
        }

        return fieldIndex;
    }

    /**
     * The field name is found in TITLE row of sheet.  These column titles
     * are TRIMMED, UPPERCASE and SPACES removed (made to UNDERSCORE).
     * SQL statements MUST reference fields with spaces converted to underscore.
     * @returns {Schema}
     */
    load() {
        this.fields = new Map();
        this.virtualFields = new VirtualFields();

        if (this.tableData.length === 0)
            return this;

        /** @type {any[]} */
        const titleRow = this.tableData[0];

        let colNum = 0;
        let fieldVariants = [];
        for (const baseColumnName of titleRow) {
            //  Find possible variations of the field column name.
            try {
                fieldVariants = this.getColumnNameVariants(baseColumnName);
            }
            catch (ex) {
                throw new Error(`Invalid column title: ${baseColumnName}`);
            }
            const columnName = fieldVariants[0];

            this.setFieldVariantsColumNumber(fieldVariants, colNum);

            if (columnName !== "") {
                const virtualField = new VirtualField(columnName, this.tableInfo, colNum);
                this.virtualFields.add(virtualField, true);
            }

            colNum++;
        }

        //  Add special field for every table.
        //  The asterisk represents ALL fields in table.
        this.fields.set("*", null);

        return this;
    }

    /**
     * 
     * @param {String} colName 
     * @returns {any[]}
     */
    getColumnNameVariants(colName) {
        const columnName = colName.trim().toUpperCase().replace(/\s/g, "_");
        let fullColumnName = columnName;
        let fullColumnAliasName = "";
        if (columnName.indexOf(".") === -1) {
            fullColumnName = `${this.tableName}.${columnName}`;
            if (this.tableAlias !== "")
                fullColumnAliasName = `${this.tableAlias}.${columnName}`;
        }

        return [columnName, fullColumnName, fullColumnAliasName];
    }

    /**
     * 
     * @param {any[]} fieldVariants 
     * @param {Number} colNum 
     */
    setFieldVariantsColumNumber(fieldVariants, colNum) {
        const [columnName, fullColumnName, fullColumnAliasName] = fieldVariants;

        if (columnName !== "") {
            this.fields.set(columnName, colNum);

            if (!this.isDerivedTable) {
                this.fields.set(fullColumnName, colNum);

                if (fullColumnAliasName !== "") {
                    this.fields.set(fullColumnAliasName, colNum);
                }
            }
        }
    }
}