/*  *** DEBUG START ***
//  Remove comments for testing in NODE

export { Table, Schema };
import { DERIVEDTABLE, VirtualFields, VirtualField, CalculatedField } from './Views.js';
import { TableData } from './TableData.js';

class Logger {
    static log(msg) {
        console.log(msg);
    }
}

//  *** DEBUG END ***/

/** 
 * @classdesc 
 * Data and methods for each (logical) SQL table. 
 */
class Table {       //  skipcq: JS-0128
    /**
     * 
     * @param {String} tableName - name of sql table.
     */
    constructor(tableName) {
        /** @property {String} - table name. */
        this.tableName = tableName.toUpperCase();

        /** @property {any[][]} - table data. */
        this.tableData = [];

        /** @property {Map<String, Map<String,Number[]>>} - table indexes*/
        this.indexes = new Map();

        /** @property {Boolean} */
        this.hasColumnTitle = true;

        /** @property {Schema} */
        this.schema = new Schema()
            .setTableName(tableName)
            .setTable(this);
    }

    /**
     * Set associated table alias name to object.
     * @param {String} tableAlias - table alias that may be used to prefix column names.
     * @returns {Table}
     */
    setTableAlias(tableAlias) {
        this.schema.setTableAlias(tableAlias);
        return this;
    }

    /**
     * Indicate if data contains a column title row.
     * @param {Boolean} hasTitle 
     * * true - first row of data will contain unique column names
     * * false - first row of data will contain data.  Column names are then referenced as letters (A, B, ...)
     * @returns {Table}
     */
    setHasColumnTitle(hasTitle) {
        this.hasColumnTitle = hasTitle;

        return this;
    }

    /**
     * Load sheets named range of data into table.
     * @param {String} namedRange - defines where data is located in sheets.
     * * sheet name - reads entire sheet from top left corner.
     * * named range - reads named range for data.
     * * A1 notation - range of data using normal sheets notation like 'A1:C10'.  This may also include the sheet name like 'stocks!A1:C100'.
     * @param {Number} cacheSeconds - How many seconds to cache data so we don't need to make time consuming
     * getValues() from sheets.  
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
     * Read table data from a double array rather than from sheets.
     * @param {any[]} tableData - Loaded table data with first row titles included.
     * @returns {Table}
     */
    loadArrayData(tableData) {
        if (typeof tableData === 'undefined' || tableData.length === 0)
            return this;

        if (!this.hasColumnTitle) {
            this.addColumnLetters(tableData);
        }

        this.tableData = Table.removeEmptyRecordsAtEndOfTable(tableData);

        this.loadSchema();

        return this;
    }

    /**
     * It is common to have extra empty records loaded at end of table.
     * Remove those empty records at END of table only.
     * @param {any[][]} tableData 
     * @returns {any[][]}
     */
    static removeEmptyRecordsAtEndOfTable(tableData) {
        let blankLines = 0;
        for (let i = tableData.length - 1; i > 0; i--) {
            if (tableData[i].join().replace(/,/g, "").length > 0)
                break;
            blankLines++;
        }

        return tableData.slice(0, tableData.length - blankLines);
    }

    /**
     * Internal function for updating the loaded data to include column names using letters, starting from 'A', 'B',...
     * @param {any[][]} tableData - table data that does not currently contain a first row with column names.
     * @returns {any[][]} - updated table data that includes a column title row.
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
     * Find the sheet column letter name based on position.  
     * @param {Number} number - Returns the sheets column name.  
     * 1 = 'A'
     * 2 = 'B'
     * 26 = 'Z'
     * 27 = 'AA'
     * @returns {String} - the column letter.
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
     * Read loaded table data and updates internal list of column information
     * @returns {Table}
     */
    loadSchema() {
        this.schema
            .setTableData(this.tableData)
            .load();

        return this;
    }

    /**
     * Find column number using the field name.
     * @param {String} fieldName - Valid field name.
     * @returns {Number} - column offset number starting at zero.
     */
    getFieldColumn(fieldName) {
        return this.schema.getFieldColumn(fieldName);
    }

