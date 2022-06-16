//  Remove comments for testing in NODE
//
export {Table, Schema};
import {DERIVEDTABLE, VirtualFields, VirtualField} from './Views.js';
import {Logger} from './SqlTest.js';
//

function testTable() {
    let masterTransactions = new Table("masterTransactions", "'Master Transactions'!$A$1:$I");
    masterTransactions.addIndex("Name of Institution");

    let rbcRows = masterTransactions.search("Name of Institution", "RBC - Margin - ****2066");
    Logger.log(rbcRows);

    let tfsaSavingsRows = masterTransactions.search("Expense Category", "Savings - TFSA");
    Logger.log(tfsaSavingsRows);
}

class Table {
    /**
     * 
     * @param {String} tableName 
     * @param {String} namedRange - specify a RANGE to load table data FROM or...
     * @param {any[]} tableData - double array with table data.  First row MUST be column titles.
     */
    constructor(tableName, namedRange = "", tableData = []) {
        this.tableName = tableName.toUpperCase();
        this.tableData = [];
        this.indexes = new Map();
        /** @type {Schema} */
        this.schema = new Schema();

        if (namedRange != "")
            this.loadNamedRangeData(namedRange);
        else if (tableData != undefined && tableData.length != 0)
            this.loadArrayData(tableData);
    }

    isDerivedTable() {
        return this.schema.isDerivedTable;
    }

    /**
     * 
     * @param {String} namedRange 
     */
    loadNamedRangeData(namedRange) {
        if (namedRange == "")
            return this;

        var ss = SpreadsheetApp.getActiveSpreadsheet();
        let range = ss.getRangeByName(namedRange);
        if (range == null) {
            Logger.log("Table: " + this.tableName + ". Invalid Range:" + namedRange);
            throw("Invalid TABLE Range: " + namedRange + " for table " + this.tableName);
        }

        let tempData = range.getValues();
        this.tableData = tempData.filter(e => e.join().replace(/,/g, "").length);

        Logger.log("Load Data: Range=" + namedRange + ". Items=" + this.tableData.length);
        this.schema = new Schema(this.tableName, this.tableData, this);

        return this;
    }

