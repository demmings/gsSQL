//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { DERIVEDTABLE, VirtualFields, VirtualField, SelectTables };
import { Table } from './Table.js';
import { Sql } from './Sql.js';
import { SqlParse } from './SimpleParser.js';
//  *** DEBUG END  ***/

const DERIVEDTABLE = "::DERIVEDTABLE::";

class SelectTables {
    /**
     * @param {Object} ast
     * @param {Map<String,Table>} tableInfo 
     * @param {any[]} bindVariables
     */
    constructor(ast, tableInfo, bindVariables) {
        this.primaryTable = ast.FROM[0].table;
        this.astFields = ast.SELECT;
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

        //  Define the data source of each field in SELECT field list.
        this.tableFields.updateSelectFieldList(this.astFields);

        //  These are fields REFERENCED, but not actually in the SELECT FIELDS.
        //  So columns referenced by GROUP BY, ORDER BY and not in SELECT.
        //  These temp columns need to be removed after processing.
        this.tableFields.addReferencedColumnstoSelectFieldList(ast);
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
                keep = leftValue == rightValue;         // skipcq: JS-0050
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
                keep = leftValue != rightValue;         // skipcq: JS-0050
                break;

            case "!=":
                keep = leftValue != rightValue;         // skipcq: JS-0050
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
        const subQuery = new CorrelatedSubQuery(this.tableInfo, this.tableFields);

        for (const masterRecordID of recordIDs) {
            const newRow = [];

            for (const field of this.tableFields.getSelectFields()) {
                if (field.tableInfo !== null)
                    newRow.push(field.getData(masterRecordID));
                else if (field.subQueryAst !== null) {
                    const result = subQuery.select(field, masterRecordID, calcSqlField);
                    newRow.push(result[0][0]);
                }
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

            if (orderField.order.toUpperCase() === "DESC") {
                SelectTables.sortByColumnDESC(selectedData, selectColumn);
            }
            else {
                SelectTables.sortByColumnASC(selectedData, selectColumn);
            }
        }
    }

    /**
     * 
     * @param {any[][]} viewTableData 
     * @returns {any[][]}
     */
    removeTempColumns(viewTableData) {
        const tempColumns = this.tableFields.getTempSelectedColumnNumbers();

        if (tempColumns.length === 0)
            return viewTableData;

        for (const row of viewTableData) {
            for (const col of tempColumns) {
                row.splice(col, 1);
            }
        }

        return viewTableData;
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
     * @param {any} leftValue 
     * @param {String} rightValue 
     * @returns 
     */
    static inCondition(leftValue, rightValue) {
        const items = rightValue.split(",");
        for (let i = 0; i < items.length; i++)
            items[i] = items[i].trimStart().trimEnd();

        let index = items.indexOf(leftValue);
        if (index === -1 && typeof leftValue === 'number') {
            index = items.indexOf(leftValue.toString());
        }

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

        // e.g.  special case.  count(*)
        if (calculatedFormula === "*") {
            return "*";
        }

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
        const functionString = func.convertToJs(calculatedFormula, this.masterFields);

        //  No need to recalculate for each row.
        this.sqlServerFunctionCache.set(calculatedFormula, functionString);

        return functionString;
    }
}

class CorrelatedSubQuery {
    /**
     * 
     * @param {Map<String, Table>} tableInfo 
     * @param {TableFields} tableFields 
     */
    constructor(tableInfo, tableFields) {
        this.tableInfo = tableInfo;
        this.tableFields = tableFields;
    }
    /**
     * 
     * @param {TableField} field 
     * @param {Number} masterRecordID
     * @param {CalculatedField} calcSqlField
     * @returns {any}
     */


    select(field, masterRecordID, calcSqlField) {
        const inSQL = new Sql().setTables(this.tableInfo);

        const innerTableInfo = this.tableInfo.get(field.subQueryAst.FROM[0].table);
        if (typeof innerTableInfo === 'undefined')
            throw new Error(`No table data found: ${field.subQueryAst.FROM[0].table}`);

        //  Add BIND variable for all matching fields in WHERE.
        const tempAst = JSON.parse(JSON.stringify(field.subQueryAst));

        const bindVariables = this.replaceOuterFieldValueInCorrelatedWhere(calcSqlField.masterFields, masterRecordID, tempAst);

        inSQL.setBindValues(bindVariables);
        const inData = inSQL.select(tempAst);

        return inData;
    }

    /**
     * If we find the field name in the AST, just replace with '?' and return true.
     * @param {TableField[]} fieldNames 
     * @param {Number} masterRecordID
     * @param {Object} tempAst 
     * @returns {any[]}
     */
    replaceOuterFieldValueInCorrelatedWhere(fieldNames, masterRecordID, tempAst) {
        const where = tempAst.WHERE;

        if (typeof where === 'undefined')
            return [];

        let bindData = [];
        if (typeof where.logic === 'undefined')
            bindData = this.traverseWhere(fieldNames, [where]);
        else
            bindData = this.traverseWhere(fieldNames, where.terms);

        for (let i = 0; i < bindData.length; i++) {
            const fldName = bindData[i];
            for (const vField of fieldNames) {
                if (fldName === vField.fieldName) {
                    bindData[i] = vField.getData(masterRecordID);
                    break;
                }
            }
        }

        return bindData;
    }

    traverseWhere(fieldNames, terms) {
        const recordIDs = [];

        for (const cond of terms) {
            if (typeof cond.logic === 'undefined') {
                let result = fieldNames.find(item => item.fieldName === cond.left);
                if (typeof result !== 'undefined') {
                    recordIDs.push(cond.left);
                    cond.left = '?';
                }
                result = fieldNames.find(item => item.fieldName === cond.right);
                if (typeof result !== 'undefined') {
                    recordIDs.push(cond.right);
                    cond.right = '?';
                }
            }
            else {
                recordIDs.push(fieldNames, this.traverseWhere(cond.terms));
            }
        }

        return recordIDs;
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
                if (typeof joinTable.cond.left === 'undefined' || typeof joinTable.cond.right === 'undefined') {
                    throw new Error("Invalid JOIN TABLE ON syntax");
                }
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
     * @param {TableField[]} masterFields;
     * @returns {String}
     */
    convertToJs(calculatedFormula, masterFields) {
        const sqlFunctions = ["ABS", "CASE", "CEILING", "CHARINDEX", "COALESCE", "CONCAT_WS", "DAY", "FLOOR", "IF", "LEFT", "LEN", "LENGTH", "LOG", "LOG10", "LOWER",
            "LTRIM", "MONTH", "NOW", "POWER", "RAND", "REPLICATE", "REVERSE", "RIGHT", "ROUND", "RTRIM",
            "SPACE", "STUFF", "SUBSTRING", "SQRT", "TRIM", "UPPER", "YEAR"];
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
                    case "COALESCE":
                        replacement = SqlServerFunctions.coalesce(parms);
                        break;
                    case "CONCAT_WS":
                        replacement = SqlServerFunctions.concat_ws(parms, masterFields);
                        break;
                    case "DAY":
                        replacement = `new Date(${parms[0]}).getDate()`;
                        break;
                    case "FLOOR":
                        replacement = `Math.floor(${parms[0]})`;
                        break;
                    case "IF":
                        {
                            const ifCond = SqlParse.sqlCondition2JsCondition(parms[0]);
                            replacement = `${ifCond} ? ${parms[1]} : ${parms[2]};`;
                            break;
                        }
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
                    case "MONTH":
                        replacement = `new Date(${parms[0]}).getMonth() + 1`;
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
                    case "YEAR":
                        replacement = `new Date(${parms[0]}).getFullYear()`;
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
     * @param {any[]} parms 
     * @returns {String}
     */
    static coalesce(parms) {
        let replacement = "";
        for (const parm of parms) {
            replacement += `${parm} !== '' ? ${parm} : `;
        }

        replacement += `''`;

        return replacement;
    }

    /**
     * 
     * @param {any[]} parms 
     * @param {TableField[]} masterFields
     * @returns {String}
     */
    static concat_ws(parms, masterFields) {
        if (parms.length === 0) {
            return "";
        }

        let replacement = "";
        const separator = parms[0];
        let concatFields = [];

        for (let i = 1; i < parms.length; i++) {
            if (parms[i].trim() === "*") {
                const allTableFields = TableField.getAllExtendedAliasNames(masterFields);
                concatFields = concatFields.concat(allTableFields);
            }
            else {
                concatFields.push(parms[i]);
            }
        }

        for (const field of concatFields) {
            if (replacement !== "") {
                replacement += ` + ${separator} + `;
            }

            replacement += `${field}`;
        }

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
        let caseString = functionString;

        if (func === "CASE") {
            caseArguments = functionString.match(/CASE(.*?)END/i);

            if (caseArguments !== null && caseArguments.length > 1) {
                this.firstCase = true;
                this.originalFunctionString = functionString;
                this.originalCaseStatement = caseArguments[0];
                caseString = caseArguments[1];

                caseArguments = caseArguments[1].match(this.matchCaseWhenThenStr);
            }
        }

        return [caseArguments, caseString];
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
        const distinctSet = new Set();

        for (const groupRow of groupRecords) {
            if (groupRow[columnIndex] === 'null')
                continue;

            let numericData = parseFloat(groupRow[columnIndex]);
            numericData = (isNaN(numericData)) ? 0 : numericData;

            switch (field.aggregateFunction) {
                case "SUM":
                    groupValue += numericData;
                    break;
                case "COUNT":
                    groupValue++;
                    if (field.distinctSetting === "DISTINCT") {
                        distinctSet.add(groupRow[columnIndex]);
                        groupValue = distinctSet.size;
                    }
                    break;
                case "MIN":
                    groupValue = ConglomerateRecord.minCase(first, groupValue, numericData);
                    break;
                case "MAX":
                    groupValue = ConglomerateRecord.maxCase(first, groupValue, numericData);
                    break;
                case "AVG":
                    avgCounter++;
                    groupValue += numericData;
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
        let fld = this.getFieldInfo(field);
        if (fld !== null && fld.selectColumn !== -1) {
            return fld.selectColumn;
        }

        for (fld of this.getSelectFields()) {
            if (fld.aliasNames.indexOf(field.toUpperCase()) !== -1) {
                return fld.selectColumn;
            }
        }

        return -1;
    }

    /**
     * Updates internal SELECTED field list.
     * @param {Object} astFields 
     */
    updateSelectFieldList(astFields) {
        let i = 0;
        for (const selField of astFields) {
            const [columnName, aggregateFunctionName, calculatedField, fieldDistinct] = this.getSelectFieldNames(selField);
            const columnTitle = (typeof selField.as !== 'undefined' && selField.as !== "" ? selField.as : selField.name);

            if (calculatedField === null && this.hasField(columnName)) {
                let fieldInfo = this.getFieldInfo(columnName);
                if (aggregateFunctionName !== "" || fieldInfo.selectColumn !== -1) {
                    //  A new SELECT field, not from existing.
                    const newFieldInfo = new TableField();
                    Object.assign(newFieldInfo, fieldInfo);
                    fieldInfo = newFieldInfo;

                    this.allFields.push(fieldInfo);
                }

                fieldInfo
                    .setAggregateFunction(aggregateFunctionName)
                    .setColumnTitle(columnTitle)
                    .setColumnName(selField.name)
                    .setDistinctSetting(fieldDistinct)
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
                    .setCalculatedFormula(selField.name)
                    .setSubQueryAst(selField.subQuery);

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
     * 
     * @param {Object} ast 
     */
    addReferencedColumnstoSelectFieldList(ast) {
        this.addTempMissingSelectedField(ast['GROUP BY']);
        this.addTempMissingSelectedField(ast['ORDER BY']);
    }

    /**
     * 
     * @param {Object} astColumns 
     */
    addTempMissingSelectedField(astColumns) {
        if (typeof astColumns !== 'undefined') {
            for (const order of astColumns) {
                if (this.getSelectFieldColumn(order.column) === -1) {
                    const fieldInfo = this.getFieldInfo(order.column);

                    //  A new SELECT field, not from existing.
                    const newFieldInfo = new TableField();
                    Object.assign(newFieldInfo, fieldInfo);
                    newFieldInfo
                        .setSelectColumn(this.getNextSelectColumnNumber())
                        .setIsTempField(true);

                    this.allFields.push(newFieldInfo);
                }
            }
        }
    }

    /**
     * 
     * @returns {Number}
     */
    getNextSelectColumnNumber() {
        let next = -1;
        for (const fld of this.getSelectFields()) {
            next = fld.selectColumn > next ? fld.selectColumn : next;
        }

        return next === -1 ? next : ++next;
    }

    /**
     * 
     * @returns {Number[]}
     */
    getTempSelectedColumnNumbers() {
        /** @type {Number[]} */
        const tempCols = [];
        for (const fld of this.getSelectFields()) {
            if (fld.tempField) {
                tempCols.push(fld.selectColumn);
            }
        }
        tempCols.sort((a, b) => (b - a));

        return tempCols;
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
            if (!fld.tempField) {
                columnTitles.push(fld.columnTitle);
            }
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
        let fieldDistinct = "";
        const calculatedField = (typeof selField.terms === 'undefined') ? null : selField.terms;

        if (calculatedField === null && !this.hasField(columnName)) {
            const functionNameRegex = /^\w+\s*(?=\()/;
            let matches = columnName.match(functionNameRegex)
            if (matches !== null && matches.length > 0)
                aggregateFunctionName = matches[0].trim();

            matches = SelectTables.parseForFunctions(columnName, aggregateFunctionName);
            if (matches !== null && matches.length > 1) {
                columnName = matches[1];

                //  e.g.  count(distinct field)
                const distinctParts = columnName.split(" ");
                if (distinctParts.length > 1) {
                    const distinctModifiers = ["DISTINCT", "ALL"];
                    if (distinctModifiers.includes(distinctParts[0].toUpperCase())) {
                        fieldDistinct = distinctParts[0].toUpperCase();
                        columnName = distinctParts[1];
                    }
                }

            }
        }

        return [columnName, aggregateFunctionName, calculatedField, fieldDistinct];
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
        this.tempField = false;
        this.calculatedFormula = "";
        this.aggregateFunction = "";
        this.columnTitle = "";
        this.columnName = "";
        this.distinctSetting = "";
        this.subQueryAst = null;
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
     * Fields referenced BUT not in final output.
     * @param {Boolean} value 
     * @returns {TableField}
     */
    setIsTempField(value) {
        this.tempField = value;
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
     * @param {Object} ast 
     * @returns {TableField}
     */
    setSubQueryAst(ast) {
        this.subQueryAst = ast;
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

    setDistinctSetting(distinctSetting) {
        this.distinctSetting = distinctSetting;
        return this
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

    /**
     * 
     * @param {TableField[]} masterFields 
     * @returns {String[]}
     */
    static getAllExtendedAliasNames(masterFields) {
        const concatFields = [];
        for (const vField of masterFields) {
            for (const aliasName of vField.aliasNames) {
                if (aliasName.indexOf(".") !== -1) {
                    concatFields.push(aliasName);
                }
            }
        }

        return concatFields;
    }
}