    /**
    * Get field column index (starts at 0) for field names.
    * @param {String[]} fieldNames - list of valid field names.
    * @returns {Number[]} - list of column offsets, starting at zero corresponding to the input list of names.
    */
    getFieldColumns(fieldNames) {
        return this.schema.getFieldColumns(fieldNames);
    }

    /**
     * Find all field data for this table (or the derived table)
     * @returns {VirtualField[]} - field column information list
     */
    getAllVirtualFields() {
        return this.schema.getAllVirtualFields();
    }

    /**
     * Returns a list of all possible field names that could be used in the SELECT.
     * @returns {String[]} - List of field names.
     */
    getAllFieldNames() {
        return this.schema.getAllFieldNames();
    }

    /**
     * Returns table field names that are prefixed with table name.
     * @returns {String[]} - field names
     */
    getAllExtendedNotationFieldNames() {
        return this.schema.getAllExtendedNotationFieldNames();
    }

    /**
     * Find number of columns in table.
     * @returns {Number} - column count.
     */
    getColumnCount() {
        const fields = this.getAllExtendedNotationFieldNames();
        return fields.length;
    }

    /**
     * Return range of records from table.
     * @param {Number} startRecord - 1 is first record
     * @param {Number} lastRecord - -1 for all. Last = RecordCount().    
     * @param {Number[]} fields - fields to include in output
     * @returns {any[][]} - subset table data.
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
     * Create a logical table index on input field name.
     * The resulting map is stored with the table.
     * The Map<fieldDataItem, [rowNumbers]> is stored.
     * @param {String} fieldName - field name to index.
     * @param {CalculatedField} calcSqlField
     * @param {String} calcField
     * @returns {Map<String,Number[]>}
     */
    createKeyFieldRecordMap(fieldName, calcSqlField=null, calcField="") {
        const indexedFieldName = fieldName.trim().toUpperCase();
        /** @type {Map<String,Number[]>} */
        const fieldValuesMap = new Map();

        let value = null;
        let fieldIndex = null;
        if (calcSqlField === null) {
            fieldIndex = this.schema.getFieldColumn(indexedFieldName);
        }

        for (let i = 1; i < this.tableData.length; i++) {
            if (calcSqlField === null) {
                value = this.tableData[i][fieldIndex];
            }
            else {
                value = calcSqlField.evaluateCalculatedField(calcField, i);
            }

            value = (value !== null) ? value = value.toString() : value; 

            if (value !== "") {
                let rowNumbers = [];
                if (fieldValuesMap.has(value))
                    rowNumbers = fieldValuesMap.get(value);

                rowNumbers.push(i);
                fieldValuesMap.set(value, rowNumbers);
            }
        }

        return fieldValuesMap;
    }

    /**
     * The calculated field is evaluated for every record in the table.  Each unique calculated value
     * will map to a list of table record numbers where the calculated value will be found.
     * @param {CalculatedField} calcSqlField 
     * @param {String} calcField 
     * @returns  {Map<String,Number[]>}
     */
    createCalcFieldRecordMap(calcSqlField, calcField) {
        return this.createKeyFieldRecordMap("", calcSqlField, calcField);
    }

    /**
     * Return all row ID's where FIELD = SEARCH VALUE.
     * @param {String} fieldName - table column name (must be upper case and trimmed)
     * @param {any} searchValue - value to search for in index
     * @returns {Number[]} - all matching row numbers.
     */
    search(fieldName, searchValue) {
        const rows = [];

        const fieldValuesMap = this.indexes.get(fieldName);
        if (fieldValuesMap.has(searchValue))
            return fieldValuesMap.get(searchValue);
        return rows;
    }

    /**
     * Append table data from 'concatTable' to the end of this tables existing data.
     * @param {Table} concatTable - Append 'concatTable' data to end of current table data.
     * @returns {void}
     */
    concat(concatTable) {
        const fieldsThisTable = this.schema.getAllFieldNames();
        const fieldColumns = concatTable.getFieldColumns(fieldsThisTable);
        const data = concatTable.getRecords(1, -1, fieldColumns);
        this.tableData = this.tableData.concat(data);
    }

}

