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

class Table {
    /**
     * 
     * @param {String} tableName 
     */
    constructor(tableName) {
        this.tableName = tableName.toUpperCase();
        this.tableData = [];
        this.indexes = new Map();
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
     * Load sheets named range of data into table.
     * @param {String} namedRange 
     * @param {Number} cacheSeconds
     * @returns {Table}
     */
    loadNamedRangeData(namedRange, cacheSeconds = 0) {
        this.tableData = TableData.loadTableData(namedRange, cacheSeconds);

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

        this.tableData = tableData;
        this.loadSchema();

        return this;
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
}//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { DERIVEDTABLE, VirtualFields, VirtualField, SelectTables };
import { Table } from './Table.js';
import { Sql } from './Sql.js';
import { SqlParse } from './SimpleParser.js';
//  *** DEBUG END  ***/

const DERIVEDTABLE = "::DERIVEDTABLE::";

class SelectTables {
    /**
     * @param {Object} astTables
     * @param {Object} astFields
     * @param {Map<String,Table>} tableInfo 
     * @param {any[]} bindVariables
     */
    constructor(astTables, astFields, tableInfo, bindVariables) {
        this.primaryTable = astTables[0].table;
        this.astFields = astFields;
        this.tableInfo = tableInfo;
        this.bindVariables = bindVariables;
        this.joinedTablesMap = new Map();
        this.dataJoin = new JoinTables([]);
        this.tableFields = new TableFields();

        if (!tableInfo.has(this.primaryTable.toUpperCase()))
            throw new Error(`Invalid table name: ${this.primaryTable}`);
        this.primaryTableInfo = tableInfo.get(this.primaryTable.toUpperCase());

        //  Keep a list of all possible fields from all tables.
        this.tableFields.loadVirtualFields(this.primaryTable, tableInfo);

        //  Expand any 'SELECT *' fields and add the actual field names into 'astFields'.
        this.astFields = VirtualFields.expandWildcardFields(this.primaryTableInfo, this.astFields);

        this.tableFields.updateSelectFieldList(this.astFields);
    }

    /**
     * 
     * @param {Object} ast 
     */
    join(ast) {
        if (typeof ast.JOIN !== 'undefined')
            this.dataJoin = new JoinTables(ast.JOIN, this.tableFields);
    }

    /**
      * Retrieve filtered record ID's.
      * @param {Object} ast 
      * @returns {Number[]}
      */
    whereCondition(ast) {
        let sqlData = [];

        let conditions = {};
        if (typeof ast.WHERE !== 'undefined') {
            conditions = ast.WHERE;
        }
        else {
            //  Entire table is selected.  
            conditions = { operator: "=", left: "\"A\"", right: "\"A\"" };
        }

        if (typeof conditions.logic === 'undefined')
            sqlData = this.resolveCondition("OR", [conditions]);
        else
            sqlData = this.resolveCondition(conditions.logic, conditions.terms);

        return sqlData;
    }

    /**
    * 
    * @param {String} logic 
    * @param {Object} terms 
    * @returns {Number[]}
    */
    resolveCondition(logic, terms) {
        const recordIDs = [];

        for (const cond of terms) {
            if (typeof cond.logic === 'undefined') {
                recordIDs.push(this.getRecordIDs(cond));
            }
            else {
                recordIDs.push(this.resolveCondition(cond.logic, cond.terms));
            }
        }

        let result = [];
        if (logic === "AND") {
            result = recordIDs.reduce((a, b) => a.filter(c => b.includes(c)));
        }
        if (logic === "OR") {
            //  OR Logic
            let tempArr = [];
            for (const arr of recordIDs) {
                tempArr = tempArr.concat(arr);
            }
            result = Array.from(new Set(tempArr));
        }

        return result;
    }

    /**
    * 
    * @param {Object} condition
    * @returns {Number[]} 
    */
    getRecordIDs(condition) {
        /** @type {Number[]} */
        const recordIDs = [];

        const leftFieldConditions = this.resolveFieldCondition(condition.left);
        const rightFieldConditions = this.resolveFieldCondition(condition.right);

        /** @type {Table} */
        this.masterTable = this.dataJoin.isDerivedTable() ? this.dataJoin.getJoinedTableInfo() : this.primaryTableInfo;
        const calcSqlField = new CalculatedField(this.masterTable, this.primaryTableInfo, this.tableFields);

        for (let masterRecordID = 1; masterRecordID < this.masterTable.tableData.length; masterRecordID++) {
            let leftValue = SelectTables.getConditionValue(leftFieldConditions, calcSqlField, masterRecordID);
            let rightValue = SelectTables.getConditionValue(rightFieldConditions, calcSqlField, masterRecordID);

            if (leftValue instanceof Date || rightValue instanceof Date) {
                leftValue = SelectTables.dateToMs(leftValue);
                rightValue = SelectTables.dateToMs(rightValue);
            }

            if (SelectTables.isConditionTrue(leftValue, condition.operator, rightValue))
                recordIDs.push(masterRecordID);

        }

        return recordIDs;
    }

    /**
     * 
     * @param {any[]} fieldConditions 
     * @param {CalculatedField} calcSqlField
     * @param {Number} masterRecordID
     */
    static getConditionValue(fieldConditions, calcSqlField, masterRecordID) {
        /** @type {any} */
        let fieldConstant = null;
        /** @type {Number} */
        let fieldCol = -1;
        /** @type {Table} */
        let fieldTable = null;
        /** @type {String} */
        let fieldCalculatedField = "";

        [fieldTable, fieldCol, fieldConstant, fieldCalculatedField] = fieldConditions;

        let leftValue = fieldConstant;
        if (fieldCol >= 0) {
            leftValue = fieldTable.tableData[masterRecordID][fieldCol];
        }
        else if (fieldCalculatedField !== "") {
            if (fieldCalculatedField.toUpperCase() === "NULL") {
                leftValue = "NULL";
            }
            else {
                leftValue = calcSqlField.evaluateCalculatedField(fieldCalculatedField, masterRecordID);
            }
        }

        return leftValue;
    }

    /**
     * 
     * @param {any} leftValue 
     * @param {String} operator 
     * @param {any} rightValue 
     * @returns 
     */
    static isConditionTrue(leftValue, operator, rightValue) {
        let keep = false;

        switch (operator.toUpperCase()) {
            case "=":
                keep = leftValue === rightValue;
                break;

            case ">":
                keep = leftValue > rightValue;
                break;

            case "<":
                keep = leftValue < rightValue;
                break;

            case ">=":
                keep = leftValue >= rightValue;
                break;

            case "<=":
                keep = leftValue <= rightValue;
                break;

            case "<>":
                keep = leftValue !== rightValue;
                break;

            case "!=":
                keep = leftValue !== rightValue;
                break;

            case "LIKE":
                keep = SelectTables.likeCondition(leftValue, rightValue);
                break;

            case "NOT LIKE":
                keep = !(SelectTables.likeCondition(leftValue, rightValue));
                break;

            case "IN":
                keep = SelectTables.inCondition(leftValue, rightValue);
                break;

            case "NOT IN":
                keep = !(SelectTables.inCondition(leftValue, rightValue));
                break;

            case "IS NOT":
                keep = !(SelectTables.isCondition(leftValue, rightValue));
                break;

            case "IS":
                keep = SelectTables.isCondition(leftValue, rightValue);
                break;

            default:
                throw new Error(`Invalid Operator: ${operator}`);
        }

        return keep;
    }

    /**
     * 
     * @param {Number[]} recordIDs 
     * @returns {any[][]}
     */
    getViewData(recordIDs) {
        const virtualData = [];
        const calcSqlField = new CalculatedField(this.masterTable, this.primaryTableInfo, this.tableFields);

        for (const masterRecordID of recordIDs) {
            const newRow = [];

            for (const field of this.tableFields.getSelectFields()) {
                if (field.tableInfo !== null)
                    newRow.push(field.getData(masterRecordID));
                else if (field.calculatedFormula !== "") {
                    const result = calcSqlField.evaluateCalculatedField(field.calculatedFormula, masterRecordID);
                    newRow.push(result);
                }
            }

            virtualData.push(newRow);
        }

        return virtualData;
    }

    /**
     * 
     * @param {String} srcString 
     * @returns {String}
     */
    static toUpperCaseExceptQuoted(srcString) {
        let finalString = "";
        let inQuotes = "";

        for (let i = 0; i < srcString.length; i++) {
            let ch = srcString.charAt(i);

            if (inQuotes === "") {
                if (ch === '"' || ch === "'")
                    inQuotes = ch;
                ch = ch.toUpperCase();
            }
            else {
                if (ch === inQuotes)
                    inQuotes = "";
            }

            finalString += ch;
        }

        return finalString;
    }

    /**
     * 
     * @param {String} functionString 
     * @param {String} func
     * @returns {String[]} 
     */
    static parseForFunctions(functionString, func) {
        const args = [];
        const expMatch = "%1\\s*\\(";

        const matchStr = new RegExp(expMatch.replace("%1", func));
        const startMatchPos = functionString.search(matchStr);
        if (startMatchPos !== -1) {
            const searchStr = functionString.substring(startMatchPos);
            let i = searchStr.indexOf("(");
            const startLeft = i;
            let leftBracket = 1;
            for (i = i + 1; i < searchStr.length; i++) {
                const ch = searchStr.charAt(i);
                if (ch === "(") leftBracket++;
                if (ch === ")") leftBracket--;

                if (leftBracket === 0) {
                    args.push(searchStr.substring(0, i + 1));
                    args.push(searchStr.substring(startLeft + 1, i));
                    return args;
                }
            }
        }

        return null;
    }

    /**
     * String split on comma, EXCEPT if comma is within brackets (i.e. within an inner function)
     * @param {String} paramString 
     * @returns {String[]}
     */
    static parseForParams(paramString, startBracket = "(", endBracket = ")") {
        const args = [];
        let bracketCount = 0;
        let start = 0;

        for (let i = 0; i < paramString.length; i++) {
            const ch = paramString.charAt(i);

            if (ch === "," && bracketCount === 0) {
                args.push(paramString.substring(start, i));
                start = i + 1;
            }
            else if (ch === startBracket)
                bracketCount++;
            else if (ch === endBracket)
                bracketCount--;
        }

        const lastStr = paramString.substring(start);
        if (lastStr !== "")
            args.push(lastStr);

        return args;
    }

    /**
     * 
     * @param {Object} ast 
     * @param {any[][]} viewTableData 
     * @returns {any[][]}
     */
    groupBy(ast, viewTableData) {
        let groupedTableData = viewTableData;

        if (typeof ast['GROUP BY'] !== 'undefined') {
            groupedTableData = this.groupByFields(ast['GROUP BY'], viewTableData);

            if (typeof ast.HAVING !== 'undefined') {
                groupedTableData = this.having(ast.HAVING, groupedTableData);
            }
        }
        else {
            //  If any conglomerate field functions (SUM, COUNT,...)
            //  we summarize all records into ONE.
            if (this.tableFields.getConglomerateFieldCount() > 0) {
                const compressedData = [];
                const conglomerate = new ConglomerateRecord(this.tableFields.getSelectFields());
                compressedData.push(conglomerate.squish(viewTableData));
                groupedTableData = compressedData;
            }
        }

        return groupedTableData;
    }

    /**
    * 
    * @param {any[]} astGroupBy 
    * @param {any[][]} selectedData 
    * @returns {any[][]}
    */
    groupByFields(astGroupBy, selectedData) {
        if (selectedData.length === 0)
            return selectedData;

        //  Sort the least important first, and most important last.
        astGroupBy.reverse();

        for (const orderField of astGroupBy) {
            const selectColumn = this.tableFields.getSelectFieldColumn(orderField.column);
            if (selectColumn !== -1) {
                SelectTables.sortByColumnASC(selectedData, selectColumn);
            }
        }

        const groupedData = [];
        let groupRecords = [];
        const conglomerate = new ConglomerateRecord(this.tableFields.getSelectFields());

        let lastKey = this.createGroupByKey(selectedData[0], astGroupBy);
        for (const row of selectedData) {
            const newKey = this.createGroupByKey(row, astGroupBy);
            if (newKey !== lastKey) {
                groupedData.push(conglomerate.squish(groupRecords));

                lastKey = newKey;
                groupRecords = [];
            }
            groupRecords.push(row);
        }

        if (groupRecords.length > 0)
            groupedData.push(conglomerate.squish(groupRecords));

        return groupedData;
    }

    /**
     * 
     * @param {any[]} row 
     * @param {any[]} astGroupBy 
     * @returns 
     */
    createGroupByKey(row, astGroupBy) {
        let key = "";

        for (const orderField of astGroupBy) {
            const selectColumn = this.tableFields.getSelectFieldColumn(orderField.column);
            if (selectColumn !== -1)
                key += row[selectColumn].toString();
        }

        return key;
    }

    /**
    * 
    * @param {Object} astHaving 
    * @param {any[][]} selectedData 
    * @returns {any[][]}
    */
    having(astHaving, selectedData) {
        //  Add in the title row for now
        selectedData.unshift(this.tableFields.getColumnNames());

        //  Create our virtual GROUP table with data already selected.
        const groupTable = new Table(this.primaryTable).loadArrayData(selectedData);

        const tableMapping = new Map();
        tableMapping.set(this.primaryTable.toUpperCase(), groupTable);

        //  Set up for our SQL.
        const inSQL = new Sql().setTables(tableMapping);

        //  Fudge the HAVING to look like a SELECT.
        const astSelect = {};
        astSelect.FROM = [{ table: this.primaryTable }];
        astSelect.SELECT = [{ name: "*" }];
        astSelect.WHERE = astHaving;

        return inSQL.select(astSelect);
    }

    /**
     * 
     * @param {Object} ast 
     * @param {any[][]} selectedData 
     */
    orderBy(ast, selectedData) {
        if (typeof ast['ORDER BY'] === 'undefined')
            return;

        const astOrderby = ast['ORDER BY']

        //  Sort the least important first, and most important last.
        const reverseOrderBy = astOrderby.reverse();

        for (const orderField of reverseOrderBy) {
            const selectColumn = this.tableFields.getSelectFieldColumn(orderField.column);

            if (selectColumn === -1) {
                throw new Error(`Invalid ORDER BY: ${orderField.column}`);
            }

            if (orderField.order === "DESC") {
                SelectTables.sortByColumnDESC(selectedData, selectColumn);
            }
            else {
                SelectTables.sortByColumnASC(selectedData, selectColumn);
            }
        }
    }

    /**
     * 
     * @param {any[][]} tableData 
     * @param {Number} colIndex 
     * @returns {any[][]}
     */
    static sortByColumnASC(tableData, colIndex) {
        tableData.sort(sortFunction);

        /**
         * 
         * @param {any} a 
         * @param {any} b 
         * @returns {Number}
         */
        function sortFunction(a, b) {
            if (a[colIndex] === b[colIndex]) {
                return 0;
            }
            return (a[colIndex] < b[colIndex]) ? -1 : 1;
        }

        return tableData;
    }

    /**
     * 
     * @param {any[][]} tableData 
     * @param {Number} colIndex 
     * @returns {any[][]}
     */
    static sortByColumnDESC(tableData, colIndex) {

        tableData.sort(sortFunction);

        /**
         * 
         * @param {any} a 
         * @param {any} b 
         * @returns {Number}
         */
        function sortFunction(a, b) {
            if (a[colIndex] === b[colIndex]) {
                return 0;
            }
            return (a[colIndex] > b[colIndex]) ? -1 : 1;
        }

        return tableData;
    }

    /**
     * 
     * @param {Object} fieldCondition 
     * @returns {any[]}
     */
    resolveFieldCondition(fieldCondition) {
        /** @type {String} */
        let constantData = null;
        /** @type {Number} */
        let columnNumber = -1;
        /** @type {Table} */
        let fieldConditionTableInfo = null;
        /** @type {String} */
        let calculatedField = "";

        //  Maybe a SELECT within...
        if (typeof fieldCondition.SELECT !== 'undefined') {
            const inSQL = new Sql().setTables(this.tableInfo);
            inSQL.setBindValues(this.bindVariables);
            const inData = inSQL.select(fieldCondition);
            constantData = inData.join(",");
        }
        else if (SelectTables.isStringConstant(fieldCondition))
            constantData = SelectTables.extractStringConstant(fieldCondition);
        else if (fieldCondition === '?') {
            //  Bind variable data.
            if (this.bindVariables.length === 0)
                throw new Error("Bind variable mismatch");
            constantData = this.bindVariables.shift();
        }
        else {
            if (isNaN(fieldCondition)) {
                if (this.tableFields.hasField(fieldCondition)) {
                    columnNumber = this.tableFields.getFieldColumn(fieldCondition)
                    fieldConditionTableInfo = this.tableFields.getTableInfo(fieldCondition)
                }
                else {
                    //  Calculated field?
                    calculatedField = fieldCondition;
                }
            }
            else
                constantData = fieldCondition;
        }

        return [fieldConditionTableInfo, columnNumber, constantData, calculatedField];
    }

    /**
     * 
     * @param {String} value 
     * @returns {Boolean}
     */
    static isStringConstant(value) {
        return value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'");
    }

    /**
     * 
     * @param {String} value 
     * @returns {String}
     */
    static extractStringConstant(value) {
        if (value.startsWith('"') && value.endsWith('"'))
            return value.replace(/"/g, '');

        if (value.startsWith("'") && value.endsWith("'"))
            return value.replace(/'/g, '');

        return value;
    }

    /**
     * 
     * @param {any} value 
     * @returns {Number}
     */
    static dateToMs(value) {
        let year = 0;
        let month = 0;
        let dayNum = 0;

        if (value instanceof Date) {
            year = value.getFullYear();
            month = value.getMonth();
            dayNum = value.getDate();
        }
        else if (typeof value === "string") {
            const dateParts = value.split("/");
            if (dateParts.length === 3) {
                year = parseInt(dateParts[2], 10);
                month = parseInt(dateParts[0], 10) - 1;
                dayNum = parseInt(dateParts[1], 10);
            }
        }

        const newDate = new Date(Date.UTC(year, month, dayNum, 12, 0, 0, 0));
        return newDate.getTime();
    }

    /**
     * 
     * @param {String} leftValue 
     * @param {String} rightValue 
     * @returns {Boolean}
     */
    static likeCondition(leftValue, rightValue) {
        // @ts-ignore
        const expanded = rightValue.replace(/%/g, ".*").replace(/_/g, ".");

        const result = leftValue.search(expanded);
        return result !== -1;
    }

    /**
     * 
     * @param {String} leftValue 
     * @param {String} rightValue 
     * @returns 
     */
    static inCondition(leftValue, rightValue) {
        const items = rightValue.split(",");
        for (let i = 0; i < items.length; i++)
            items[i] = items[i].trimStart().trimEnd();

        const index = items.indexOf(leftValue);

        return index !== -1;
    }

    /**
     * 
     * @param {any} leftValue 
     * @param {any} rightValue 
     * @returns {Boolean}
     */
    static isCondition(leftValue, rightValue) {
        return (leftValue === "" && rightValue === "NULL");
    }

    /**
     * 
     * @returns {String[]}
     */
    getColumnTitles() {
        return this.tableFields.getColumnTitles();
    }
}

class CalculatedField {
    /**
     * 
     * @param {Table} masterTable 
     * @param {Table} primaryTable
     * @param {TableFields} tableFields 
     */
    constructor(masterTable, primaryTable, tableFields) {
        this.masterTable = masterTable;
        this.primaryTable = primaryTable;
        this.sqlServerFunctionCache = new Map();
        this.masterFields = tableFields.allFields.filter((vField) => this.masterTable === vField.tableInfo);
    }

    /**
     * 
     * @param {String} calculatedFormula 
     * @param {Number} masterRecordID 
     * @returns {any}
     */
    evaluateCalculatedField(calculatedFormula, masterRecordID) {
        let result = "";
        const functionString = this.sqlServerCalcFields(calculatedFormula, masterRecordID);
        try {
            result = new Function(functionString)();
        }
        catch (ex) {
            throw new Error(`Calculated Field Error: ${ex.message}.  ${functionString}`);
        }

        return result;
    }

    /**
     * The program is attempting to build some javascript code which we can then execute to 
     * find the value of the calculated field.  There are two parts.
     * 1)  Build LET statements to assign to all possible field name variants,
     * 2)  Add the 'massaged' calculated field so that it can be run in javascript.
     * @param {String} calculatedFormula 
     * @param {Number} masterRecordID
     * @returns {String} - String to be executed.  It is valid javascript lines of code.
     */
    sqlServerCalcFields(calculatedFormula, masterRecordID) {
        //  Working on a calculated field.
        const objectsDeclared = new Map();
        const variablesDeclared = new Map();

        let myVars = "";
        for (/** @type {TableField} */ const vField of this.masterFields) {
            //  Get the DATA from this field.  We then build a series of LET statments
            //  and we assign that data to the field name that might be found in a calculated field.
            let varData = vField.getData(masterRecordID);
            if (typeof varData === "string" || varData instanceof Date) {
                varData = `'${varData}'`;
            }

            myVars += this.createAssignmentStatments(vField, objectsDeclared, variablesDeclared, varData);
        }

        const functionString = this.sqlServerFunctions(calculatedFormula);

        return `${myVars} return ${functionString}`;
    }

    /**
     * 
     * @param {TableField} vField 
     * @param {Map<String, Boolean>} objectsDeclared
     * @param {Map<String, Boolean>} variablesDeclared
     * @param {String} varData
     * @returns {String}
     */
    createAssignmentStatments(vField, objectsDeclared, variablesDeclared, varData) {
        let myVars = "";

        for (const aliasName of vField.aliasNames) {
            if ((this.primaryTable.tableName !== vField.tableInfo.tableName && aliasName.indexOf(".") === -1))
                continue;

            if (aliasName.indexOf(".") === -1) {
                if (!variablesDeclared.has(aliasName)) {
                    myVars += `let ${aliasName} = ${varData};`;
                    variablesDeclared.set(aliasName, true);
                }
            }
            else {
                const parts = aliasName.split(".");
                if (!objectsDeclared.has(parts[0])) {
                    myVars += `let ${parts[0]} = {};`;
                    objectsDeclared.set(parts[0], true);
                }
                myVars += `${aliasName} = ${varData};`;
            }
        }

        return myVars;
    }

    /**
     * 
     * @param {String} calculatedFormula 
     * @returns {String}
     */
    sqlServerFunctions(calculatedFormula) {
        //  If this calculated field formula has already been put into the required format,
        //  pull this out of our cache rather than redo.
        if (this.sqlServerFunctionCache.has(calculatedFormula))
            return this.sqlServerFunctionCache.get(calculatedFormula);

        const func = new SqlServerFunctions();
        const functionString = func.convertToJs(calculatedFormula);

        //  No need to recalculate for each row.
        this.sqlServerFunctionCache.set(calculatedFormula, functionString);

        return functionString;
    }

}

class VirtualFields {
    constructor() {
        /** @type {Map<String, VirtualField>} */
        this.virtualFieldMap = new Map();
        /** @type {VirtualField[]} */
        this.virtualFieldList = [];
    }

    /**
     * 
     * @param {VirtualField} field 
     */
    add(field, checkForDuplicates = false) {
        if (checkForDuplicates && this.virtualFieldMap.has(field.fieldName)) {
            throw new Error(`Duplicate field name: ${field.fieldName}`);
        }
        this.virtualFieldMap.set(field.fieldName, field);
        this.virtualFieldList.push(field);
    }

    /**
     * 
     * @returns {VirtualField[]}
     */
    getAllVirtualFields() {
        return this.virtualFieldList;
    }

    /**
     * 
     * @param {Table} masterTableInfo 
     * @param {any[]} astFields 
     * @returns {any[]}
     */
    static expandWildcardFields(masterTableInfo, astFields) {
        for (let i = 0; i < astFields.length; i++) {
            if (astFields[i].name === "*") {
                //  Replace wildcard will actual field names from master table.
                const masterTableFields = [];
                const allExpandedFields = masterTableInfo.getAllExtendedNotationFieldNames();

                for (const virtualField of allExpandedFields) {
                    const selField = { name: virtualField };
                    masterTableFields.push(selField);
                }

                astFields.splice(i, 1, ...masterTableFields);
                break;
            }
        }

        return astFields;
    }
}

/**  Defines all possible table fields including '*' and long/short form (i.e. table.column). */
class VirtualField {
    /**
     * 
     * @param {String} fieldName 
     * @param {Table} tableInfo 
     * @param {Number} tableColumn 
     */
    constructor(fieldName, tableInfo, tableColumn) {
        this.fieldName = fieldName;
        this.tableInfo = tableInfo;
        this.tableColumn = tableColumn;
    }
}

/** Handle the various JOIN table types. */
class JoinTables {
    /**
     * 
     * @param {any[]} astJoin 
     * @param {TableFields} tableFields
     */
    constructor(astJoin, tableFields = null) {
        /** @type {DerivedTable} */
        this.derivedTable = new DerivedTable();

        for (const joinTable of astJoin) {
            /** @type {TableField} */
            let leftFieldInfo = null;
            /** @type {TableField} */
            let rightFieldInfo = null;
            if (tableFields !== null) {
                leftFieldInfo = tableFields.getFieldInfo(joinTable.cond.left);
                rightFieldInfo = tableFields.getFieldInfo(joinTable.cond.right);
            }

            this.derivedTable = JoinTables.joinTables(leftFieldInfo, rightFieldInfo, joinTable);

            //  Field locations have changed to the derived table, so update our
            //  virtual field list with proper settings.
            tableFields.updateDerivedTableVirtualFields(this.derivedTable);
        }
    }

    /**
     * 
     * @returns {Boolean}
     */
    isDerivedTable() {
        return this.derivedTable.isDerivedTable();
    }

    /**
     * 
     * @returns {Table}
     */
    getJoinedTableInfo() {
        return this.derivedTable.getTableData();
    }

    /**
    * 
    * @param {TableField} leftFieldInfo 
    * @param {TableField} rightFieldInfo 
    * @param {Object} joinTable 
    * @returns {DerivedTable}
    */
    static joinTables(leftFieldInfo, rightFieldInfo, joinTable) {
        let matchedRecordIDs = [];
        let leftJoinRecordIDs = [];
        let rightJoinRecordIDs = [];
        let derivedTable = null;
        let rightDerivedTable = null;

        switch (joinTable.type) {
            case "left":
                matchedRecordIDs = JoinTables.leftRightJoin(leftFieldInfo, rightFieldInfo, joinTable.type);
                derivedTable = new DerivedTable()
                    .setLeftField(leftFieldInfo)
                    .setRightField(rightFieldInfo)
                    .setLeftRecords(matchedRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();
                break;

            case "inner":
                matchedRecordIDs = JoinTables.leftRightJoin(leftFieldInfo, rightFieldInfo, joinTable.type);
                derivedTable = new DerivedTable()
                    .setLeftField(leftFieldInfo)
                    .setRightField(rightFieldInfo)
                    .setLeftRecords(matchedRecordIDs)
                    .setIsOuterJoin(false)
                    .createTable();
                break;

            case "right":
                matchedRecordIDs = JoinTables.leftRightJoin(rightFieldInfo, leftFieldInfo, joinTable.type);
                derivedTable = new DerivedTable()
                    .setLeftField(rightFieldInfo)
                    .setRightField(leftFieldInfo)
                    .setLeftRecords(matchedRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();

                break;

            case "full":
                leftJoinRecordIDs = JoinTables.leftRightJoin(leftFieldInfo, rightFieldInfo, joinTable.type);
                derivedTable = new DerivedTable()
                    .setLeftField(leftFieldInfo)
                    .setRightField(rightFieldInfo)
                    .setLeftRecords(leftJoinRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();

                rightJoinRecordIDs = JoinTables.leftRightJoin(rightFieldInfo, leftFieldInfo, "outer");
                rightDerivedTable = new DerivedTable()
                    .setLeftField(rightFieldInfo)
                    .setRightField(leftFieldInfo)
                    .setLeftRecords(rightJoinRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();

                derivedTable.tableInfo.concat(rightDerivedTable.tableInfo);

                break;

            default:
                throw new Error(`Internal error.  No support for join type: ${joinTable.type}`);
        }
        return derivedTable;
    }

    /**
     * Returns array of each matching record ID from right table for every record in left table.
     * If the right table entry could NOT be found, -1 is set for that record index.
     * @param {TableField} leftField 
     * @param {TableField} rightField
     * @param {String} type
     * @returns {Number[][]} 
     */
    static leftRightJoin(leftField, rightField, type) {
        const leftRecordsIDs = [];

        //  First record is the column title.
        leftRecordsIDs.push([0]);

        /** @type {any[][]} */
        const leftTableData = leftField.tableInfo.tableData;
        const leftTableCol = leftField.tableColumn;

        rightField.tableInfo.addIndex(rightField.fieldName);

        for (let leftTableRecordNum = 1; leftTableRecordNum < leftTableData.length; leftTableRecordNum++) {
            const keyMasterJoinField = leftTableData[leftTableRecordNum][leftTableCol];
            const joinRows = rightField.tableInfo.search(rightField.fieldName, keyMasterJoinField);

            //  For the current LEFT TABLE record, record the linking RIGHT TABLE records.
            if (joinRows.length === 0) {
                if (type === "inner")
                    continue;

                leftRecordsIDs[leftTableRecordNum] = [-1];
            }
            else {
                //  Excludes all match recordgs (is outer the right word for this?)
                if (type === "outer")
                    continue;

                leftRecordsIDs[leftTableRecordNum] = joinRows;
            }
        }

        return leftRecordsIDs;
    }
}

/**  The JOIN creates a new logical table. */
class DerivedTable {
    constructor() {
        /** @type {Table} */
        this.tableInfo = null;
        /** @type  {TableField} */
        this.leftField = null;
        /** @type  {TableField} */
        this.rightField = null;
        /** @type  {Number[][]} */
        this.leftRecords = null;
        /** @type  {Boolean} */
        this.isOuterJoin = null;
    }

    /**
     * 
     * @param {TableField} leftField 
     * @returns {DerivedTable}
     */
    setLeftField(leftField) {
        this.leftField = leftField;
        return this;
    }

    /**
     * 
     * @param {TableField} rightField 
     * @returns {DerivedTable}
     */
    setRightField(rightField) {
        this.rightField = rightField;
        return this;
    }

    /**
     * 
     * @param {Number[][]} leftRecords 
     * @returns {DerivedTable} 
     */
    setLeftRecords(leftRecords) {
        this.leftRecords = leftRecords;
        return this;
    }

    /**
     * 
     * @param {Boolean} isOuterJoin 
     * @returns {DerivedTable}
     */
    setIsOuterJoin(isOuterJoin) {
        this.isOuterJoin = isOuterJoin;
        return this;
    }

    /**
     * 
     * @returns {DerivedTable}
     */
    createTable() {
        const columnCount = this.rightField.tableInfo.getColumnCount();
        const emptyRightRow = Array(columnCount).fill("");

        const joinedData = [DerivedTable.getCombinedColumnTitles(this.leftField, this.rightField)];

        for (let i = 1; i < this.leftField.tableInfo.tableData.length; i++) {
            if (typeof this.leftRecords[i] !== "undefined") {
                if (typeof this.rightField.tableInfo.tableData[this.leftRecords[i][0]] === "undefined")
                    joinedData.push(this.leftField.tableInfo.tableData[i].concat(emptyRightRow));
                else {
                    const maxJoin = this.isOuterJoin ? this.leftRecords[i].length : 1;
                    for (let j = 0; j < maxJoin; j++) {
                        joinedData.push(this.leftField.tableInfo.tableData[i].concat(this.rightField.tableInfo.tableData[this.leftRecords[i][j]]));
                    }
                }
            }
        }
        /** @type {Table} */
        this.tableInfo = new Table(DERIVEDTABLE).loadArrayData(joinedData);

        return this;
    }

    /**
    * 
    * @returns {Boolean}
    */
    isDerivedTable() {
        return this.tableInfo !== null;
    }

    /**
     * 
     * @returns {Table}
     */
    getTableData() {
        return this.tableInfo;
    }

    /**
     * 
     * @param {TableField} leftField 
     * @param {TableField} rightField 
     * @returns {String[]}
     */
    static getCombinedColumnTitles(leftField, rightField) {
        const titleRow = leftField.tableInfo.getAllExtendedNotationFieldNames();
        const rightFieldNames = rightField.tableInfo.getAllExtendedNotationFieldNames();
        return titleRow.concat(rightFieldNames);
    }
}

class SqlServerFunctions {
    /**
     * 
     * @param {String} calculatedFormula 
     * @returns {String}
     */
    convertToJs(calculatedFormula) {
        const sqlFunctions = ["ABS", "CASE", "CEILING", "CHARINDEX", "FLOOR", "IF", "LEFT", "LEN", "LENGTH", "LOG", "LOG10", "LOWER",
            "LTRIM", "NOW", "POWER", "RAND", "REPLICATE", "REVERSE", "RIGHT", "ROUND", "RTRIM",
            "SPACE", "STUFF", "SUBSTRING", "SQRT", "TRIM", "UPPER"];
        this.matchCaseWhenThenStr = /WHEN(.*?)THEN(.*?)(?=WHEN|ELSE|$)|ELSE(.*?)(?=$)/;
        this.originalCaseStatement = "";
        this.originalFunctionString = "";
        this.firstCase = true;

        let functionString = SelectTables.toUpperCaseExceptQuoted(calculatedFormula);

        for (const func of sqlFunctions) {
            let args = SelectTables.parseForFunctions(functionString, func);

            [args, functionString] = this.caseStart(func, args, functionString);

            while (args !== null && args.length > 0) {
                // Split on COMMA, except within brackets.
                const parms = typeof args[1] === 'undefined' ? [] : SelectTables.parseForParams(args[1]);

                let replacement = "";
                switch (func) {
                    case "ABS":
                        replacement = `Math.abs(${parms[0]})`;
                        break;
                    case "CASE":
                        replacement = this.caseWhen(args);
                        break;
                    case "CEILING":
                        replacement = `Math.ceil(${parms[0]})`;
                        break;
                    case "CHARINDEX":
                        replacement = SqlServerFunctions.charIndex(parms);
                        break;
                    case "FLOOR":
                        replacement = `Math.floor(${parms[0]})`;
                        break;
                    case "IF":
                        const ifCond = SqlParse.sqlCondition2JsCondition(parms[0]);
                        replacement = `${ifCond} ? ${parms[1]} : ${parms[2]};`;
                        break;
                    case "LEFT":
                        replacement = `${parms[0]}.substring(0,${parms[1]})`;
                        break;
                    case "LEN":
                    case "LENGTH":
                        replacement = `${parms[0]}.length`;
                        break;
                    case "LOG":
                        replacement = `Math.log2(${parms[0]})`;
                        break;
                    case "LOG10":
                        replacement = `Math.log10(${parms[0]})`;
                        break;
                    case "LOWER":
                        replacement = `${parms[0]}.toLowerCase()`;
                        break;
                    case "LTRIM":
                        replacement = `${parms[0]}.trimStart()`;
                        break;
                    case "NOW":
                        replacement = "new Date().toLocaleString()";
                        break;
                    case "POWER":
                        replacement = `Math.pow(${parms[0]},${parms[1]})`;
                        break;
                    case "RAND":
                        replacement = "Math.random()";
                        break;
                    case "REPLICATE":
                        replacement = `${parms[0]}.repeat(${parms[1]})`;
                        break;
                    case "REVERSE":
                        replacement = `${parms[0]}.split("").reverse().join("")`;
                        break;
                    case "RIGHT":
                        replacement = `${parms[0]}.slice(${parms[0]}.length - ${parms[1]})`;
                        break;
                    case "ROUND":
                        replacement = `Math.round(${parms[0]})`;
                        break;
                    case "RTRIM":
                        replacement = `${parms[0]}.trimEnd()`;
                        break;
                    case "SPACE":
                        replacement = `' '.repeat(${parms[0]})`;
                        break;
                    case "STUFF":
                        replacement = `${parms[0]}.substring(0,${parms[1]}-1) + ${parms[3]} + ${parms[0]}.substring(${parms[1]} + ${parms[2]} - 1)`;
                        break;
                    case "SUBSTRING":
                        replacement = `${parms[0]}.substring(${parms[1]} - 1, ${parms[1]} + ${parms[2]} - 1)`;
                        break;
                    case "SQRT":
                        replacement = `Math.sqrt(${parms[0]})`;
                        break;
                    case "TRIM":
                        replacement = `${parms[0]}.trim()`;
                        break;
                    case "UPPER":
                        replacement = `${parms[0]}.toUpperCase()`;
                        break;
                    default:
                        throw new Error(`Internal Error. Function is missing. ${func}`);
                }

                functionString = functionString.replace(args[0], replacement);

                args = this.parseFunctionArgs(func, functionString);
            }

            functionString = this.caseEnd(func, functionString);
        }

        return functionString;
    }

    /**
     * 
     * @param {String} func 
     * @param {String} functionString 
     * @returns {String[]}
     */
    parseFunctionArgs(func, functionString) {
        let args = [];

        if (func === "CASE")
            args = functionString.match(this.matchCaseWhenThenStr);
        else
            args = SelectTables.parseForFunctions(functionString, func);

        return args;
    }

    /**
     * 
     * @param {any[]} parms 
     * @returns {String}
     */
    static charIndex(parms) {
        let replacement = "";

        if (typeof parms[2] === 'undefined')
            replacement = `${parms[1]}.indexOf(${parms[0]}) + 1`;
        else
            replacement = `${parms[1]}.indexOf(${parms[0]},${parms[2]} -1) + 1`;

        return replacement;
    }

    /**
     * 
     * @param {String} func 
     * @param {any[]} args 
     * @param {String} functionString 
     * @returns {[any[], String]}
     */
    caseStart(func, args, functionString) {
        let caseArguments = args;
        if (func === "CASE") {
            caseArguments = functionString.match(/CASE(.*?)END/i);

            if (caseArguments !== null && caseArguments.length > 1) {
                this.firstCase = true;
                this.originalFunctionString = functionString;
                this.originalCaseStatement = caseArguments[0];
                functionString = caseArguments[1];

                caseArguments = caseArguments[1].match(this.matchCaseWhenThenStr);
            }
        }

        return [caseArguments, functionString];
    }

    /**
     * 
     * @param {any[]} args 
     * @returns {String}
     */
    caseWhen(args) {
        let replacement = "";

        if (args.length > 2) {
            if (typeof args[1] === 'undefined' && typeof args[2] === 'undefined') {
                replacement = `else return ${args[3]};`;
            }
            else {
                if (this.firstCase) {
                    replacement = "(() => {if (";
                    this.firstCase = false;
                }
                else
                    replacement = "else if (";
                replacement += `${SqlParse.sqlCondition2JsCondition(args[1])}) return ${args[2]} ;`;
            }
        }

        return replacement;
    }

    /**
     * 
     * @param {String} func 
     * @param {String} funcString 
     * @returns {String}
     */
    caseEnd(func, funcString) {
        let functionString = funcString;

        if (func === "CASE" && this.originalFunctionString !== "") {
            functionString += "})();";      //  end of lambda.
            functionString = this.originalFunctionString.replace(this.originalCaseStatement, functionString);
        }

        return functionString;
    }
}

class ConglomerateRecord {
    /**
     * 
     * @param {TableField[]} virtualFields 
     */
    constructor(virtualFields) {
        this.selectVirtualFields = virtualFields;
    }

    /**
     * 
     * @param {any[]} groupRecords 
     * @returns 
     */
    squish(groupRecords) {
        const row = [];
        if (groupRecords.length === 0)
            return row;

        let i = 0;
        for (/** @type {TableField} */ const field of this.selectVirtualFields) {
            if (field.aggregateFunction === "")
                row.push(groupRecords[0][i]);
            else {
                row.push(ConglomerateRecord.aggregateColumn(field, groupRecords, i));
            }
            i++;
        }
        return row;
    }

    /**
     * 
     * @param {TableField} field 
     * @param {any[]} groupRecords 
     * @param {Number} columnIndex 
     * @returns {Number}
     */
    static aggregateColumn(field, groupRecords, columnIndex) {
        let groupValue = 0;
        let avgCounter = 0;
        let first = true;

        for (const groupRow of groupRecords) {
            if (groupRow[columnIndex] === 'null')
                continue;

            let data = parseFloat(groupRow[columnIndex]);
            data = (isNaN(data)) ? 0 : data;

            switch (field.aggregateFunction) {
                case "SUM":
                    groupValue += data;
                    break;
                case "COUNT":
                    groupValue++;
                    break;
                case "MIN":
                    groupValue = ConglomerateRecord.minCase(first, groupValue, data);
                    break;
                case "MAX":
                    groupValue = ConglomerateRecord.maxCase(first, groupValue, data);
                    break;
                case "AVG":
                    avgCounter++;
                    groupValue += data;
                    break;
                default:
                    throw new Error(`Invalid aggregate function: ${field.aggregateFunction}`);
            }
            first = false;
        }

        if (field.aggregateFunction === "AVG")
            groupValue = groupValue / avgCounter;

        return groupValue;
    }

    /**
     * 
     * @param {Boolean} first 
     * @param {Number} value 
     * @param {Number} data 
     * @returns {Number}
     */
    static minCase(first, value, data) {
        let groupValue = value;
        if (first)
            groupValue = data;
        if (data < groupValue)
            groupValue = data;

        return groupValue;
    }

    /**
     * 
     * @param {Boolean} first 
     * @param {Number} value 
     * @param {Number} data 
     * @returns {Number}
     */
    static maxCase(first, value, data) {
        let groupValue = value;
        if (first)
            groupValue = data;
        if (data > groupValue)
            groupValue = data;

        return groupValue;
    }
}

class TableFields {
    constructor() {
        /** @type {TableField[]} */
        this.allFields = [];
        /** @type {Map<String, TableField>} */
        this.fieldNameMap = new Map();
        /** @type {Map<String, TableField>} */
        this.tableColumnMap = new Map();
    }

    /**
     * Iterate through all table fields and create a list of these VirtualFields.
     * @param {String} primaryTable
     * @param {Map<String,Table>} tableInfo  
     */
    loadVirtualFields(primaryTable, tableInfo) {
        /** @type {String} */
        let tableName = "";
        /** @type {Table} */
        let tableObject = null;
        // @ts-ignore
        for ([tableName, tableObject] of tableInfo.entries()) {
            const validFieldNames = tableObject.getAllFieldNames();

            for (const field of validFieldNames) {
                const tableColumn = tableObject.getFieldColumn(field);
                if (tableColumn !== -1) {
                    let virtualField = this.findTableField(tableName, tableColumn);
                    if (virtualField !== null) {
                        virtualField.addAlias(field);
                    }
                    else {
                        virtualField = new TableField()
                            .setOriginalTable(tableName)
                            .setOriginalTableColumn(tableColumn)
                            .addAlias(field)
                            .setIsPrimaryTable(primaryTable.toUpperCase() === tableName.toUpperCase())
                            .setTableInfo(tableObject);

                        this.allFields.push(virtualField);
                    }

                    this.indexTableField(virtualField, primaryTable.toUpperCase() === tableName.toUpperCase());
                }
            }
        }

        this.allFields.sort(TableFields.sortPrimaryFields);
    }

    /**
     * 
     * @param {TableField} fldA 
     * @param {TableField} fldB 
     */
    static sortPrimaryFields(fldA, fldB) {
        let keyA = fldA.isPrimaryTable ? 0 : 1000;
        let keyB = fldB.isPrimaryTable ? 0 : 1000;

        keyA += fldA.originalTableColumn;
        keyB += fldB.originalTableColumn;

        if (keyA < keyB)
            return -1;
        else if (keyA > keyB)
            return 1;
        return 0;
    }

    /**
     * 
     * @param {TableField} field 
     * @param {Boolean} isPrimaryTable
     */
    indexTableField(field, isPrimaryTable = false) {
        for (const aliasField of field.aliasNames) {
            const fieldInfo = this.fieldNameMap.get(aliasField.toUpperCase());

            if (typeof fieldInfo === 'undefined' || isPrimaryTable) {
                this.fieldNameMap.set(aliasField.toUpperCase(), field);
            }
        }

        const key = `${field.originalTable}:${field.originalTableColumn}`;
        if (!this.tableColumnMap.has(key))
            this.tableColumnMap.set(key, field);
    }

    /**
     * 
     * @param {String} tableName 
     * @param {Number} tableColumn 
     * @returns {TableField}
     */
    findTableField(tableName, tableColumn) {
        const key = `${tableName}:${tableColumn}`;

        if (!this.tableColumnMap.has(key)) {
            return null;
        }

        return this.tableColumnMap.get(key);
    }

    /**
     * 
     * @param {String} field 
     * @returns {Boolean}
     */
    hasField(field) {
        return this.fieldNameMap.has(field.toUpperCase());
    }

    /**
     * 
     * @param {String} field 
     * @returns {TableField}
     */
    getFieldInfo(field) {
        return this.fieldNameMap.get(field.toUpperCase());
    }

    /**
     * 
     * @param {String} field 
     * @returns {Table}
     */
    getTableInfo(field) {
        const fldInfo = this.getFieldInfo(field);
        return fldInfo.tableInfo;
    }

    /**
     * 
     * @param {String} field 
     * @returns {Number}
     */
    getFieldColumn(field) {
        const fld = this.getFieldInfo(field);
        if (fld !== null) {
            return fld.tableColumn;
        }

        return -1;
    }

    /**
     * 
     * @param {String} field 
     * @returns {Number}
     */
    getSelectFieldColumn(field) {
        const fld = this.getFieldInfo(field);
        if (fld !== null) {
            return fld.selectColumn;
        }

        return -1;
    }

    /**
     * Updates internal SELECTED field list.
     * @param {*} astFields 
     */
    updateSelectFieldList(astFields) {
        let i = 0;
        for (const selField of astFields) {
            const [columnName, aggregateFunctionName, calculatedField] = this.getSelectFieldNames(selField);
            const columnTitle = (typeof selField.as !== 'undefined' && selField.as !== "" ? selField.as : selField.name);

            if (calculatedField === null && this.hasField(columnName)) {
                let fieldInfo = this.getFieldInfo(columnName);
                if (aggregateFunctionName !== "" || fieldInfo.selectColumn !== -1) {
                    const newFieldInfo = new TableField();
                    Object.assign(newFieldInfo, fieldInfo);
                    fieldInfo = newFieldInfo;

                    this.allFields.push(fieldInfo);
                }

                fieldInfo
                    .setAggregateFunction(aggregateFunctionName)
                    .setColumnTitle(columnTitle)
                    .setColumnName(selField.name)
                    .setSelectColumn(i);

                this.indexTableField(fieldInfo);
            }
            else if (calculatedField !== null) {
                const fieldInfo = new TableField();
                this.allFields.push(fieldInfo);

                fieldInfo
                    .setColumnTitle(columnTitle)
                    .setColumnName(selField.name)
                    .setSelectColumn(i)
                    .setCalculatedFormula(selField.name);

                this.indexTableField(fieldInfo);
            }
            else {
                const fieldInfo = new TableField();
                this.allFields.push(fieldInfo);

                fieldInfo
                    .setCalculatedFormula(columnName)
                    .setAggregateFunction(aggregateFunctionName)
                    .setSelectColumn(i)
                    .setColumnName(selField.name)
                    .setColumnTitle(columnTitle);

                this.indexTableField(fieldInfo);
            }
            i++;
        }
    }

    /**
     * @returns {TableField[]}
     */
    getSelectFields() {
        const selectedFields = this.allFields.filter((a) => a.selectColumn !== -1);
        selectedFields.sort((a, b) => a.selectColumn - b.selectColumn);

        return selectedFields;
    }

    /**
     * 
     * @returns {String[]}
     */
    getColumnNames() {
        const columnNames = [];

        for (const fld of this.getSelectFields()) {
            columnNames.push(fld.columnName);
        }

        return columnNames;
    }

    /**
     * 
     * @returns {String[]}
     */
    getColumnTitles() {
        const columnTitles = [];

        for (const fld of this.getSelectFields()) {
            columnTitles.push(fld.columnTitle);
        }

        return columnTitles;
    }

    /**
     * 
     * @param {DerivedTable} derivedTable 
     */
    updateDerivedTableVirtualFields(derivedTable) {
        const derivedTableFields = derivedTable.tableInfo.getAllVirtualFields();

        let fieldNo = 0;
        for (const field of derivedTableFields) {
            if (this.hasField(field.fieldName)) {
                const originalField = this.getFieldInfo(field.fieldName);
                originalField.derivedTableColumn = fieldNo;
                originalField.tableInfo = derivedTable.tableInfo;
            }

            fieldNo++;
        }
    }

    /**
     * 
     * @param {Object} selField 
     * @returns {any[]}
     */
    getSelectFieldNames(selField) {
        let columnName = selField.name;
        let aggregateFunctionName = "";
        const calculatedField = (typeof selField.terms === 'undefined') ? null : selField.terms;

        if (calculatedField === null && !this.hasField(columnName)) {
            const functionNameRegex = /^\w+\s*(?=\()/;
            let matches = columnName.match(functionNameRegex)
            if (matches !== null && matches.length > 0)
                aggregateFunctionName = matches[0].trim();

            matches = SelectTables.parseForFunctions(columnName, aggregateFunctionName);
            if (matches !== null && matches.length > 1)
                columnName = matches[1];
        }

        return [columnName, aggregateFunctionName, calculatedField];
    }

    /**
     * 
     * @returns {Number}
     */
    getConglomerateFieldCount() {
        let count = 0;
        for (/** @type {TableField} */ const field of this.getSelectFields()) {
            if (field.aggregateFunction !== "")
                count++;
        }

        return count;
    }
}

class TableField {
    constructor() {
        this.originalTable = "";
        this.originalTableColumn = -1;
        this.aliasNames = [];
        this.fieldName = "";
        this.derivedTableColumn = -1;
        this.selectColumn = -1;
        this.calculatedFormula = "";
        this.aggregateFunction = "";
        this.columnTitle = "";
        this.columnName = "";
        this._isPrimaryTable = false;
        /** @type {Table} */
        this.tableInfo = null;
    }

    /**
     * @returns {Number}
     */
    get tableColumn() {
        return this.derivedTableColumn === -1 ? this.originalTableColumn : this.derivedTableColumn;
    }

    /**
     * 
     * @param {String} table 
     * @returns {TableField}
     */
    setOriginalTable(table) {
        this.originalTable = table.trim().toUpperCase();
        return this;
    }

    /**
     * 
     * @param {Number} column 
     * @returns {TableField}
     */
    setOriginalTableColumn(column) {
        this.originalTableColumn = column;
        return this;
    }

    /**
     * 
     * @param {String} columnAlias 
     * @returns {TableField}
     */
    addAlias(columnAlias) {
        const alias = columnAlias.trim().toUpperCase();
        if (this.fieldName === "" || alias.indexOf(".") !== -1) {
            this.fieldName = alias;
        }

        if (this.aliasNames.indexOf(alias) === -1) {
            this.aliasNames.push(alias);
        }

        return this;
    }

    /**
     * 
     * @param {Number} column 
     * @returns {TableField}
     */
    setSelectColumn(column) {
        this.selectColumn = column;

        return this;
    }

    /**
     * 
     * @param {String} value 
     * @returns {TableField}
     */
    setAggregateFunction(value) {
        this.aggregateFunction = value.toUpperCase();
        return this;
    }

    /**
     * 
     * @param {String} value 
     * @returns {TableField}
     */
    setCalculatedFormula(value) {
        this.calculatedFormula = value;
        return this;
    }

    /**
     * 
     * @param {String} column 
     * @returns {TableField}
     */
    setColumnTitle(column) {
        this.columnTitle = column;
        return this;
    }

    /**
     * 
     * @param {String} columnName 
     * @returns {TableField}
     */
    setColumnName(columnName) {
        this.columnName = columnName;
        return this;
    }

    /**
     * 
     * @param {Boolean} isPrimary 
     * @returns {TableField}
     */
    setIsPrimaryTable(isPrimary) {
        this._isPrimaryTable = isPrimary;
        return this;
    }

    /**
     * @returns {Boolean}
     */
    get isPrimaryTable() {
        return this._isPrimaryTable;
    }

    /**
     * 
     * @param {Table} tableInfo 
     * @returns {TableField}
     */
    setTableInfo(tableInfo) {
        this.tableInfo = tableInfo;
        return this;
    }

    /**
     * 
     * @param {Number} tableRow 
     * @returns {any}
     */
    getData(tableRow) {
        const columnNumber = this.derivedTableColumn === -1 ? this.originalTableColumn : this.derivedTableColumn;
        if (tableRow < 0 || columnNumber < 0)
            return "";

        return this.tableInfo.tableData[tableRow][columnNumber];
    }
}
//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { Sql, gsSQL, parseTableSettings };
import { Table } from './Table.js';
import { TableData } from './TableData.js';
import { SqlParse } from './SimpleParser.js';
import { SelectTables } from './Views.js';

class Logger {
    static log(msg) {
        console.log(msg);
    }
}
//  *** DEBUG END  ***/

/**
 * Query any sheet range using standard SQL SELECT syntax.
 * Parameter 1.  SELECT statement.  All regular syntax is supported including JOIN. 
 *   note i)  Bind variables (?) are replaced by bind data specified later.
 *   note ii)  PIVOT field supported.  Similar to QUERY. e.g.  "SELECT date, sum(quantity) from sales group by date pivot customer_id".
 *   note iii) If parm 2 not used and sheet name contains a space, use single quotes around table name.
 * Parameter 2. (optional. referenced tables assumed to be SHEET NAME with column titles)    
 *   Define all tables referenced in SELECT. This is a DOUBLE ARRAY and is done using the curly bracket {{a,b,c}; {a,b,c}} syntax.
 *   a)  table name - the table name referenced in SELECT for indicated range.
 *   b)  sheet range - (optional) either NAMED RANGE, A1 notation range, SHEET NAME or empty (table name used as sheet name).  This input is a string.  The first row of each range MUST be unique column titles.
 *   c)  cache seconds - (optional) time loaded range held in cache.  default=60.   
 * Parameter 3. (optional) Output result column title (true/false). default=true.   
 * Parameter 4... (optional) Bind variables.  List as many as required to match ? in SELECT.
 * @param {String} statement - SQL (e.g.:  'select * from expenses')
 * @param {any[][]} tableArr - {{"tableName", "sheetRange", cacheSeconds}; {"name","range",cache};...}"
 * @param {Boolean} columnTitle - TRUE will add column title to output (default=TRUE)
 * @param {...any} bindings - Bind variables to match '?' in SQL statement.
 * @returns {any[][]}
 * @customfunction
 */
function gsSQL(statement, tableArr = [], columnTitle = true, ...bindings) {
    const tableList = parseTableSettings(tableArr, statement);

    Logger.log(`gsSQL: tableList=${tableList}.  Statement=${statement}. List Len=${tableList.length}`);

    const sqlCmd = new Sql().enableColumnTitle(columnTitle);
    for (const bind of bindings) {
        sqlCmd.addBindParameter(bind);
    }
    for (const tableDef of tableList) {
        sqlCmd.addTableData(tableDef[0], tableDef[1], tableDef[2]);
    }
    return sqlCmd.execute(statement);
}

/**
 * 
 * @param {any[][]} tableArr 
 * @param {String} statement
 * @param {Boolean} randomOrder
 * @returns {any[][]}
 */
function parseTableSettings(tableArr, statement = "", randomOrder = true) {
    let tableList = [];
    let referencedTableSettings = tableArr;

    //  Get table names from the SELECT statement when no table range info is given.
    if (tableArr.length === 0 && statement !== "") {
        referencedTableSettings = Sql.getReferencedTableNames(statement);
    }

    if (referencedTableSettings.length === 0) {
        throw new Error('Missing table definition {{"name","range",cache};{...}}');
    }

    Logger.log(`tableArr = ${referencedTableSettings}`);
    for (/** @type {any[]} */ const table of referencedTableSettings) {
        if (table.length === 1)
            table.push(table[0]);   // if NO RANGE, assumes table name is sheet name.
        if (table.length === 2)
            table.push(60);      //  default 0 second cache.
        if (table[1] === "")
            table[1] = table[0];    //  If empty range, assumes TABLE NAME is the SHEET NAME and loads entire sheet.
        if (table.length !== 3)
            throw new Error("Invalid table definition [name,range,cache]");

        tableList.push(table);
    }

    //  If called at the same time, loading similar tables in similar order - all processes
    //  just wait for table - but if loaded in different order, each process could be loading something.
    if (randomOrder)
        tableList = tableList.sort(() => Math.random() - 0.5);

    return tableList;
}


class Sql {
    constructor() {
        /** @type {Map<String,Table>} */
        this.tables = new Map();
        this.columnTitle = false;
        this.bindParameters = [];
    }

    /**
     * 
     * @param {String} tableName - Name of table referenced in SELECT.
     * @param {any} tableData - Either double array or a named range.
     * @param {Number} cacheSeconds - How long should loaded data be cached (default=0)
     * @returns {Sql}
     */
    addTableData(tableName, tableData, cacheSeconds = 0) {
        let tableInfo = null;

        if (Array.isArray(tableData)) {
            tableInfo = new Table(tableName)
                .loadArrayData(tableData);
        }
        else {
            tableInfo = new Table(tableName)
                .loadNamedRangeData(tableData, cacheSeconds);
        }

        this.tables.set(tableName.toUpperCase(), tableInfo);

        return this;
    }

    /**
     * Include column headers in return data.
     * @param {Boolean} value - true will return column names in first row of return data.
     * @returns {Sql}
     */
    enableColumnTitle(value) {
        this.columnTitle = value;
        return this;
    }

    /**
     * 
     * @param {any} value 
     * @returns {Sql}
     */
    addBindParameter(value) {
        this.bindParameters.push(value);
        return this;
    }

    /**
     * The BIND data is a sheet named range that will be read and used for bind data.
     * @param {String} value 
     * @returns {Sql}
     */
    addBindNamedRangeParameter(value) {
        const namedValue = TableData.getValueCached(value, 30);
        this.bindParameters.push(namedValue);
        Logger.log("BIND=" + value + " = " + namedValue);
        return this;
    }

    /**
     * 
     * @param {any[]} value 
     * @returns {Sql}
     */
    setBindValues(value) {
        this.bindParameters = value;
        return this;
    }

    /**
     * 
     * @returns {Sql}
     */
    clearBindParameters() {
        this.bindParameters = [];
        return this;
    }

    /**
    * After command is parsed, perform SQL function.
    * Execute() can be called multiple times for different SELECT statements, provided that all required
    * table data was loaded in the constructor.
    * @param {String} statement
    * @returns {any[][]}
    */
    execute(statement) {
        let sqlData = [];

        this.ast = SqlParse.sql2ast(statement);

        // @ts-ignore
        for (const table of this.tables.keys()) {
            const tableAlias = this.getTableAlias(table, this.ast);
            const tableInfo = this.tables.get(table.toUpperCase());
            tableInfo
                .setTableAlias(tableAlias)
                .loadSchema();
        }

        if (typeof this.ast.SELECT !== 'undefined')
            sqlData = this.select(this.ast);
        else
            throw new Error("Only SELECT statements are supported.");

        return sqlData;
    }

    /**
     * 
    * @param {Map<String,Table>} mapOfTables 
    */
    setTables(mapOfTables) {
        this.tables = mapOfTables;
        return this;
    }


    /**
    * Find table alias name (if any) for input actual table name.
    * @param {String} tableName - Actual table name.
    * @param {Object} ast - Abstract Syntax Tree for SQL.
    * @returns {String}
    */
    getTableAlias(tableName, ast) {
        let tableAlias = "";
        const ucTableName = tableName.toUpperCase();

        tableAlias = Sql.getTableAliasFromJoin(tableAlias, ucTableName, ast);
        tableAlias = this.getTableAliasUnion(tableAlias, ucTableName, ast);
        tableAlias = this.getTableAliasWhereIn(tableAlias, ucTableName, ast);
        tableAlias = this.getTableAliasWhereTerms(tableAlias, ucTableName, ast);

        return tableAlias;
    }

    /**
     * 
     * @param {String} tableAlias 
     * @param {String} tableName 
     * @param {Object} ast 
     * @returns {String}
     */
    static getTableAliasFromJoin(tableAlias, tableName, ast) {
        const astTableBlocks = ['FROM', 'JOIN'];

        let i = 0;
        while (tableAlias === "" && i < astTableBlocks.length) {
            tableAlias = Sql.locateAstTableAlias(tableName, ast, astTableBlocks[i]);
            i++;
        }

        return tableAlias;
    }

    /**
     * 
     * @param {String} tableAlias 
     * @param {String} tableName 
     * @param {Object} ast 
     * @returns {String}
     */
    getTableAliasUnion(tableAlias, tableName, ast) {
        const astRecursiveTableBlocks = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];

        let i = 0;
        while (tableAlias === "" && i < astRecursiveTableBlocks.length) {
            if (typeof ast[astRecursiveTableBlocks[i]] !== 'undefined') {
                for (const unionAst of ast[astRecursiveTableBlocks[i]]) {
                    tableAlias = this.getTableAlias(tableName, unionAst);

                    if (tableAlias !== "")
                        break;
                }
            }
            i++;
        }

        return tableAlias;
    }

    /**
     * 
     * @param {String} tableAlias 
     * @param {String} tableName 
     * @param {Object} ast 
     * @returns {String}
     */
    getTableAliasWhereIn(tableAlias, tableName, ast) {
        if (tableAlias === "" && typeof ast.WHERE !== 'undefined' && ast.WHERE.operator === "IN") {
            tableAlias = this.getTableAlias(tableName, ast.WHERE.right);
        }

        if (tableAlias === "" && ast.operator === "IN") {
            tableAlias = this.getTableAlias(tableName, ast.right);
        }

        return tableAlias;
    }

    /**
     * 
     * @param {String} tableAlias 
     * @param {String} tableName 
     * @param {Object} ast 
     * @returns {String}
     */
    getTableAliasWhereTerms(tableAlias, tableName, ast) {
        let extractedTableAlias =  tableAlias;
        if (tableAlias === "" && typeof ast.WHERE !== 'undefined' && typeof ast.WHERE.terms !== 'undefined') {
            for (const term of ast.WHERE.terms) {
                if (extractedTableAlias === "")
                extractedTableAlias = this.getTableAlias(tableName, term);
            }
        }

        return extractedTableAlias;
    }

    /**
     * 
     * @param {String} statement 
     * @returns {String[][]}
     */
    static getReferencedTableNames(statement) {
        const tableSet = new Set();
        const ast = SqlParse.sql2ast(statement);

        Sql.extractAstTables(ast, tableSet);

        const tableList = [];
        // @ts-ignore
        for (const table of tableSet) {
            tableList.push([table]);
        }

        return tableList;
    }

    /**
     * 
     * @param {Object} ast 
     * @param {Set} tableSet 
     */
    static extractAstTables(ast, tableSet) {
        Sql.getTableNamesFromOrJoin(ast, tableSet);
        Sql.getTableNamesUnion(ast, tableSet);
        Sql.getTableNamesWhereIn(ast, tableSet);
        Sql.getTableNamesWhereTerms(ast, tableSet);
    }

    /**
     * 
     * @param {Object} ast 
     * @param {Set} tableSet 
     */
    static getTableNamesFromOrJoin(ast, tableSet) {
        const astTableBlocks = ['FROM', 'JOIN'];

        for (const astBlock of astTableBlocks) {
            if (typeof ast[astBlock] === 'undefined')
                continue;

            const blockData = ast[astBlock];
            for (const astItem of blockData) {
                tableSet.add(astItem.table.toUpperCase());
            }
        }
    }

    /**
     * 
     * @param {Object} ast 
     * @param {Set} tableSet 
     */
    static getTableNamesUnion(ast, tableSet) {
        const astRecursiveTableBlocks = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];

        for (const block of astRecursiveTableBlocks) {
            if (typeof ast[block] !== 'undefined') {
                for (const unionAst of ast[block]) {
                    this.extractAstTables(unionAst, tableSet);
                }
            }
        }
    }

    /**
     * 
     * @param {Object} ast 
     * @param {Set} tableSet 
     */
    static getTableNamesWhereIn(ast, tableSet) {
        //  where IN ().
        if (typeof ast.WHERE !== 'undefined' && ast.WHERE.operator === "IN") {
            this.extractAstTables(ast.WHERE.right, tableSet);
        }

        if (ast.operator === "IN") {
            this.extractAstTables(ast.right, tableSet);
        }
    }
    
    /**
     * 
     * @param {Object} ast 
     * @param {Set} tableSet 
     */
    static getTableNamesWhereTerms(ast, tableSet) {
        if (typeof ast.WHERE !== 'undefined' && typeof ast.WHERE.terms !== 'undefined') {
            for (const term of ast.WHERE.terms) {
                this.extractAstTables(term, tableSet);
            }
        }
    }

    /**
     * 
     * @param {String} tableName 
     * @param {Object} ast 
     * @param {String} astBlock 
     * @returns {String}
     */
    static locateAstTableAlias(tableName, ast, astBlock) {
        if (typeof ast[astBlock] === 'undefined')
            return "";

        for (const astItem of ast[astBlock]) {
            if (tableName === astItem.table.toUpperCase() && astItem.as !== "") {
                return astItem.as;
            }
        }

        return "";
    }

    /**
     * Load SELECT data and return in double array.
     * @param {Object} selectAst 
     * @returns {any[][]}
     */
    select(selectAst) {
        let recordIDs = [];
        let viewTableData = [];
        let ast = selectAst;

        if (typeof ast.FROM === 'undefined')
            throw new Error("Missing keyword FROM");

        //  Manipulate AST to add GROUP BY if DISTINCT keyword.
        ast = Sql.distinctField(ast);

        //  Manipulate AST add pivot fields.
        ast = this.pivotField(ast);

        const view = new SelectTables(ast.FROM, ast.SELECT, this.tables, this.bindParameters);

        //  JOIN tables to create a derived table.
        view.join(ast);

        //  Get the record ID's of all records matching WHERE condition.
        recordIDs = view.whereCondition(ast);

        //  Get selected data records.
        viewTableData = view.getViewData(recordIDs);

        //  Compress the data.
        viewTableData = view.groupBy(ast, viewTableData);

        //  Sort our selected data.
        view.orderBy(ast, viewTableData);

        if (typeof ast.LIMIT !== 'undefined') {
            const maxItems = ast.LIMIT.nb;
            if (viewTableData.length > maxItems)
                viewTableData.splice(maxItems);
        }

        //  Apply SET rules for various union types.
        viewTableData = this.unionSets(ast, viewTableData);

        if (this.columnTitle)
            viewTableData.unshift(view.getColumnTitles());
        else if (viewTableData.length === 1 && viewTableData[0].length === 0)
            viewTableData[0] = [""];

        return viewTableData;
    }

    /**
     * If 'GROUP BY' is not set and 'DISTINCT' column is specified, update AST to add 'GROUP BY'.
     * @param {Object} ast 
     * @returns {Object}
     */
    static distinctField(ast) {
        const astFields = ast.SELECT;

        if (astFields.length > 0) {
            const firstField = astFields[0].name.toUpperCase();
            if (firstField.startsWith("DISTINCT")) {
                astFields[0].name = firstField.replace("DISTINCT", "").trim();

                if (typeof ast['GROUP BY'] === 'undefined') {
                    const groupBy = [];

                    for (const astItem of astFields) {
                        groupBy.push({ column: astItem.name });
                    }

                    ast["GROUP BY"] = groupBy;
                }
            }
        }

        return ast;
    }

    /**
     * Add new column to AST for every AGGREGATE function and unique pivot column data.
     * @param {Object} ast 
     * @returns {Object}
     */
    pivotField(ast) {
        //  If we are doing a PIVOT, it then requires a GROUP BY.
        if (typeof ast.PIVOT !== 'undefined') {
            if (typeof ast['GROUP BY'] === 'undefined')
                throw new Error("PIVOT requires GROUP BY");
        }
        else
            return ast;

        // These are all of the unique PIVOT field data points.
        const pivotFieldData = this.getUniquePivotData(ast);

        ast.SELECT = Sql.addCalculatedPivotFieldsToAst(ast, pivotFieldData);

        return ast;
    }

    /**
     * Find distinct pivot column data.
     * @param {Object} ast 
     * @returns {any[][]}
     */
    getUniquePivotData(ast) {
        const pivotAST = {};

        pivotAST.SELECT = ast.PIVOT;
        pivotAST.SELECT[0].name = `DISTINCT ${pivotAST.SELECT[0].name}`;
        pivotAST.FROM = ast.FROM;
        pivotAST.WHERE = ast.WHERE;

        // These are all of the unique PIVOT field data points.
        const oldSetting = this.columnTitle;
        const oldBindVariables = [...this.bindParameters];
        this.columnTitle = false;
        const tableData = this.select(pivotAST);
        this.columnTitle = oldSetting;
        this.bindParameters = oldBindVariables;

        return tableData;
    }

    /**
     * 
     * @param {Object} ast 
     * @param {any[][]} pivotFieldData 
     * @returns {Object}
     */
    static addCalculatedPivotFieldsToAst(ast, pivotFieldData) {
        const newPivotAstFields = [];

        for (const selectField of ast.SELECT) {
            //  If this is an aggregrate function, we will add one for every pivotFieldData item
            const functionNameRegex = /^\w+\s*(?=\()/;
            const matches = selectField.name.match(functionNameRegex)
            if (matches !== null && matches.length > 0) {
                const args = SelectTables.parseForFunctions(selectField.name, matches[0].trim());

                for (const fld of pivotFieldData) {
                    const caseTxt = matches[0] + "(CASE WHEN " + ast.PIVOT[0].name + " = '" + fld + "' THEN " + args[1] + " ELSE 'null' END)";
                    const asField = fld[0] + " " + (typeof selectField.as !== 'undefined' && selectField.as !== "" ? selectField.as : selectField.name);
                    newPivotAstFields.push({ name: caseTxt, as: asField });
                }
            }
            else
                newPivotAstFields.push(selectField);
        }

        return newPivotAstFields;
    }

    /**
     * 
     * @param {Object} ast 
     * @param {any[][]} viewTableData 
     * @returns {any[][]}
     */
    unionSets(ast, viewTableData) {
        const unionTypes = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];
        let unionTableData = viewTableData;

        for (const type of unionTypes) {
            if (typeof ast[type] !== 'undefined') {
                const unionSQL = new Sql()
                    .setBindValues(this.bindParameters)
                    .setTables(this.tables);
                for (const union of ast[type]) {
                    const unionData = unionSQL.select(union);
                    if (unionTableData.length > 0 && unionData.length > 0 && unionTableData[0].length !== unionData[0].length)
                        throw new Error(`Invalid ${type}.  Selected field counts do not match.`);

                    switch (type) {
                        case "UNION":
                            //  Remove duplicates.
                            unionTableData = Sql.appendUniqueRows(unionTableData, unionData);
                            break;

                        case "UNION ALL":
                            //  Allow duplicates.
                            unionTableData = unionTableData.concat(unionData);
                            break;

                        case "INTERSECT":
                            //  Must exist in BOTH tables.
                            unionTableData = Sql.intersectRows(unionTableData, unionData);
                            break;

                        case "EXCEPT":
                            //  Remove from first table all rows that match in second table.
                            unionTableData = Sql.exceptRows(unionTableData, unionData);
                            break;

                        default:
                            throw new Error(`Internal error.  Unsupported UNION type: ${type}`);
                    }
                }
            }
        }

        return unionTableData;
    }

    /**
     * 
     * @param {any[][]} srcData 
     * @param {any[][]} newData
     * @returns {any[][]} 
     */
    static appendUniqueRows(srcData, newData) {
        const srcMap = new Map();

        for (const srcRow of srcData) {
            srcMap.set(srcRow.join("::"), true);
        }

        for (const newRow of newData) {
            const key = newRow.join("::");
            if (!srcMap.has(key)) {
                srcData.push(newRow);
                srcMap.set(key, true);
            }
        }
        return srcData;
    }

    /**
     * 
     * @param {any[][]} srcData 
     * @param {any[][]} newData 
     * @returns {any[][]}
     */
    static intersectRows(srcData, newData) {
        const srcMap = new Map();
        const intersectTable = [];

        for (const srcRow of srcData) {
            srcMap.set(srcRow.join("::"), true);
        }

        for (const newRow of newData) {
            if (srcMap.has(newRow.join("::"))) {
                intersectTable.push(newRow);
            }
        }
        return intersectTable;
    }

    /**
     * 
     * @param {any[][]} srcData 
     * @param {any[][]} newData 
     * @returns {any[][]}
     */
    static exceptRows(srcData, newData) {
        const srcMap = new Map();
        let rowNum = 0;
        for (const srcRow of srcData) {
            srcMap.set(srcRow.join("::"), rowNum);
            rowNum++;
        }

        const removeRowNum = [];
        for (const newRow of newData) {
            const key = newRow.join("::");
            if (srcMap.has(key)) {
                removeRowNum.push(srcMap.get(key));
            }
        }

        removeRowNum.sort(function (a, b) { return b - a });
        for (rowNum of removeRowNum) {
            srcData.splice(rowNum, 1);
        }

        return srcData;
    }
}



//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { SqlParse };
//  *** DEBUG END  ***/

//  Code inspired from:  https://github.com/dsferruzza/simpleSqlParser

class SqlParse {
    /**
     * 
     * @param {String} cond 
     * @returns {String}
     */
    static sqlCondition2JsCondition(cond) {
        const ast = SqlParse.sql2ast(`SELECT A FROM c WHERE ${cond}`);
        let sqlData = "";

        if (typeof ast.WHERE !== 'undefined') {
            const conditions = ast.WHERE;
            if (typeof conditions.logic === 'undefined')
                sqlData = SqlParse.resolveSqlCondition("OR", [conditions]);
            else
                sqlData = SqlParse.resolveSqlCondition(conditions.logic, conditions.terms);

        }

        return sqlData;
    }

    /**
     * Parse a query
     * @param {String} query 
     * @returns {Object}
     */
    static sql2ast(query) {
        // Define which words can act as separator
        let myKeyWords = SqlParse.generateUsedKeywordList(query);
        let [parts_name, parts_name_escaped] = SqlParse.generateSqlSeparatorWords(myKeyWords);

        //  Include brackets around separate selects used in things like UNION, INTERSECT...
        let modifiedQuery = SqlParse.sqlStatementSplitter(query);

        // Hide words defined as separator but written inside brackets in the query
        modifiedQuery = SqlParse.hideInnerSql(modifiedQuery, parts_name_escaped, SqlParse.protect);

        // Write the position(s) in query of these separators
        const parts_order = SqlParse.getPositionsOfSqlParts(modifiedQuery, parts_name);

        // Delete duplicates (caused, for example, by JOIN and INNER JOIN)
        SqlParse.removeDuplicateEntries(parts_order);

        // Generate protected word list to reverse the use of protect()
        let words = parts_name_escaped.slice(0);
        words = words.map(function (item) {
            return SqlParse.protect(item);
        });

        // Split parts
        const parts = modifiedQuery.split(new RegExp(parts_name_escaped.join('|'), 'i'));

        // Unhide words precedently hidden with protect()
        for (let i = 0; i < parts.length; i++) {
            parts[i] = SqlParse.hideInnerSql(parts[i], words, SqlParse.unprotect);
        }

        // Analyze parts
        const result = SqlParse.analyzeParts(parts_order, parts);

        // Reorganize joins
        SqlParse.reorganizeJoins(result);

        // Parse conditions
        if (typeof result.WHERE === 'string') {
            result.WHERE = CondParser.parse(result.WHERE);
        }
        if (typeof result.HAVING === 'string') {
            result.HAVING = CondParser.parse(result.HAVING);
        }
        if (typeof result.JOIN !== 'undefined') {
            result.JOIN.forEach(function (item, key) {
                result.JOIN[key].cond = CondParser.parse(item.cond);
            });
        }

        SqlParse.reorganizeUnions(result);

        return result;
    }

    /**
    * 
    * @param {String} logic 
    * @param {Object} terms 
    * @returns {String}
    */
    static resolveSqlCondition(logic, terms) {
        let jsCondition = "";

        for (const cond of terms) {
            if (typeof cond.logic === 'undefined') {
                if (jsCondition !== "" && logic === "AND") {
                    jsCondition += " && ";
                }
                else if (jsCondition !== "" && logic === "OR") {
                    jsCondition += " || ";
                }

                jsCondition += ` ${cond.left}`;
                if (cond.operator === "=")
                    jsCondition += " == ";
                else
                    jsCondition += ` ${cond.operator}`;
                jsCondition += ` ${cond.right}`;
            }
            else {
                jsCondition += SqlParse.resolveSqlCondition(cond.logic, cond.terms);
            }
        }

        return jsCondition;
    }

    /**
     * 
     * @param {String} query
     * @returns {String[]} 
     */
    static generateUsedKeywordList(query) {
        const generatedList = new Set();
        // Define which words can act as separator
        const keywords = ['SELECT', 'FROM', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'ORDER BY', 'GROUP BY', 'HAVING', 'WHERE', 'LIMIT', 'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT', 'PIVOT'];

        let modifiedQuery = query.toUpperCase();

        for (let word of keywords) {
            let pos = 0;
            while (pos !== -1) {
                pos = modifiedQuery.indexOf(word, pos);

                if (pos !== -1) {
                    generatedList.add(query.substring(pos, pos + word.length));
                    pos++;
                }
            }
        }

        // @ts-ignore
        return [...generatedList];
    }

    /**
     * 
     * @param {String[]} keywords 
     * @returns {String[][]}
     */
    static generateSqlSeparatorWords(keywords) {
        let parts_name = keywords.map(function (item) {
            return `${item} `;
        });
        parts_name = parts_name.concat(keywords.map(function (item) {
            return `${item}(`;
        }));
        parts_name = parts_name.concat(parts_name.map(function (item) {
            return item.toLowerCase();
        }));
        const parts_name_escaped = parts_name.map(function (item) {
            return item.replace('(', '[\\(]');
        });

        return [parts_name, parts_name_escaped];
    }

    /**
     * 
     * @param {String} src 
     * @returns {String}
     */
    static sqlStatementSplitter(src) {
        let newStr = src;

        // Define which words can act as separator
        const reg = SqlParse.makeSqlPartsSplitterRegEx(["UNION ALL", "UNION", "INTERSECT", "EXCEPT"]);

        const matchedUnions = newStr.match(reg);
        if (matchedUnions === null || matchedUnions.length === 0)
            return newStr;

        let prefix = "";
        const parts = [];
        let pos = newStr.search(matchedUnions[0]);
        if (pos > 0) {
            prefix = newStr.substring(0, pos);
            newStr = newStr.substring(pos + matchedUnions[0].length);
        }

        for (let i = 1; i < matchedUnions.length; i++) {
            const match = matchedUnions[i];
            pos = newStr.search(match);

            parts.push(newStr.substring(0, pos));
            newStr = newStr.substring(pos + match.length);
        }
        if (newStr.length > 0)
            parts.push(newStr);

        newStr = prefix;
        for (let i = 0; i < matchedUnions.length; i++) {
            newStr += `${matchedUnions[i]} (${parts[i]}) `;
        }

        return newStr;
    }

    /**
     * 
     * @param {String[]} keywords 
     * @returns {RegExp}
     */
    static makeSqlPartsSplitterRegEx(keywords) {
        // Define which words can act as separator
        let parts_name = keywords.map(function (item) {
            return `${item} `;
        });
        parts_name = parts_name.concat(keywords.map(function (item) {
            return `${item}(`;
        }));
        parts_name = parts_name.concat(parts_name.map(function (item) {
            return item.toLowerCase();
        }));
        const parts_name_escaped = parts_name.map(function (item) {
            return item.replace('(', '[\\(]');
        });

        return new RegExp(parts_name_escaped.join('|'), 'gi');
    }

    /**
     * 
     * @param {String} str 
     * @param {String[]} parts_name_escaped
     * @param {Object} replaceFunction
     */
    static hideInnerSql(str, parts_name_escaped, replaceFunction) {
        if (str.indexOf("(") === -1 && str.indexOf(")") === -1)
            return str;

        let bracketCount = 0;
        let endCount = -1;
        let newStr = str;

        for (let i = newStr.length - 1; i >= 0; i--) {
            const ch = newStr.charAt(i);

            if (ch === ")") {
                bracketCount++;

                if (bracketCount === 1) {
                    endCount = i;
                }
            }
            else if (ch === "(") {
                bracketCount--;
                if (bracketCount === 0) {

                    let query = newStr.substring(i, endCount + 1);

                    // Hide words defined as separator but written inside brackets in the query
                    query = query.replace(new RegExp(parts_name_escaped.join('|'), 'gi'), replaceFunction);

                    newStr = newStr.substring(0, i) + query + newStr.substring(endCount + 1);
                }
            }
        }
        return newStr;
    }

    /**
     * 
     * @param {String} modifiedQuery 
     * @param {String[]} parts_name 
     * @returns {String[]}
     */
    static getPositionsOfSqlParts(modifiedQuery, parts_name) {
        // Write the position(s) in query of these separators
        const parts_order = [];
        function realNameCallback(_match, name) {
            return name;
        }
        parts_name.forEach(function (item) {
            let pos = 0;
            let part = 0;

            do {
                part = modifiedQuery.indexOf(item, pos);
                if (part !== -1) {
                    const realName = item.replace(/^((\w|\s)+?)\s?\(?$/i, realNameCallback);

                    if (typeof parts_order[part] === 'undefined' || parts_order[part].length < realName.length) {
                        parts_order[part] = realName;	// Position won't be exact because the use of protect()  (above) and unprotect() alter the query string ; but we just need the order :)
                    }

                    pos = part + realName.length;
                }
            }
            while (part !== -1);
        });

        return parts_order;
    }

    /**
     * Delete duplicates (caused, for example, by JOIN and INNER JOIN)
     * @param {String[]} parts_order
     */
    static removeDuplicateEntries(parts_order) {
        let busy_until = 0;
        parts_order.forEach(function (item, key) {
            if (busy_until > key)
                delete parts_order[key];
            else {
                busy_until = key + item.length;

                // Replace JOIN by INNER JOIN
                if (item.toUpperCase() === 'JOIN')
                    parts_order[key] = 'INNER JOIN';
            }
        });
    }

    /**
     * Add some # inside a string to avoid it to match a regex/split
     * @param {String} str 
     * @returns {String}
     */
    static protect(str) {
        let result = '#';
        const length = str.length;
        for (let i = 0; i < length; i++) {
            result += `${str[i]}#`;
        }
        return result;
    }

    /**
     * Restore a string output by protect() to its original state
     * @param {String} str 
     * @returns {String}
     */
    static unprotect(str) {
        let result = '';
        const length = str.length;
        for (let i = 1; i < length; i = i + 2) result += str[i];
        return result;
    }

    /**
     * 
     * @param {String[]} parts_order 
     * @param {String[]} parts 
     * @returns {Object}
     */
    static analyzeParts(parts_order, parts) {
        const result = {};
        let j = 0;
        parts_order.forEach(function (item, _key) {
            const itemName = item.toUpperCase();
            j++;
            const part_result = SelectKeywordAnalysis.analyze(item, parts[j]);

            if (typeof result[itemName] !== 'undefined') {
                if (typeof result[itemName] === 'string' || typeof result[itemName][0] === 'undefined') {
                    const tmp = result[itemName];
                    result[itemName] = [];
                    result[itemName].push(tmp);
                }

                result[itemName].push(part_result);
            }
            else {
                result[itemName] = part_result;
            }

        });

        return result;
    }

    /**
     * 
     * @param {Object} result 
     */
    static reorganizeJoins(result) {
        const joinArr = [
            ['FULL JOIN', 'full'],
            ['RIGHT JOIN', 'right'],
            ['INNER JOIN', 'inner'],
            ['LEFT JOIN', 'left']
        ];

        for (const join of joinArr) {
            const [joinName, joinType] = join;
            SqlParse.reorganizeSpecificJoin(result, joinName, joinType);
        }
    }

    /**
     * 
     * @param {Object} result 
     * @param {String} joinName 
     * @param {String} joinType 
     */
    static reorganizeSpecificJoin(result, joinName, joinType) {
        if (typeof result[joinName] !== 'undefined') {
            if (typeof result.JOIN === 'undefined') result.JOIN = [];
            if (typeof result[joinName][0] !== 'undefined') {
                result[joinName].forEach(function (item) {
                    item.type = joinType;
                    result.JOIN.push(item);
                });
            }
            else {
                result[joinName].type = joinType;
                result.JOIN.push(result[joinName]);
            }
            delete result[joinName];
        }
    }

    /**
     * 
     * @param {Object} result 
     */
    static reorganizeUnions(result) {
        const astRecursiveTableBlocks = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];

        for (const union of astRecursiveTableBlocks) {
            if (typeof result[union] === 'string') {
                result[union] = [SqlParse.sql2ast(SqlParse.parseUnion(result[union]))];
            }
            else if (typeof result[union] !== 'undefined') {
                for (let i = 0; i < result[union].length; i++) {
                    result[union][i] = SqlParse.sql2ast(SqlParse.parseUnion(result[union][i]));
                }
            }
        }
    }

    static parseUnion(inStr) {
        let unionString = inStr;
        if (unionString.startsWith("(") && unionString.endsWith(")")) {
            unionString = unionString.substring(1, unionString.length - 1);
        }

        return unionString;
    }
}

/*
 * LEXER & PARSER FOR SQL CONDITIONS
 * Inspired by https://github.com/DmitrySoshnikov/Essentials-of-interpretation
 */

// Constructor
function CondLexer(source) {
    this.source = source;
    this.cursor = 0;
    this.currentChar = "";
    this.startQuote = "";
    this.bracketCount = 0;

    this.readNextChar();
}

CondLexer.prototype = {
    constructor: CondLexer,

    // Read the next character (or return an empty string if cursor is at the end of the source)
    readNextChar: function () {
        if (typeof this.source !== 'string') {
            this.currentChar = "";
        }
        else {
            this.currentChar = this.source[this.cursor++] || "";
        }
    },

    // Determine the next token
    readNextToken: function () {
        if (/\w/.test(this.currentChar))
            return this.readWord();
        if (/["'`]/.test(this.currentChar))
            return this.readString();
        if (/[()]/.test(this.currentChar))
            return this.readGroupSymbol();
        if (/[!=<>]/.test(this.currentChar))
            return this.readOperator();
        if (/[\+\-*\/%]/.test(this.currentChar))
            return this.readMathOperator();
        if (this.currentChar === '?')
            return this.readBindVariable();

        if (this.currentChar === "") {
            return { type: 'eot', value: '' };
        }

        this.readNextChar();
        return { type: 'empty', value: '' };
    },

    readWord: function () {
        let tokenValue = "";
        this.bracketCount = 0;
        let insideQuotedString = false;
        this.startQuote = "";

        while (/./.test(this.currentChar)) {
            // Check if we are in a string
            insideQuotedString = this.isStartOrEndOfString(insideQuotedString);

            if (this.isFinishedWord(insideQuotedString))
                break;

            tokenValue += this.currentChar;
            this.readNextChar();
        }

        if (/^(AND|OR)$/i.test(tokenValue)) {
            return { type: 'logic', value: tokenValue.toUpperCase() };
        }

        if (/^(IN|IS|NOT|LIKE)$/i.test(tokenValue)) {
            return { type: 'operator', value: tokenValue.toUpperCase() };
        }

        return { type: 'word', value: tokenValue };
    },

    /**
     * 
     * @param {Boolean} insideQuotedString 
     * @returns {Boolean}
     */
    isStartOrEndOfString: function (insideQuotedString) {
        if (!insideQuotedString && /['"`]/.test(this.currentChar)) {
            this.startQuote = this.currentChar;

            return true;
        }
        else if (insideQuotedString && this.currentChar === this.startQuote) {
            //  End of quoted string.
            return false;
        }

        return insideQuotedString;
    },

    /**
     * 
     * @param {Boolean} insideQuotedString 
     * @returns {Boolean}
     */
    isFinishedWord: function (insideQuotedString) {
        if (insideQuotedString)
            return false;

        // Token is finished if there is a closing bracket outside a string and with no opening
        if (this.currentChar === ')' && this.bracketCount <= 0) {
            return true;
        }

        if (this.currentChar === '(') {
            this.bracketCount++;
        }
        else if (this.currentChar === ')') {
            this.bracketCount--;
        }

        // Token is finished if there is a operator symbol outside a string
        if (/[!=<>]/.test(this.currentChar)) {
            return true;
        }

        // Token is finished on the first space which is outside a string or a function
        return this.currentChar === ' ' && this.bracketCount <= 0;
    },

    readString: function () {
        let tokenValue = "";
        const quote = this.currentChar;

        tokenValue += this.currentChar;
        this.readNextChar();

        while (this.currentChar !== quote && this.currentChar !== "") {
            tokenValue += this.currentChar;
            this.readNextChar();
        }

        tokenValue += this.currentChar;
        this.readNextChar();

        // Handle this case : `table`.`column`
        if (this.currentChar === '.') {
            tokenValue += this.currentChar;
            this.readNextChar();
            tokenValue += this.readString().value;

            return { type: 'word', value: tokenValue };
        }

        return { type: 'string', value: tokenValue };
    },

    readGroupSymbol: function () {
        const tokenValue = this.currentChar;
        this.readNextChar();

        return { type: 'group', value: tokenValue };
    },

    readOperator: function () {
        let tokenValue = this.currentChar;
        this.readNextChar();

        if (/[=<>]/.test(this.currentChar)) {
            tokenValue += this.currentChar;
            this.readNextChar();
        }

        return { type: 'operator', value: tokenValue };
    },

    readMathOperator: function () {
        const tokenValue = this.currentChar;
        this.readNextChar();

        return { type: 'mathoperator', value: tokenValue };
    },

    readBindVariable: function () {
        const tokenValue = this.currentChar;
        this.readNextChar();

        return { type: 'bindVariable', value: tokenValue };
    },
};

// Constructor
function CondParser(source) {
    this.lexer = new CondLexer(source);
    this.currentToken = {};

    this.readNextToken();
}

CondParser.prototype = {
    constructor: CondParser,

    // Read the next token (skip empty tokens)
    readNextToken: function () {
        this.currentToken = this.lexer.readNextToken();
        while (this.currentToken.type === 'empty')
            this.currentToken = this.lexer.readNextToken();
        return this.currentToken;
    },

    // Wrapper function ; parse the source
    parseExpressionsRecursively: function () {
        return this.parseLogicalExpression();
    },

    // Parse logical expressions (AND/OR)
    parseLogicalExpression: function () {
        let leftNode = this.parseConditionExpression();

        while (this.currentToken.type === 'logic') {
            const logic = this.currentToken.value;
            this.readNextToken();

            const rightNode = this.parseConditionExpression();

            // If we are chaining the same logical operator, add nodes to existing object instead of creating another one
            if (typeof leftNode.logic !== 'undefined' && leftNode.logic === logic && typeof leftNode.terms !== 'undefined')
                leftNode.terms.push(rightNode);
            else {
                const terms = [leftNode, rightNode];
                leftNode = { 'logic': logic, 'terms': terms.slice(0) };
            }
        }

        return leftNode;
    },

    // Parse conditions ([word/string] [operator] [word/string])
    parseConditionExpression: function () {
        let leftNode = this.parseBaseExpression();

        if (this.currentToken.type === 'operator') {
            let operator = this.currentToken.value;
            this.readNextToken();

            // If there are 2 adjacent operators, join them with a space (exemple: IS NOT)
            if (this.currentToken.type === 'operator') {
                operator += ` ${this.currentToken.value}`;
                this.readNextToken();
            }

            const rightNode = this.parseBaseExpression(operator);

            leftNode = { 'operator': operator, 'left': leftNode, 'right': rightNode };
        }

        return leftNode;
    },

    // Parse base items
    /**
     * 
     * @param {String} operator 
     * @returns {Object}
     */
    parseBaseExpression: function (operator = "") {
        let astNode = {};

        // If this is a word/string, return its value
        if (this.currentToken.type === 'word' || this.currentToken.type === 'string') {
            astNode = this.parseWordExpression();
        }
        // If this is a group, skip brackets and parse the inside
        else if (this.currentToken.type === 'group') {
            astNode = this.parseGroupExpression(operator);
        }
        else if (this.currentToken.type === 'bindVariable') {
            astNode = this.currentToken.value;
            this.readNextToken();
        }

        return astNode;
    },

    /**
     * 
     * @returns {Object}
     */
    parseWordExpression: function () {
        let astNode = this.currentToken.value;
        this.readNextToken();

        if (this.currentToken.type === 'mathoperator') {
            astNode += ` ${this.currentToken.value}`;
            this.readNextToken();
            while ((this.currentToken.type === 'mathoperator' || this.currentToken.type === 'word') && this.currentToken.type !== 'eot') {
                astNode += ` ${this.currentToken.value}`;
                this.readNextToken();
            }
        }

        return astNode;
    },

    /**
     * 
     * @param {String} operator 
     * @returns {Object}
     */
    parseGroupExpression: function (operator) {
        this.readNextToken();
        let astNode = this.parseExpressionsRecursively();

        const isSelectStatement = typeof astNode === "string" && astNode.toUpperCase() === 'SELECT';

        if (operator === 'IN' || isSelectStatement) {
            astNode = this.parseSelectIn(astNode, isSelectStatement);
        }
        else {
            //  Are we within brackets of mathematicl expression ?
            let inCurrentToken = this.currentToken;

            while (inCurrentToken.type !== 'group' && inCurrentToken.type !== 'eot') {
                this.readNextToken();
                if (inCurrentToken.type !== 'group') {
                    astNode += ` ${inCurrentToken.value}`;
                }

                inCurrentToken = this.currentToken;
            }

        }

        this.readNextToken();

        return astNode;
    },

    /**
     * 
     * @param {Object} startAstNode 
     * @param {Boolean} isSelectStatement 
     * @returns {Object}
     */
    parseSelectIn: function (startAstNode, isSelectStatement) {
        let astNode = startAstNode;
        let inCurrentToken = this.currentToken;
        while (inCurrentToken.type !== 'group' && inCurrentToken.type !== 'eot') {
            this.readNextToken();
            if (inCurrentToken.type !== 'group') {
                if (isSelectStatement)
                    astNode += ` ${inCurrentToken.value}`;
                else
                    astNode += `, ${inCurrentToken.value}`;
            }

            inCurrentToken = this.currentToken;
        }

        if (isSelectStatement) {
            astNode = SqlParse.sql2ast(astNode);
        }

        return astNode;
    }

};

// Parse a string
CondParser.parse = function (source) {
    return new CondParser(source).parseExpressionsRecursively();
};

class SelectKeywordAnalysis {
    static analyze(itemName, part) {
        const keyWord = itemName.toUpperCase().replace(/ /g, '_');

        if (typeof SelectKeywordAnalysis[keyWord] === 'undefined') {
            throw new Error(`Can't analyze statement ${itemName}`);
        }

        return SelectKeywordAnalysis[keyWord](part);
    }

    static SELECT(str) {
        const selectParts = SelectKeywordAnalysis.protect_split(',', str);
        const selectResult = selectParts.filter(function (item) {
            return item !== '';
        }).map(function (item) {
            //  Is there a column alias?
            const [field, alias] = SelectKeywordAnalysis.getNameAndAlias(item);

            const splitPattern = /[\s()*/%+-]+/g;
            let terms = field.split(splitPattern);

            if (terms !== null) {
                const aggFunc = ["SUM", "MIN", "MAX", "COUNT", "AVG", "DISTINCT"];
                terms = (aggFunc.indexOf(terms[0].toUpperCase()) === -1) ? terms : null;
            }
            if (field !== "*" && terms !== null && terms.length > 1) {
                return {
                    name: field,
                    terms: terms,
                    as: alias
                };
            }
            return { name: field, as: alias };
        });

        return selectResult;
    }

    static FROM(str) {
        let fromResult = str.split(',');
        fromResult = fromResult.map(function (item) {
            return SelectKeywordAnalysis.trim(item);
        });
        fromResult = fromResult.map(function (item) {
            const [table, alias] = SelectKeywordAnalysis.getNameAndAlias(item);
            return { table: table, as: alias };
        });
        return fromResult;
    }

    static LEFT_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    static INNER_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    static RIGHT_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    static FULL_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    static allJoins(str) {
        const strParts = str.toUpperCase().split(' ON ');
        const table = strParts[0].split(' AS ');
        const joinResult = {};
        joinResult.table = SelectKeywordAnalysis.trim(table[0]);
        joinResult.as = SelectKeywordAnalysis.trim(table[1]) || '';
        joinResult.cond = SelectKeywordAnalysis.trim(strParts[1]);

        return joinResult;
    }

    static WHERE(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    static ORDER_BY(str) {
        const strParts = str.split(',');
        const orderByResult = [];
        strParts.forEach(function (item, _key) {
            const order_by = /([\w\.]+)\s*(ASC|DESC)?/gi;
            const orderData = order_by.exec(item);
            if (orderData !== null) {
                const tmp = {};
                tmp.column = SelectKeywordAnalysis.trim(orderData[1]);
                tmp.order = SelectKeywordAnalysis.trim(orderData[2]);
                if (typeof orderData[2] === 'undefined') {
                    const orderParts = item.trim().split(" ");
                    if (orderParts.length > 1)
                        throw new Error(`Invalid ORDER BY:  ${item}`);
                    tmp.order = "ASC";
                }
                orderByResult.push(tmp);
            }
        });
        return orderByResult;
    }

    static GROUP_BY(str) {
        const strParts = str.split(',');
        const groupByResult = [];
        strParts.forEach(function (item, _key) {
            const group_by = /([\w\.]+)/gi;
            const groupData = group_by.exec(item);
            if (groupData !== null) {
                const tmp = {};
                tmp.column = SelectKeywordAnalysis.trim(groupData[1]);
                groupByResult.push(tmp);
            }
        });
        return groupByResult;
    }

    static PIVOT(str) {
        const strParts = str.split(',');
        const pivotResult = [];
        strParts.forEach(function (item, _key) {
            const pivotOn = /([\w\.]+)/gi;
            const pivotData = pivotOn.exec(item);
            if (pivotData !== null) {
                const tmp = {};
                tmp.name = SelectKeywordAnalysis.trim(pivotData[1]);
                tmp.as = "";
                pivotResult.push(tmp);
            }
        });
        return pivotResult;
    }

    static LIMIT(str) {
        const limitResult = {};
        limitResult.nb = parseInt(str, 10);
        limitResult.from = 0;
        return limitResult;
    }

    static HAVING(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    static UNION(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    static UNION_ALL(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    static INTERSECT(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    static EXCEPT(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    // Split a string using a separator, only if this separator isn't beetween brackets
    /**
     * 
     * @param {String} separator 
     * @param {String} str 
     * @returns {String[]}
     */
    static protect_split(separator, str) {
        const sep = '######';

        let inQuotedString = false;
        let quoteChar = "";
        let bracketCount = 0;
        let newStr = "";
        for (const c of str) {
            if (!inQuotedString && /['"`]/.test(c)) {
                inQuotedString = true;
                quoteChar = c;
            }
            else if (inQuotedString && c === quoteChar) {
                inQuotedString = false;
            }
            else if (!inQuotedString && c === '(') {
                bracketCount++;
            }
            else if (!inQuotedString && c === ')') {
                bracketCount--;
            }

            if (c === separator && (bracketCount > 0 || inQuotedString)) {
                newStr += sep;
            }
            else {
                newStr += c;
            }
        }

        let strParts = newStr.split(separator);
        strParts = strParts.map(function (item) {
            return SelectKeywordAnalysis.trim(item.replace(new RegExp(sep, 'g'), separator));
        });

        return strParts;
    }

    static trim(str) {
        if (typeof str === 'string')
            return str.trim();
        return str;
    }

    /**
    * If an ALIAS is specified after 'AS', return the field/table name and the alias.
    * @param {String} item 
    * @returns {[String, String]}
    */
    static getNameAndAlias(item) {
        let realName = item;
        let alias = "";
        const lastAs = SelectKeywordAnalysis.lastIndexOfOutsideLiteral(item.toUpperCase(), " AS ");
        if (lastAs !== -1) {
            const subStr = item.substring(lastAs + 4).trim();
            if (subStr.length > 0) {
                alias = subStr;
                //  Remove quotes, if any.
                if ((subStr.startsWith("'") && subStr.endsWith("'")) ||
                    (subStr.startsWith('"') && subStr.endsWith('"')) ||
                    (subStr.startsWith('[') && subStr.endsWith(']')))
                    alias = subStr.substring(1, subStr.length - 1);

                //  Remove everything after 'AS'.
                realName = item.substring(0, lastAs);
            }
        }

        return [realName, alias];
    }

    static lastIndexOfOutsideLiteral(srcString, searchString) {
        let index = -1;
        let inQuote = "";

        for (let i = 0; i < srcString.length; i++) {
            const ch = srcString.charAt(i);

            if (inQuote !== "") {
                //  The ending quote.
                if ((inQuote === "'" && ch === "'") || (inQuote === '"' && ch === '"') || (inQuote === "[" && ch === "]"))
                    inQuote = "";
            }
            else if ("\"'[".indexOf(ch) !== -1) {
                //  The starting quote.
                inQuote = ch;
            }
            else if (srcString.substring(i).startsWith(searchString)) {
                //  Matched search.
                index = i;
            }
        }

        return index;
    }
}
//  Remove comments for testing in NODE
//
/*  *** DEBUG START ***
export { TableData };
import { CacheService, LockService, SpreadsheetApp, PropertiesService, Utilities } from "./SqlTest.js"; 

class Logger {
    static log(msg) {
        console.log(msg);
    }
}
//  *** DEBUG END  ***/


class TableData {
    /**
    * Retrieve table data from SHEET or CACHE.
    * @param {String} namedRange 
    * @param {Number} cacheSeconds - 0s Reads directly from sheet. > 21600s Sets in SCRIPT settings, else CacheService 
    * @returns {any[][]}
    */
    static loadTableData(namedRange, cacheSeconds = 0) {
        if (typeof namedRange === 'undefined' || namedRange === "")
            return [];

        Logger.log(`loadTableData: ${namedRange}. Seconds=${cacheSeconds}`);

        let tempData = TableData.getValuesCached(namedRange, cacheSeconds)

        tempData = tempData.filter(e => e.join().replace(/,/g, "").length);

        return tempData;
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
            const shortCache = CacheService.getScriptCache();
            if (shortCache.get("LONG_CACHE_EXPIRY") === null) {
                cache.expire(false);
                shortCache.put("LONG_CACHE_EXPIRY", true, 21000);
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
            cache.put(namedRange, JSON.stringify(singleData), seconds)
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
            lock.waitLock(10000); // wait 10 seconds for others' use of the code section and lock to stop and then proceed
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
     * 
     * @param {String} namedRange 
     * @returns {any[]}
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
                const sheetHandle = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tableNamedRange);
                if (sheetHandle === null)
                    throw new Error(`Invalid table range specified:  ${tableNamedRange}`);

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
            lock.waitLock(10000); // wait 10 seconds for others' use of the code section and lock to stop and then proceed
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
            const blocks = parseInt(blockStr, 10);
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

        try {
        this.scriptProperties.setProperty(propertyKey, jsonData);
        }
        catch(ex) {
            throw new Error("Cache Limit Exceeded.  Long cache times have limited storage available.  Only cache small tables for long periods.");
        }
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

            if (myData !== null) {
                let propertyValue = null;
                try {
                    propertyValue = JSON.parse(myData);
                }
                catch (e) {
                    Logger.log(`Script property data is not JSON. key=${key}`);
                }

                if (propertyValue !== null && (PropertyData.isExpired(propertyValue) || deleteAll)) {
                    this.scriptProperties.deleteProperty(key);
                    Logger.log(`Removing expired SCRIPT PROPERTY: key=${key}`);
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
        this.expiry = someDate.setMinutes(someDate.getMinutes() + daysToHold * 1440);
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
            Logger.log(`Invalid property value.  Not JSON: ${ex.toString()}`);
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