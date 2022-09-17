//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { DERIVEDTABLE, VirtualFields, VirtualField, SelectTables };
import { Table } from './Table.js';
import { Sql } from './Sql.js';
import { sqlCondition2JsCondition } from './SimpleParser.js';
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
        this.sqlServerFunctionCache = new Map();
        this.virtualFields = new VirtualFields();
        this.dataJoin = new JoinTables([], this.virtualFields);
        if (!tableInfo.has(this.primaryTable.toUpperCase()))
            throw new Error(`Invalid table name: ${this.primaryTable}`);
        this.masterTableInfo = tableInfo.get(this.primaryTable.toUpperCase());

        //  Keep a list of all possible fields from all tables.
        this.virtualFields.loadVirtualFields(this.primaryTable, tableInfo);

        //  Expand any 'SELECT *' fields and add the actual field names into 'astFields'.
        this.astFields = VirtualFields.expandWildcardFields(this.masterTableInfo, this.astFields);

        //  Keep a list of fields that are SELECTED.
        this.virtualFields.updateSelectFieldList(astFields);
    }

    /**
     * 
     * @param {any[]} ast 
     */
    join(ast) {
        if (typeof ast['JOIN'] !== 'undefined')
            this.dataJoin = new JoinTables(ast['JOIN'], this.virtualFields);
    }

    /**
      * Retrieve filtered record ID's.
      * @param {Object} ast 
      * @returns {Number[]}
      */
    whereCondition(ast) {
        let sqlData = [];

        let conditions = {};
        if (typeof ast['WHERE'] !== 'undefined') {
            conditions = ast['WHERE'];
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
        this.masterTable = this.dataJoin.isDerivedTable() ? this.dataJoin.getJoinedTableInfo() : this.masterTableInfo;

        for (let masterRecordID = 1; masterRecordID < this.masterTable.tableData.length; masterRecordID++) {
            let leftValue = this.getConditionValue(leftFieldConditions, masterRecordID);
            let rightValue = this.getConditionValue(rightFieldConditions, masterRecordID);

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
     * @param {Number} masterRecordID
     */
    getConditionValue(fieldConditions, masterRecordID) {
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
            if (fieldCalculatedField.toUpperCase() === "NULL")
                leftValue = "NULL";
            else
                leftValue = this.evaluateCalculatedField(fieldCalculatedField, masterRecordID);
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
        operator = operator.toUpperCase();

        switch (operator) {
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

        for (const masterRecordID of recordIDs) {
            const newRow = [];

            for (/** @type {SelectField} */ const field of this.virtualFields.selectVirtualFields) {
                if (field.fieldInfo !== null)
                    newRow.push(field.fieldInfo.getData(masterRecordID));
                else if (field.calculatedFormula !== "") {
                    const result = this.evaluateCalculatedField(field.calculatedFormula, masterRecordID);
                    newRow.push(result);
                }
            }

            virtualData.push(newRow);
        }

        return virtualData;
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

        let myVars = "";
        for (/** @type {VirtualField} */ const vField of this.virtualFields.getAllVirtualFields()) {
            //  a) Exclude the * field which represents all fields.
            //  b) Non primary table fields require full notation for column
            //  c) The 'masterRecordID' is referencing masterTable, so fields from
            //  other tables should be excluded.
            if (vField.fieldName === "*" ||
                (this.masterTableInfo.tableName !== vField.tableInfo.tableName && vField.fieldName.indexOf(".") === -1) ||
                (this.masterTable !== vField.tableInfo))
                continue;

            //  Get the DATA from this field.  We then build a series of LET statments
            //  and we assign that data to the field name that might be found in a calculated field.
            let varData = vField.getData(masterRecordID);
            if (typeof varData === "string" || varData instanceof Date) {
                varData = "'" + varData + "'";
            }

            if (vField.fieldName.indexOf(".") === -1)
                myVars += `let ${vField.fieldName} = ${varData};`;
            else {
                const parts = vField.fieldName.split(".");
                if (!objectsDeclared.has(parts[0])) {
                    myVars += `let ${parts[0]} = {};`;
                    objectsDeclared.set(parts[0], true);
                }
                myVars += `${vField.fieldName} = ${varData};`;
            }
        }

        const functionString = this.sqlServerFunctions(calculatedFormula);

        return `${myVars} return ${functionString}`;
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
     * @returns {Number}
     */
    getConglomerateFieldCount() {
        let count = 0;
        for (/** @type {SelectField} */ const field of this.virtualFields.selectVirtualFields) {
            if (field.aggregateFunction !== "")
                count++;
        }

        return count;
    }

    /**
     * 
     * @param {Object} ast 
     * @param {any[][]} viewTableData 
     * @returns {any[][]}
     */
    groupBy(ast, viewTableData) {

        if (typeof ast['GROUP BY'] !== 'undefined') {
            viewTableData = this.groupByFields(ast['GROUP BY'], viewTableData);

            if (typeof ast['HAVING'] !== 'undefined') {
                viewTableData = this.having(ast['HAVING'], viewTableData);
            }
        }
        else {
            //  If any conglomerate field functions (SUM, COUNT,...)
            //  we summarize all records into ONE.
            if (this.getConglomerateFieldCount() > 0) {
                const compressedData = [];
                const conglomerate = new ConglomerateRecord(this.virtualFields.selectVirtualFields);
                compressedData.push(conglomerate.squish(viewTableData));
                viewTableData = compressedData;
            }
        }

        return viewTableData;
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
            const selectColumn = this.virtualFields.getSelectFieldColumn(orderField.column);

            if (selectColumn !== -1) {
                SelectTables.sortByColumnASC(selectedData, selectColumn);
            }
        }

        const groupedData = [];
        let groupRecords = [];
        const conglomerate = new ConglomerateRecord(this.virtualFields.selectVirtualFields);

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
            const selectColumn = this.virtualFields.getSelectFieldColumn(orderField.column);
            if (selectColumn !== -1)
                key += row[selectColumn].toString();
        }

        return key;
    }

    /**
    * 
    * @param {any[]} astHaving 
    * @param {any[][]} selectedData 
    * @returns {any[][]}
    */
    having(astHaving, selectedData) {
        //  Add in the title row for now
        selectedData.unshift(this.getColumnNames());

        //  Create our virtual GROUP table with data already selected.
        const groupTable = new Table(this.primaryTable).loadArrayData(selectedData);

        const tableMapping = new Map();
        tableMapping.set(this.primaryTable.toUpperCase(), groupTable);

        //  Set up for our SQL.
        const inSQL = new Sql().setTables(tableMapping);

        //  Fudge the HAVING to look like a SELECT.
        const astSelect = {};
        astSelect['FROM'] = [{ table: this.primaryTable }];
        astSelect['SELECT'] = [{ name: "*" }];
        astSelect['WHERE'] = astHaving;

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
            const selectColumn = this.virtualFields.getSelectFieldColumn(orderField.column);

            if (selectColumn !== -1) {
                if (orderField.order === "DESC")
                    SelectTables.sortByColumnDESC(selectedData, selectColumn);
                else
                    SelectTables.sortByColumnASC(selectedData, selectColumn);
            }
            else {
                throw new Error(`Invalid ORDER BY: ${orderField.column}`);
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
     * @param {any} fieldCondition 
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
        if (typeof fieldCondition['SELECT'] !== 'undefined') {
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
                if (this.virtualFields.hasField(fieldCondition)) {
                    columnNumber = this.virtualFields.getFieldColumn(fieldCondition)
                    fieldConditionTableInfo = this.virtualFields.getTableInfo(fieldCondition)
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
    getColumnNames() {
        return this.virtualFields.getColumnNames();
    }

    /**
     * 
     * @returns {String[]}
     */
    getColumnTitles() {
        return this.virtualFields.getColumnTitles();
    }
}

class VirtualFields {
    constructor() {
        /** @type {Map<String, VirtualField>} */
        this.virtualFieldMap = new Map();
        /** @type {VirtualField[]} */
        this.virtualFieldList = [];
        /** @type {String[]} */
        this.columnNames = [];
        this.columnTitles = [];
        /** @type {SelectField[]} */
        this.selectVirtualFields = [];
    }

    /**
     * 
     * @param {VirtualField} field 
     */
    add(field, checkForDuplicates=false) {
        if (checkForDuplicates && this.virtualFieldMap.has(field.fieldName)) {
            throw new Error(`Duplicate field name: ${field.fieldName}`);
        }
        this.virtualFieldMap.set(field.fieldName, field);
        this.virtualFieldList.push(field);
    }

    /**
     * 
     * @param {VirtualField} originalField 
     * @param {VirtualField} newField 
     */
    replaceVirtualField(originalField, newField) {
        const originalCol = originalField.tableColumn;
        const originalTable = originalField.tableInfo.tableName;

        for (const fld of this.virtualFieldList) {
            if (originalCol === fld.tableColumn &&
                originalTable === fld.tableInfo.tableName) {
                //  Keep field object, just replace contents.
                fld.tableColumn = newField.tableColumn;
                fld.tableInfo = newField.tableInfo;
            }
        }
    }

    /**
     * 
     * @param {String} field 
     * @returns {Boolean}
     */
    hasField(field) {
        field = field.trim().toUpperCase();

        return this.virtualFieldMap.has(field);
    }

    /**
     * 
     * @param {String} field
     * @returns {Table}  
     */
    getTableInfo(field) {
        field = field.trim().toUpperCase();
        let tableInfo = null;

        if (this.virtualFieldMap.has(field))
            tableInfo = this.virtualFieldMap.get(field).tableInfo;

        return tableInfo;
    }

    /**
     * 
     * @param {String} field 
     * @returns {VirtualField}
     */
    getFieldInfo(field) {
        if (field === null || typeof field !== "string")
            throw new Error("SELECT syntax error.  Failed to retrieve field info.");

        field = field.trim().toUpperCase();
        let fieldInfo = null;

        if (this.virtualFieldMap.has(field))
            fieldInfo = this.virtualFieldMap.get(field);

        return fieldInfo;
    }

    /**
     * 
     * @param {any} name1 
     * @param {any} name2 
     * @returns {Boolean}
     */
    isSameField(name1, name2) {
        let isSame = false;
        let leftVirtual = name1;
        if (typeof name1 === "string")
            leftVirtual = this.getFieldInfo(name1);

        let rightVirtual = name2;
        if (typeof name2 === "string")
            rightVirtual = this.getFieldInfo(name2);

        if (leftVirtual !== null && rightVirtual !== null &&
            leftVirtual.tableInfo.tableName === rightVirtual.tableInfo.tableName &&
            leftVirtual.tableColumn === rightVirtual.tableColumn) {
            isSame = true;
        }
        return isSame;
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
     * @param {String} field 
     * @returns {Number}
     */
    getFieldColumn(field) {
        field = field.trim().toUpperCase();
        let fieldColumn = null;

        if (this.virtualFieldMap.has(field))
            fieldColumn = this.virtualFieldMap.get(field).tableColumn;

        return fieldColumn;
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
        let tableObject;
        // @ts-ignore
        for ([tableName, tableObject] of tableInfo.entries()) {
            const validFieldNames = tableObject.getAllFieldNames();

            for (const field of validFieldNames) {
                const tableColumn = tableObject.getFieldColumn(field);
                if (tableColumn !== -1) {
                    //  If we have the same field name more than once (without the full DOT notation)
                    //  we only want the one for the primary table.
                    if (this.hasField(field)) {
                        if (tableName.toUpperCase() !== primaryTable.toUpperCase())
                            continue;
                    }
                    const virtualField = new VirtualField(field, tableObject, tableColumn);
                    this.add(virtualField);
                }
            }
        }
    }

    /**
     * 
     * @param {DerivedTable} derivedTable 
     */
    updateDerivedTableVirtualFields(derivedTable) {
        const existingVirtualFieldsList = derivedTable.tableInfo.getAllVirtualFields();

        for (const field of existingVirtualFieldsList) {
            if (this.hasField(field.fieldName)) {
                const originalField = this.getFieldInfo(field.fieldName);
                this.replaceVirtualField(originalField, field);
            }
        }
    }

    removeNonDerivedTableVirtualFields() {
        /** @type {VirtualField[]} */
        const newVirtualFields = [];
        for (const fld of this.virtualFieldList) {
            if (fld.tableInfo.tableName === DERIVEDTABLE) {
                newVirtualFields.push(fld);
            }
        }

        this.virtualFieldList = newVirtualFields;
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

    /**
     * Updates internal SELECTED field list.
     * @param {*} astFields 
     */
    updateSelectFieldList(astFields) {
        this.columnNames = [];
        this.columnTitles = [];
        this.selectVirtualFields = [];

        for (const selField of astFields) {
            const [columnName, aggregateFunctionName, calculatedField] = this.getSelectFieldNames(selField);
            this.columnTitles.push(typeof selField.as !== 'undefined' && selField.as !== "" ? selField.as : selField.name);

            if (calculatedField === null && this.hasField(columnName)) {
                const fieldInfo = this.getFieldInfo(columnName);
                const selectFieldInfo = new SelectField(fieldInfo);
                selectFieldInfo.aggregateFunction = aggregateFunctionName;

                this.selectVirtualFields.push(selectFieldInfo);
                this.columnNames.push(selField.name);
            }
            else if (calculatedField !== null) {
                const selectFieldInfo = new SelectField(null);
                selectFieldInfo.calculatedFormula = selField.name;
                this.selectVirtualFields.push(selectFieldInfo);
                this.columnNames.push(selField.name);
            }
            else {
                //  is this a function?
                const selectFieldInfo = new SelectField(null);
                selectFieldInfo.calculatedFormula = columnName;
                selectFieldInfo.aggregateFunction = aggregateFunctionName;
                this.selectVirtualFields.push(selectFieldInfo);
                this.columnNames.push(selField.name);
            }
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
     * @param {String} fieldName 
     * @returns {Number}
     */
    getSelectFieldColumn(fieldName) {
        for (let i = 0; i < this.selectVirtualFields.length; i++) {
            if (this.isSameField(this.selectVirtualFields[i].fieldInfo, fieldName) && this.selectVirtualFields[i].aggregateFunction === "")
                return i;
        }

        return -1;
    }

    /**
     * 
     * @returns {String[]}
     */
    getColumnNames() {
        return this.columnNames;
    }

    /**
     * 
     * @returns {String[]}
     */
    getColumnTitles() {
        return this.columnTitles;
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

    /**
     * 
     * @param {Number} tableRow 
     * @returns {any}
     */
    getData(tableRow) {
        if (tableRow < 0 || this.tableColumn < 0)
            return "";

        return this.tableInfo.tableData[tableRow][this.tableColumn];
    }
}

/** Fields specified in SELECT statement. */
class SelectField {
    /**
     * 
     * @param {VirtualField} fieldInfo 
     */
    constructor(fieldInfo) {
        this._aggregateFunction = "";
        /** @property {SelectField[]} */
        this._calculatedFormula = "";
        this.fieldInfo = fieldInfo;
    }

    get aggregateFunction() {
        return this._aggregateFunction;
    }

    set aggregateFunction(value) {
        this._aggregateFunction = value.toUpperCase();
    }

    get calculatedFormula() {
        return this._calculatedFormula;
    }

    set calculatedFormula(value) {
        this._calculatedFormula = value;
    }
}

/** Handle the various JOIN table types. */
class JoinTables {
    /**
     * 
     * @param {any[]} astJoin 
     * @param {VirtualFields} virtualFields 
     */
    constructor(astJoin, virtualFields) {
        /** @type {DerivedTable} */
        this.derivedTable = new DerivedTable();

        for (const joinTable of astJoin) {
            /** @type {VirtualField} */
            let leftFieldInfo = this.derivedTable.getFieldInfo(joinTable.cond.left);
            if (leftFieldInfo === null)
                leftFieldInfo = virtualFields.getFieldInfo(joinTable.cond.left);
            if (leftFieldInfo === null)
                throw new Error(`Invalid JOIN field: ${joinTable.cond.left}`);

            /** @type {VirtualField} */
            let rightFieldInfo = this.derivedTable.getFieldInfo(joinTable.cond.right);
            if (rightFieldInfo === null)
                rightFieldInfo = virtualFields.getFieldInfo(joinTable.cond.right);
            if (rightFieldInfo === null)
                throw new Error(`Invalid JOIN field: ${joinTable.cond.right}`);

            this.derivedTable = JoinTables.joinTables(leftFieldInfo, rightFieldInfo, joinTable);

            //  Field locations have changed to the derived table, so update our
            //  virtual field list with proper settings.
            virtualFields.updateDerivedTableVirtualFields(this.derivedTable);

            this.derivedTable.leftTable = virtualFields.getFieldInfo(leftFieldInfo.fieldName);
            this.derivedTable.rightTable = virtualFields.getFieldInfo(rightFieldInfo.fieldName);
        }

        // Don't want any references to the original NON-DERIVED tables.
        virtualFields.removeNonDerivedTableVirtualFields();
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
    * @param {VirtualField} leftFieldInfo 
    * @param {VirtualField} rightFieldInfo 
    * @param {Object} joinTable 
    * @returns {DerivedTable}
    */
    static joinTables(leftFieldInfo, rightFieldInfo, joinTable) {
        let matchedRecordIDs = [];
        let derivedTable = null;

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
                const leftJoinRecordIDs = JoinTables.leftRightJoin(leftFieldInfo, rightFieldInfo, joinTable.type);
                derivedTable = new DerivedTable()
                    .setLeftField(leftFieldInfo)
                    .setRightField(rightFieldInfo)
                    .setLeftRecords(leftJoinRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();

                const rightJoinRecordIDs = JoinTables.leftRightJoin(rightFieldInfo, leftFieldInfo, "outer");
                const rightDerivedTable = new DerivedTable()
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
     * @param {VirtualField} leftField 
     * @param {VirtualField} rightField
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
        /** @type {VirtualField} */
        this.leftTable = null;
        /** @type {VirtualField} */
        this.rightTable = null;
        /** @type {Table} */
        this.tableInfo = null;
        /** @type  {VirtualField} */
        this.leftField = null;
        /** @type  {VirtualField} */
        this.rightField = null;
        /** @type  {Number[][]} */
        this.leftRecords = null;
        /** @type  {Boolean} */
        this.isOuterJoin = null;
    }

    /**
     * 
     * @param {VirtualField} leftField 
     * @returns {DerivedTable}
     */
    setLeftField(leftField) {
        this.leftField = leftField;
        return this;
    }

    /**
     * 
     * @param {VirtualField} rightField 
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
     * @param {String} field
     * @returns {VirtualField} 
     */
    getFieldInfo(field) {
        return this.tableInfo === null ? null : this.tableInfo.getVirtualFieldInfo(field);
    }

    /**
     * 
     * @param {VirtualField} leftField 
     * @param {VirtualField} rightField 
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
                        const ifCond = sqlCondition2JsCondition(parms[0]);
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
        if (func === "CASE") {
            args = functionString.match(/CASE(.*?)END/i);

            if (args !== null && args.length > 1) {
                this.firstCase = true;
                this.originalFunctionString = functionString;
                this.originalCaseStatement = args[0];
                functionString = args[1];

                args = args[1].match(this.matchCaseWhenThenStr);
            }
        }

        return [args, functionString];
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
                replacement = "else return " + args[3] + ";";
            }
            else {
                if (this.firstCase) {
                    replacement = "(() => {if (";
                    this.firstCase = false;
                }
                else
                    replacement = "else if (";
                replacement += `${sqlCondition2JsCondition(args[1])}) return ${args[2]} ;`;
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
     * @param {SelectField[]} virtualFields 
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
        for (/** @type {SelectField} */ const field of this.selectVirtualFields) {
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
     * @param {SelectField} field 
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