    /**
     * 
     * @param {any[]} tableData - Loaded table data with first row titles included.
     */
    loadArrayData(tableData) {
        if (tableData.length == 0)
            return this;

        this.tableData = tableData;
        this.schema = new Schema(this.tableName, this.tableData, this);

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
     * @param {String} field 
     * @returns {VirtualField}
     */
    getVirtualFieldInfo(field) {
        return this.schema.getVirtualFieldInfo(field);
    }

    /**
     * 
     * @returns {VirtualField[]}
     */
    getAllVirtualFields() {
        return this.schema.getAllVirtualFields();
    }

    /**
     * Get number of records in table.
     * @returns {Number}
     */
    getRecordCount() {
        //  First row is TITLES - so not part of data.
        return this.tableData.length - 1;
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
     * Return range of records from table.
     * @param {Number} startRecord - 1 is first record
     * @param {Number} lastRecord - -1 for all. Last = RecordCount().    
     * @param {Number[]} fields 
     * @returns {any[][]}
     */
    getRecords(startRecord, lastRecord, fields) {
        let selectedRecords = [];

        if (startRecord < 1)
            startRecord = 1;

        if (lastRecord < 0)
            lastRecord = this.tableData.length - 1;

        for (let i = startRecord; i <= lastRecord && i < this.tableData.length; i++) {
            let row = [];

            for (let col of fields) {
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
        fieldName = fieldName.trim().toUpperCase();

        if (this.schema.getFieldColumn(fieldName) == -1) {
            Logger.log("Table: " + this.tableName + ". Add Index: " + fieldName + ". Error:  Does not exist");
            return
        }

        let fieldValuesMap = new Map();

        let fieldIndex = this.schema.getFieldColumn(fieldName);
        for (let i = 1; i < this.tableData.length; i++) {
            let value = this.tableData[i][fieldIndex];

            if (value != "") {
                let rowNumbers = [];
                if (fieldValuesMap.has(value))
                    rowNumbers = fieldValuesMap.get(value);

                rowNumbers.push(i);
                fieldValuesMap.set(value, rowNumbers);
            }
        }

        this.indexes.set(fieldName, fieldValuesMap);
    }

    /**
     * Return all row ID's where FIELD = SEARCH VALUE.
     * @param {String} fieldName 
     * @param {any} searchValue 
     * @returns {Number[]}
     */
    search(fieldName, searchValue) {
        let rows = [];
        fieldName = fieldName.trim().toUpperCase();

        let searchFieldCol = this.schema.getFieldColumn(fieldName);
        if (searchFieldCol == -1)
            return rows;

        if (this.indexes.has(fieldName)) {
            let fieldValuesMap = this.indexes.get(fieldName);
            if (fieldValuesMap.has(searchValue))
                return fieldValuesMap.get(searchValue);
            return rows;
        }

        for (let i = 1; i < this.tableData.length; i++) {
            if (this.tableData[i][searchFieldCol] == searchValue)
                rows.push(i);
        }

        return rows;
    }

    /**
     * 
     * @param {Table} concatTable 
     */
    concat(concatTable) {
        let fieldsThisTable = this.schema.getAllFieldNames();   
        let fieldColumns = concatTable.getFieldColumns(fieldsThisTable); 
        let data = concatTable.getRecords(1, -1, fieldColumns);
        this.tableData = this.tableData.concat(data);
    }

}

class Schema {
    /**
     * Finds table field info.
     * @param {String} tableName
     * @param {any[][]} tableData 
     */
    constructor(tableName = "", tableData = [], tableInfo = null) {
        this.tableName = tableName.toUpperCase();
        this.tableData = tableData;
        this.tableInfo = tableInfo;
        this.isDerivedTable = this.tableName == DERIVEDTABLE;

        /** @type {Map<String,Number>} */
        this.fields = new Map();
        this.fieldType = new Map();
        /** @type {VirtualFields} */
        this.virtualFields = new VirtualFields();

        this.getFieldInfo();
    }

    /**
     * 
     * @returns {String[]}
     */
    getAllFieldNames() {
        /** @type {String[]} */
        let fieldNames = [];

        // @ts-ignore
        for (const [key, value] of this.fields.entries()) {
            if (key != "*")
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
        let fieldNames = [];

        // @ts-ignore
        for (const [key, value] of this.fields.entries()) {
            if (key.indexOf(".") != -1)
                fieldNames.push(key);
        }

        return fieldNames;
    }

    /**
     * 
     * @param {String} field 
     * @returns {VirtualField}
     */
    getVirtualFieldInfo(field) {
        return this.virtualFields.getFieldInfo(field);
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
        let cols = this.getFieldColumns([field]);
        return cols[0];
    }

    /**
    * Get field column index (starts at 0) for field names.
    * @param {String[]} fieldNames 
    * @returns {Number[]}
    */
    getFieldColumns(fieldNames) {
        /** @type {Number[]} */
        let fieldIndex = [];

        for (let field of fieldNames) {
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
     */
    getFieldInfo() {
        if (this.tableData.length > 0) {
            /** @type {any[]} */
            let titleRow = this.tableData[0];

            let colNum = 0;
            /** @type{String} */
            let col;
            for (col of titleRow) {
                col = col.trim().toUpperCase().replace(/\s/g, "_");
                let fullColumnName = this.tableName + "." + col;

                if (col != "") {
                    this.fields.set(col, colNum);
                    
                    let dataType = this.getColumnType(colNum);
                    this.fieldType.set(col, dataType);

                    if (! this.isDerivedTable) {
                        this.fields.set(fullColumnName, colNum);
                        this.fieldType.set(fullColumnName, dataType);
                    }

                    let virtualField = new VirtualField(col, this.tableInfo, colNum);
                    this.virtualFields.add(virtualField);
                }

                colNum++;
            }

            //  Add special field for every table.
            //  The asterisk represents ALL fields in table.
            this.fields.set("*", null);
            this.fieldType.set("*", null);
        }
    }

    /**
     * Column data may have different types of data.  The column is assesed to be
     * a certain data type based on what data is found MOST.
     * @param {Number} columnNumber 
     * @returns {}
     */
    getColumnType(columnNumber) {
        let dateCount = 0;
        let stringCount = 1;
        let numberCount = 2;
        let booleanCount = 3;
        let counter = [];
        for (let i = 0; i < 4; i++)
            counter[i] = 0;

        for (let i = 1; i < this.tableData.length; i++) {
            if (typeof this.tableData[i][columnNumber] == "boolean")
                counter[booleanCount]++;
            else if (typeof this.tableData[i][columnNumber] == "string")
                counter[stringCount]++;
            else if (typeof this.tableData[i][columnNumber] == "number")
                counter[numberCount]++;
            else if (this.tableData[i][columnNumber] instanceof Date)
                counter[dateCount]++;
        }

        let largest = 0;
        let item = 0;
        for (let i = 1; i < 4; i++) {
            if (counter[i] > largest) {
                largest = counter[i];
                item = i;
            }
        }

        switch (item) {
            case dateCount:
                return Date;
            case stringCount:
                return String;
            case numberCount:
                return Number;
            case booleanCount:
                return Boolean;
        }

        return String;
    }
}