/** 
 * @classdesc
 * Class contains information about each column in the SQL table. 
 */
class Schema {
    constructor() {
        /** @property {String} - Table name. */
        this.tableName = "";

        /** @property {String} - Alias name of table. */
        this.tableAlias = "";

        /** @property {any[][]} - Table data double array. */
        this.tableData = [];

        /** @property {Table} - Link to table info object. */
        this.tableInfo = null;

        /** @property {Boolean} - Is this a derived table. */
        this.isDerivedTable = this.tableName === DERIVEDTABLE;

        /** @property {Map<String,Number>} - String=Field Name, Number=Column Number */
        this.fields = new Map();

        /** @property {VirtualFields} */
        this.virtualFields = new VirtualFields();
    }

    /**
     * Set table name in this object.
     * @param {String} tableName - Table name to remember.
     * @returns {Schema}
     */
    setTableName(tableName) {
        this.tableName = tableName.toUpperCase();
        return this;
    }

    /**
     * Associate the table alias to this object.
     * @param {String} tableAlias - table alias name
     * @returns {Schema}  
     */
    setTableAlias(tableAlias) {
        this.tableAlias = tableAlias.toUpperCase();
        return this;
    }

    /**
     * Associate table data with this object.
     * @param {any[][]} tableData - double array of table data.
     * @returns {Schema}
     */
    setTableData(tableData) {
        this.tableData = tableData;
        return this;
    }

    /**
     * Set the existing 'Table' info.
     * @param {Table} tableInfo - table object.
     * @returns {Schema}
     */
    setTable(tableInfo) {
        this.tableInfo = tableInfo;
        return this;
    }

    /**
     * Retrieve all field names for this table.
     * @returns {String[]} - List of field names.
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
     * @returns {String[]} - list of all field names with table prefix.
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
     * Get a list of all virtual field data associated with this table.
     * @returns {VirtualField[]}
     */
    getAllVirtualFields() {
        return this.virtualFields.getAllVirtualFields();
    }

    /**
     * Get the column number for the specified field name.
     * @param {String} field - Field name to find column number for.
     * @returns {Number} - Column number.
     */
    getFieldColumn(field) {
        const cols = this.getFieldColumns([field]);
        return cols[0];
    }

    /**
    * Get field column index (starts at 0) for field names.
    * @param {String[]} fieldNames - find columns for specific fields in table.
    * @returns {Number[]} - column numbers for each specified field.
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
        /** @type {FieldVariants} */
        let fieldVariants = null;
        for (const baseColumnName of titleRow) {
            //  Find possible variations of the field column name.
            try {
                fieldVariants = this.getColumnNameVariants(baseColumnName);
            }
            catch (ex) {
                throw new Error(`Invalid column title: ${baseColumnName}`);
            }
            const columnName = fieldVariants.columnName;

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
     * @typedef {Object} FieldVariants
     * @property {String} columnName
     * @property {String} fullColumnName
     * @property {String} fullColumnAliasName
     */

    /**
     * Find all valid variations for a column name.  This will include base column name,
     * the column name prefixed with full table name, and the column name prefixed with table alias.
     * @param {String} colName 
     * @returns {FieldVariants}
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

        return { columnName, fullColumnName, fullColumnAliasName };
    }

    /**
     * Associate table column number to each possible variation of column name.
     * @param {FieldVariants} fieldVariants 
     * @param {Number} colNum 
     */
    setFieldVariantsColumNumber(fieldVariants, colNum) {
        if (fieldVariants.columnName !== "") {
            this.fields.set(fieldVariants.columnName, colNum);

            if (!this.isDerivedTable) {
                this.fields.set(fieldVariants.fullColumnName, colNum);

                if (fieldVariants.fullColumnAliasName !== "") {
                    this.fields.set(fieldVariants.fullColumnAliasName, colNum);
                }
            }
        }
    }
}