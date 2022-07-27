//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { DERIVEDTABLE, VirtualFields, VirtualField, SelectTables };
import { Table } from './Table.js';
import { Sql } from './Sql.js';
import { sqlCondition2JsCondition } from './SimpleParser.js';
import { Logger } from './SqlTest.js';
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
        this.masterTableInfo = tableInfo.get(this.primaryTable.toUpperCase());

        //  Keep a list of all possible fields from all tables.
        this.virtualFields.loadVirtualFields(this.primaryTable, tableInfo);

        //  Expand any 'SELECT *' fields and add the actual field names into 'astFields'.
        this.astFields = this.virtualFields.expandWildcardFields(this.masterTableInfo, this.astFields);

        //  Keep a list of fields that are SELECTED.
        this.virtualFields.updateSelectFieldList(astFields);
    }

    /**
     * 
     * @param {any[]} astJoin 
     */
    join(astJoin) {
        this.dataJoin = new JoinTables(astJoin, this.virtualFields);
    }

    /**
      * Retrieve filtered record ID's.
      * @param {Object} conditions 
      * @returns {Number[]}
      */
    whereCondition(conditions) {
        let sqlData = [];

        if (typeof conditions.logic == 'undefined')
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
        let recordIDs = [];

        for (let cond of terms) {
            if (typeof cond.logic == 'undefined') {
                recordIDs.push(this.getRecordIDs(cond));
            }
            else {
                recordIDs.push(this.resolveCondition(cond.logic, cond.terms));
            }
        }

        let result = [];
        if (logic == "AND") {
            result = recordIDs.reduce((a, b) => a.filter(c => b.includes(c)));
        }
        if (logic == "OR") {
            //  OR Logic
            let tempArr = [];
            for (let arr of recordIDs) {
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
        let recordIDs = [];
        /** @type {String} */
        let leftConstant = null;
        let leftCol = -1;
        /** @type {Table} */
        let leftTable = null;
        /** @type {String} */
        let rightConstant = null;
        let rightCol = -1;
        /** @type {Table} */
        let rightTable = null;
        /** @type {String} */
        let leftCalculatedField = "";
        /** @type {String} */
        let rightCalculatedField = "";

        [leftTable, leftCol, leftConstant, leftCalculatedField] = this.resolveFieldCondition(condition.left);
        [rightTable, rightCol, rightConstant, rightCalculatedField] = this.resolveFieldCondition(condition.right);

        /** @type {Table} */
        this.masterTable = this.dataJoin.isDerivedTable() ? this.dataJoin.getJoinedTableInfo() : this.masterTableInfo;

        for (let masterRecordID = 1; masterRecordID < this.masterTable.tableData.length; masterRecordID++) {
            let leftValue = null;
            let rightValue = null;

            if (leftCol >= 0) {
                leftValue = leftTable.tableData[masterRecordID][leftCol];
            }
            else if (leftCalculatedField != "") {
                leftValue = this.evaluateCalculatedField(leftCalculatedField, masterRecordID);
            }
            else
                leftValue = leftConstant;

            if (rightCol >= 0) {
                rightValue = rightTable.tableData[masterRecordID][rightCol];
            }
            else if (rightCalculatedField != "") {
                rightValue = this.evaluateCalculatedField(rightCalculatedField, masterRecordID);
            }
            else
                rightValue = rightConstant;

            if (leftValue == null || rightValue == null)
                continue;

            if (leftValue instanceof Date || rightValue instanceof Date) {
                leftValue = this.dateToMs(leftValue);
                rightValue = this.dateToMs(rightValue);
            }

            if (this.isConditionTrue(leftValue, condition.operator, rightValue))
                recordIDs.push(masterRecordID);

        }

        return recordIDs;
    }

    /**
     * 
     * @param {any} leftValue 
     * @param {String} operator 
     * @param {any} rightValue 
     * @returns 
     */
    isConditionTrue(leftValue, operator, rightValue) {
        let keep = false;
        operator = operator.toUpperCase();

        switch (operator) {
            case "=":
                keep = leftValue == rightValue;
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
                keep = leftValue != rightValue;
                break;

            case "!=":
                keep = leftValue != rightValue;
                break;

            case "LIKE":
                keep = this.likeCondition(leftValue, rightValue);
                break;

            case "NOT LIKE":
                keep = !(this.likeCondition(leftValue, rightValue));
                break;

            case "IN":
                keep = this.inCondition(leftValue, rightValue);
                break;

            case "NOT IN":
                keep = !(this.inCondition(leftValue, rightValue));
                break;

            default:
                throw ("Invalid Operator: " + operator);
        }

        return keep;
    }

    /**
     * 
     * @param {Number[]} recordIDs 
     * @returns {any[][]}
     */
    getViewData(recordIDs) {
        let virtualData = [];

        for (let masterRecordID of recordIDs) {
            if (this.masterTable.tableData[masterRecordID] == undefined)
                continue;

            let newRow = [];

            /** @type {SelectField} */
            let field;
            for (field of this.virtualFields.selectVirtualFields) {
                if (field.fieldInfo != null)
                    newRow.push(field.fieldInfo.getData(masterRecordID));
                else if (field.calculatedFormula != "") {
                    let result = this.evaluateCalculatedField(field.calculatedFormula, masterRecordID);
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
        let result;
        let functionString = this.sqlServerCalcFields(calculatedFormula, masterRecordID);
        try {
            result = new Function(functionString)();
        }
        catch (ex) {
            throw ("Calculated Field Error: " + ex.message + ".  " + functionString);
        }

        return result;
    }

    /**
     * 
     * @param {String} calculatedFormula 
     * @param {Number} masterRecordID
     * @returns {String}
     */
    sqlServerCalcFields(calculatedFormula, masterRecordID) {
        //  Working on a calculated field.

        let objectsDeclared = new Map();

        /** @type {VirtualField} */
        let vField;
        let myVars = "";
        for (vField of this.virtualFields.getAllVirtualFields()) {
            if (vField.fieldName == "*")
                continue;

            //  Non primary table fields require full notation for column
            if (this.masterTableInfo.tableName != vField.tableInfo.tableName) {
                if (vField.fieldName.indexOf(".") == -1)
                    continue;
            }

            //  The 'masterRecordID' is referencing masterTable, so fields from
            //  other tables should be excluded.
            if (this.masterTable != vField.tableInfo)
                continue;

            let varData = vField.getData(masterRecordID);
            if (typeof vField.getData(masterRecordID) == "string" || vField.getData(masterRecordID) instanceof Date)
                varData = "'" + vField.getData(masterRecordID) + "'";

            if (vField.fieldName.indexOf(".") == -1)
                myVars += "let " + vField.fieldName + " = " + varData + ";";
            else {
                let parts = vField.fieldName.split(".");
                if (!objectsDeclared.has(parts[0])) {
                    myVars += "let " + parts[0] + " = {};";
                    objectsDeclared.set(parts[0], true);
                }
                myVars += vField.fieldName + " = " + varData + ";";
            }
        }

        let functionString = this.sqlServerFunctions(calculatedFormula);

        return myVars + " return " + functionString;
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

        let sqlFunctions = ["ABS", "CASE", "CEILING", "CHARINDEX", "FLOOR", "IF", "LEFT", "LEN", "LENGTH", "LOG", "LOG10", "LOWER",
            "LTRIM", "NOW", "POWER", "RAND", "REPLICATE", "REVERSE", "RIGHT", "ROUND", "RTRIM",
            "SPACE", "STUFF", "SUBSTRING", "SQRT", "TRIM", "UPPER"];

        let functionString = this.toUpperCaseExceptQuoted(calculatedFormula);
        let firstCase = true;
        let matchStr;

        for (let func of sqlFunctions) {
            let args = SelectTables.parseForFunctions(functionString, func);

            let originalCaseStatement = "";
            let originalFunctionString = "";

            if (func == "CASE") {
                args = functionString.match(/CASE(.*?)END/i);

                if (args != null && args.length > 1) {
                    firstCase = true;
                    originalFunctionString = functionString;
                    originalCaseStatement = args[0];
                    functionString = args[1];
                    matchStr = new RegExp("WHEN(.*?)THEN(.*?)(?=WHEN|ELSE|$)|ELSE(.*?)(?=$)");
                    args = args[1].match(matchStr);
                }
            }

            while (args != null && args.length > 0) {
                // Split on COMMA, except within brackets.
                let parms = typeof args[1] == 'undefined' ? [] : this.parseForParams(args[1]);

                let replacement = "";
                switch (func) {
                    case "ABS":
                        replacement = "Math.abs(" + parms[0] + ")";
                        break;
                    case "CASE":
                        if (args.length > 2) {
                            if (typeof args[1] == 'undefined' && typeof args[2] == 'undefined') {
                                replacement = "else return " + args[3] + ";";
                            }
                            else {
                                if (firstCase) {
                                    replacement = "(() => {if (";
                                    firstCase = false;
                                }
                                else
                                    replacement = "else if (";
                                replacement += sqlCondition2JsCondition(args[1]) + ") return " + args[2] + " ;";
                            }
                        }
                        break;
                    case "CEILING":
                        replacement = "Math.ceil(" + parms[0] + ")";
                        break;
                    case "CHARINDEX":
                        if (typeof parms[2] == 'undefined')
                            replacement = parms[1] + ".indexOf(" + parms[0] + ") + 1";
                        else
                            replacement = parms[1] + ".indexOf(" + parms[0] + "," + parms[2] + " -1) + 1";
                        break;
                    case "FLOOR":
                        replacement = "Math.floor(" + parms[0] + ")";
                        break;
                    case "IF":
                        let ifCond = sqlCondition2JsCondition(parms[0]);
                        replacement = ifCond + " ? " + parms[1] + " : " + parms[2] + ";";
                        break;
                    case "LEFT":
                        replacement = parms[0] + ".substring(0," + parms[1] + ")";
                        break;
                    case "LEN":
                    case "LENGTH":
                        replacement = parms[0] + ".length";
                        break;
                    case "LOG":
                        replacement = "Math.log2(" + parms[0] + ")";
                        break;
                    case "LOG10":
                        replacement = "Math.log10(" + parms[0] + ")";
                        break;
                    case "LOWER":
                        replacement = parms[0] + ".toLowerCase()";
                        break;
                    case "LTRIM":
                        replacement = parms[0] + ".trimStart()";
                        break;
                    case "NOW":
                        replacement = "new Date().toLocaleString()";
                        break;
                    case "POWER":
                        replacement = "Math.pow(" + parms[0] + "," + parms[1] + ")";
                        break;
                    case "RAND":
                        replacement = "Math.random()";
                        break;
                    case "REPLICATE":
                        replacement = parms[0] + ".repeat(" + parms[1] + ")";
                        break;
                    case "REVERSE":
                        replacement = parms[0] + '.split("").reverse().join("")';
                        break;
                    case "RIGHT":
                        replacement = parms[0] + ".slice(" + parms[0] + ".length - " + parms[1] + ")";
                        break;
                    case "ROUND":
                        replacement = "Math.round(" + parms[0] + ")";
                        break;
                    case "RTRIM":
                        replacement = parms[0] + ".trimEnd()";
                        break;
                    case "SPACE":
                        replacement = "' '.repeat(" + parms[0] + ")";
                        break;
                    case "STUFF":
                        replacement = parms[0] + ".substring(0," + parms[1] + "-1" + ") + " + parms[3] + " + " + parms[0] + ".substring(" + parms[1] + " + " + parms[2] + " - 1)";
                        break;
                    case "SUBSTRING":
                        replacement = parms[0] + ".substring(" + parms[1] + " - 1, " + parms[1] + " + " + parms[2] + " - 1)";
                        break;
                    case "SQRT":
                        replacement = "Math.sqrt(" + parms[0] + ")";
                        break;
                    case "TRIM":
                        replacement = parms[0] + ".trim()";
                        break;
                    case "UPPER":
                        replacement = parms[0] + ".toUpperCase()";
                        break;
                }

                functionString = functionString.replace(args[0], replacement);

                if (func == "CASE")
                    args = functionString.match(matchStr);
                else
                    args = SelectTables.parseForFunctions(functionString, func);

            }

            if (originalCaseStatement != "") {
                functionString += "})();";      //  end of lambda.
                functionString = originalFunctionString.replace(originalCaseStatement, functionString);
            }
        }

        //  No need to recalculate for each row.
        this.sqlServerFunctionCache.set(calculatedFormula, functionString);

        return functionString;
    }

    /**
     * 
     * @param {String} srcString 
     * @returns {String}
     */
    toUpperCaseExceptQuoted(srcString) {
        let finalString = "";
        let inQuotes = "";

        for (let i = 0; i < srcString.length; i++) {
            let c = srcString.charAt(i);

            if (inQuotes == "") {
                if (c == '"' || c == "'")
                    inQuotes = c;
                c = c.toUpperCase();
            }
            else {
                if (c == inQuotes)
                    inQuotes = "";
            }

            finalString += c;
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
        let args = [];
        let expMatch = "%1\\s*\\(";

        let matchStr = new RegExp(expMatch.replace("%1", func));
        let startMatchPos = functionString.search(matchStr);
        if (startMatchPos != -1) {
            let searchStr = functionString.substring(startMatchPos);
            let i = searchStr.indexOf("(");
            let startLeft = i;
            let leftBracket = 1;
            for (i = i + 1; i < searchStr.length; i++) {
                let c = searchStr.charAt(i);
                if (c == "(") leftBracket++;
                if (c == ")") leftBracket--;

                if (leftBracket == 0) {
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
    parseForParams(paramString) {
        let args = [];
        let bracketCount = 0;
        let start = 0;

        for (let i = 0; i < paramString.length; i++) {
            let c = paramString.charAt(i);

            if (c == "," && bracketCount == 0) {
                args.push(paramString.substring(start, i));
                start = i + 1;
            }
            else if (c == "(")
                bracketCount++;
            else if (c == ")")
                bracketCount--;
        }

        let lastStr = paramString.substring(start);
        if (lastStr != "")
            args.push(lastStr);

        return args;
    }

    /**
     * 
     * @returns {Number}
     */
    getConglomerateFieldCount() {
        let count = 0;
        /** @type {SelectField} */
        let field;
        for (field of this.virtualFields.selectVirtualFields) {
            if (field.aggregateFunction != "")
                count++;
        }

        return count;
    }

    /**
    * 
    * @param {any[]} astGroupBy 
    * @param {any[][]} selectedData 
    * @returns {any[][]}
    */
    groupBy(astGroupBy, selectedData) {
        if (selectedData.length == 0)
            return;

        //  Sort the least important first, and most important last.
        let reverseOrderBy = astGroupBy.reverse();

        for (let orderField of reverseOrderBy) {
            let selectColumn = this.virtualFields.getSelectFieldColumn(orderField.column);

            if (selectColumn != -1) {
                this.sortByColumnASC(selectedData, selectColumn);
            }
        }

        let groupedData = [];
        let groupRecords = [];
        let lastKey = this.createGroupByKey(selectedData[0], astGroupBy);
        for (let row of selectedData) {
            let newKey = this.createGroupByKey(row, astGroupBy);
            if (newKey != lastKey) {
                groupedData.push(this.conglomerateRecord(groupRecords));

                lastKey = newKey;
                groupRecords = [];
            }
            groupRecords.push(row);
        }

        if (groupRecords.length > 0)
            groupedData.push(this.conglomerateRecord(groupRecords));

        return groupedData;
    }

    /**
     * 
     * @param {any[][]} groupRecords 
     * @returns {any[]}
     */
    conglomerateRecord(groupRecords) {
        let row = [];
        if (groupRecords.length == 0)
            return row;

        /** @type {SelectField} */
        let field;
        let i = 0;
        for (field of this.virtualFields.selectVirtualFields) {
            if (field.aggregateFunction == "")
                row.push(groupRecords[0][i]);
            else {
                let groupValue = 0;
                let avgCounter = 0;
                let first = true;

                for (let groupRow of groupRecords) {
                    if (groupRow[i] == 'null')
                        continue;

                    let data = parseFloat(groupRow[i]);
                    data = (isNaN(data)) ? 0 : data;

                    switch (field.aggregateFunction) {
                        case "SUM":
                            groupValue += data;
                            break;
                        case "COUNT":
                            groupValue++;
                            break;
                        case "MIN":
                            if (first)
                                groupValue = data;
                            if (data < groupValue)
                                groupValue = data;
                            break;
                        case "MAX":
                            if (first)
                                groupValue = data;
                            if (data > groupValue)
                                groupValue = data;
                            break;
                        case "AVG":
                            avgCounter++;
                            groupValue += data;
                            break;
                        default:
                            throw ("Invalid aggregate function: " + field.aggregateFunction);
                    }
                    first = false;
                }

                if (field.aggregateFunction == "AVG")
                    groupValue = groupValue / avgCounter;

                row.push(groupValue);
            }
            i++;

        }
        return row;
    }

    /**
     * 
     * @param {any[]} row 
     * @param {any[]} astGroupBy 
     * @returns 
     */
    createGroupByKey(row, astGroupBy) {
        let key = "";

        for (let orderField of astGroupBy) {
            let selectColumn = this.virtualFields.getSelectFieldColumn(orderField.column);
            if (selectColumn != -1)
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
        let groupTable = new Table(this.primaryTable).loadArrayData(selectedData);

        let tableMapping = new Map();
        tableMapping.set(this.primaryTable.toUpperCase(), groupTable);

        //  Set up for our SQL.
        let inSQL = new Sql([]).setTables(tableMapping);

        //  Fudge the HAVING to look like a SELECT.
        let astSelect = {};
        astSelect['FROM'] = [{ table: this.primaryTable }];
        astSelect['SELECT'] = [{ name: "*" }];
        astSelect['WHERE'] = astHaving;

        return inSQL.select(astSelect);
    }

    /**
     * 
     * @param {any[]} astOrderby 
     * @param {any[][]} selectedData 
     */
    orderBy(astOrderby, selectedData) {
        //  Sort the least important first, and most important last.
        let reverseOrderBy = astOrderby.reverse();

        for (let orderField of reverseOrderBy) {
            let selectColumn = this.virtualFields.getSelectFieldColumn(orderField.column);

            if (selectColumn != -1) {
                if (orderField.order == "DESC")
                    this.sortByColumnDESC(selectedData, selectColumn);
                else
                    this.sortByColumnASC(selectedData, selectColumn);
            }
        }
    }

    /**
     * 
     * @param {any[][]} tableData 
     * @param {Number} colIndex 
     * @returns {any[][]}
     */
    sortByColumnASC(tableData, colIndex) {

        tableData.sort(sortFunction);

        function sortFunction(a, b) {
            if (a[colIndex] === b[colIndex]) {
                return 0;
            }
            else {
                return (a[colIndex] < b[colIndex]) ? -1 : 1;
            }
        }

        return tableData;
    }

    /**
     * 
     * @param {any[][]} tableData 
     * @param {Number} colIndex 
     * @returns {any[][]}
     */
    sortByColumnDESC(tableData, colIndex) {

        tableData.sort(sortFunction);

        function sortFunction(a, b) {
            if (a[colIndex] === b[colIndex]) {
                return 0;
            }
            else {
                return (a[colIndex] > b[colIndex]) ? -1 : 1;
            }
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
        if (typeof fieldCondition['SELECT'] != 'undefined') {
            let inSQL = new Sql([]).setTables(this.tableInfo);
            inSQL.setBindValues(this.bindVariables);
            let inData = inSQL.select(fieldCondition);
            constantData = inData.join(",");
        }
        else if (this.isStringConstant(fieldCondition))
            constantData = this.extractStringConstant(fieldCondition);
        else if (fieldCondition == '?') {
            //  Bind variable data.
            if (this.bindVariables.length == 0)
                throw("Bind variable mismatch");
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
    isStringConstant(value) {
        return value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'");
    }

    /**
     * 
     * @param {String} value 
     * @returns {String}
     */
    extractStringConstant(value) {
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
    dateToMs(value) {
        let year = 0;
        let month = 0;
        let dayNum = 0;

        if (value instanceof Date) {
            year = value.getFullYear();
            month = value.getMonth();
            dayNum = value.getDate();
        }
        else if (typeof value == "string") {
            let dateParts = value.split("/");
            if (dateParts.length == 3) {
                year = parseInt(dateParts[2]);
                month = parseInt(dateParts[0]) - 1;
                dayNum = parseInt(dateParts[1]);
            }
        }

        let newDate = new Date(Date.UTC(year, month, dayNum, 12, 0, 0, 0));
        return newDate.getTime();
    }

    /**
     * 
     * @param {String} leftValue 
     * @param {String} rightValue 
     * @returns {Boolean}
     */
    likeCondition(leftValue, rightValue) {
        // @ts-ignore
        let expanded = rightValue.replace(/%/g, ".*").replace(/_/g, ".");

        let result = leftValue.search(expanded);
        return result != -1;
    }

    /**
     * 
     * @param {String} leftValue 
     * @param {String} rightValue 
     * @returns 
     */
    inCondition(leftValue, rightValue) {
        let items = rightValue.split(",");
        for (let i = 0; i < items.length; i++)
            items[i] = items[i].trimStart().trimEnd();

        let index = items.indexOf(leftValue);

        return index != -1;
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
    add(field) {
        this.virtualFieldMap.set(field.fieldName, field);
        this.virtualFieldList.push(field);
    }

    /**
     * 
     * @param {VirtualField} originalField 
     * @param {VirtualField} newField 
     */
    replaceVirtualField(originalField, newField) {
        let originalCol = originalField.tableColumn;
        let originalTable = originalField.tableInfo.tableName;

        for (let i = 0; i < this.virtualFieldList.length; i++) {
            if (originalCol == this.virtualFieldList[i].tableColumn &&
                originalTable == this.virtualFieldList[i].tableInfo.tableName) {
                //  Keep field object, just replace contents.
                this.virtualFieldList[i].tableColumn = newField.tableColumn;
                this.virtualFieldList[i].tableInfo = newField.tableInfo;
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
        if (field == null || typeof field != "string")
            throw ("SELECT syntax error.  Failed to retrieve field info.");

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
        let leftVirtual = name1;
        if (typeof name1 == "string")
            leftVirtual = this.getFieldInfo(name1);

        let rightVirtual = name2;
        if (typeof name2 == "string")
            rightVirtual = this.getFieldInfo(name2);

        if (leftVirtual != null && rightVirtual != null &&
            leftVirtual.tableInfo.tableName == rightVirtual.tableInfo.tableName &&
            leftVirtual.tableColumn == rightVirtual.tableColumn) {
            return true;
        }
        return false;
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
        let tableName;
        /** @type {Table} */
        let tableObject;
        // @ts-ignore
        for ([tableName, tableObject] of tableInfo.entries()) {
            let validFieldNames = tableObject.getAllFieldNames();

            for (let field of validFieldNames) {
                let tableColumn = tableObject.getFieldColumn(field);
                if (tableColumn != -1) {
                    //  If we have the same field name more than once (without the full DOT notation)
                    //  we only want the one for the primary table.
                    if (this.hasField(field)) {
                        if (tableName.toUpperCase() != primaryTable.toUpperCase())
                            continue;
                    }
                    let virtualField = new VirtualField(field, tableObject, tableColumn);
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
        let existingVirtualFieldsList = derivedTable.tableInfo.getAllVirtualFields();

        for (let field of existingVirtualFieldsList) {
            if (this.hasField(field.fieldName)) {
                let originalField = this.getFieldInfo(field.fieldName);
                this.replaceVirtualField(originalField, field);
            }
        }
    }

    removeNonDerivedTableVirtualFields() {
        /** @type {VirtualField[]} */
        let newVirtualFields = [];
        for (let fld of this.virtualFieldList) {
            if (fld.tableInfo.tableName == DERIVEDTABLE) {
                newVirtualFields.push(fld);
            }
            else if (this.virtualFieldMap.has(fld.fieldName)) {
                this.virtualFieldMap.delete(fld.fieldName);
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
    expandWildcardFields(masterTableInfo, astFields) {
        for (let i = 0; i < astFields.length; i++) {
            if (astFields[i].name == "*") {
                //  Replace wildcard will actual field names from master table.
                let masterTableFields = [];
                let allExpandedFields = masterTableInfo.getAllExtendedNotationFieldNames();

                for (let virtualField of allExpandedFields) {
                    let selField = { name: virtualField };
                    masterTableFields.push(selField);
                }

                astFields.splice(i, 1, ...masterTableFields);
                break;
            }
        }

        return astFields;
    }

    /**
     * 
     * @param {*} astFields 
     * @returns {SelectField[]}
     */
    updateSelectFieldList(astFields) {
        this.columnNames = [];
        this.columnTitles = [];
        this.selectVirtualFields = [];

        for (let selField of astFields) {
            //  If this is a CONGLOMERATE function, extract field name so that raw data
            //  from field is included.  The data will be accumulated by GROUP BY later.
            let columnName = selField.name;
            let aggregateFunctionName = "";
            let calculatedField = (typeof selField.terms == 'undefined') ? null : selField.terms;

            if (calculatedField == null && !this.hasField(columnName)) {
                const functionNameRegex = /[a-zA-Z]*(?=\()/;
                let matches = columnName.match(functionNameRegex)
                if (matches != null && matches.length > 0)
                    aggregateFunctionName = matches[0];

                matches = SelectTables.parseForFunctions(columnName, aggregateFunctionName);
                if (matches != null && matches.length > 1)
                    columnName = matches[1];
            }

            this.columnTitles.push(typeof selField.as != 'undefined' && selField.as != "" ? selField.as : selField.name);

            if (calculatedField == null && this.hasField(columnName)) {
                let fieldInfo = this.getFieldInfo(columnName);
                let selectFieldInfo = new SelectField(fieldInfo);
                selectFieldInfo.aggregateFunction = aggregateFunctionName;

                this.selectVirtualFields.push(selectFieldInfo);
                this.columnNames.push(selField.name);
            }
            else if (calculatedField != null) {
                let selectFieldInfo = new SelectField(null);
                selectFieldInfo.calculatedFormula = selField.name;
                this.selectVirtualFields.push(selectFieldInfo);
                this.columnNames.push(selField.name);
            }
            else if (columnName != "") {
                //  is this a function?
                let selectFieldInfo = new SelectField(null);
                selectFieldInfo.calculatedFormula = columnName;
                selectFieldInfo.aggregateFunction = aggregateFunctionName;
                this.selectVirtualFields.push(selectFieldInfo);
                this.columnNames.push(selField.name);
            }
        }

        return this.selectVirtualFields;
    }

    /**
     * 
     * @param {String} fieldName 
     * @returns {Number}
     */
    getSelectFieldColumn(fieldName) {
        for (let i = 0; i < this.selectVirtualFields.length; i++) {
            if (this.isSameField(this.selectVirtualFields[i].fieldInfo, fieldName) && this.selectVirtualFields[i].aggregateFunction == "")
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

class JoinTables {
    /**
     * 
     * @param {any[]} astJoin 
     * @param {VirtualFields} virtualFields 
     */
    constructor(astJoin, virtualFields) {
        /** @type {DerivedTable} */
        this.derivedTable = new DerivedTable();

        for (let joinTable of astJoin) {
            /** @type {VirtualField} */
            let leftFieldInfo = this.derivedTable.getFieldInfo(joinTable.cond.left);
            if (leftFieldInfo == null)
                leftFieldInfo = virtualFields.getFieldInfo(joinTable.cond.left);
            if (leftFieldInfo == null)
                throw ("Invalid JOIN field: " + joinTable.cond.left);

            /** @type {VirtualField} */
            let rightFieldInfo = this.derivedTable.getFieldInfo(joinTable.cond.right);
            if (rightFieldInfo == null)
                rightFieldInfo = virtualFields.getFieldInfo(joinTable.cond.right);
            if (rightFieldInfo == null)
                throw ("Invalid JOIN field: " + joinTable.cond.right);

            this.derivedTable = this.joinTables(leftFieldInfo, rightFieldInfo, joinTable);

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
    joinTables(leftFieldInfo, rightFieldInfo, joinTable) {
        let matchedRecordIDs = [];
        let derivedTable = null;

        switch (joinTable.type) {
            case "left":
                matchedRecordIDs = this.leftRightJoin(leftFieldInfo, rightFieldInfo, joinTable.type);
                derivedTable = new DerivedTable()
                    .setLeftField(leftFieldInfo)
                    .setRightField(rightFieldInfo)
                    .setLeftRecords(matchedRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();
                break;

            case "inner":
                matchedRecordIDs = this.leftRightJoin(leftFieldInfo, rightFieldInfo, joinTable.type);
                derivedTable = new DerivedTable()
                    .setLeftField(leftFieldInfo)
                    .setRightField(rightFieldInfo)
                    .setLeftRecords(matchedRecordIDs)
                    .setIsOuterJoin(false)
                    .createTable();
                break;

            case "right":
                matchedRecordIDs = this.leftRightJoin(rightFieldInfo, leftFieldInfo, joinTable.type);
                derivedTable = new DerivedTable()
                    .setLeftField(rightFieldInfo)
                    .setRightField(leftFieldInfo)
                    .setLeftRecords(matchedRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();

                break;

            case "full":
                let leftJoinRecordIDs = this.leftRightJoin(leftFieldInfo, rightFieldInfo, joinTable.type);
                derivedTable = new DerivedTable()
                    .setLeftField(leftFieldInfo)
                    .setRightField(rightFieldInfo)
                    .setLeftRecords(leftJoinRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();                

                let rightJoinRecordIDs = this.leftRightJoin(rightFieldInfo, leftFieldInfo, "outer");
                let rightDerivedTable = new DerivedTable()
                    .setLeftField(rightFieldInfo)
                    .setRightField(leftFieldInfo)
                    .setLeftRecords(rightJoinRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();  

                derivedTable.tableInfo.concat(rightDerivedTable.tableInfo);

                break;
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
    leftRightJoin(leftField, rightField, type) {
        let leftRecordsIDs = [];

        //  First record is the column title.
        leftRecordsIDs.push([0]);

        /** @type {any[][]} */
        let leftTableData = leftField.tableInfo.tableData;
        let leftTableCol = leftField.tableColumn;

        rightField.tableInfo.addIndex(rightField.fieldName);

        for (let leftTableRecordNum = 1; leftTableRecordNum < leftTableData.length; leftTableRecordNum++) {

            let keyMasterJoinField = leftTableData[leftTableRecordNum][leftTableCol];

            let joinRows = rightField.tableInfo.search(rightField.fieldName, keyMasterJoinField);
            //  For the current LEFT TABLE record, record the linking RIGHT TABLE records.
            if (joinRows.length == 0) {
                if (type == "inner")
                    continue;

                leftRecordsIDs[leftTableRecordNum] = [-1];
            }
            else {
                //  Excludes all match recordgs (is outer the right word for this?)
                if (type == "outer")
                    continue;

                leftRecordsIDs[leftTableRecordNum] = joinRows;
            }
        }

        return leftRecordsIDs;
    }
}

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
        let columnCount = this.rightField.tableInfo.getColumnCount();
        let emptyRightRow = Array(columnCount).fill("");

        let joinedData = [this.getCombinedColumnTitles(this.leftField, this.rightField)];

        for (let i = 1; i < this.leftField.tableInfo.tableData.length; i++) {
            if (typeof this.leftRecords[i] != "undefined") {
                if (typeof this.rightField.tableInfo.tableData[this.leftRecords[i][0]] == "undefined")
                    joinedData.push(this.leftField.tableInfo.tableData[i].concat(emptyRightRow));
                else {
                    let maxJoin = this.isOuterJoin ? this.leftRecords[i].length : 1;
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
        return this.tableInfo != null;
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
        return this.tableInfo == null ? null : this.tableInfo.getVirtualFieldInfo(field);
    }

    /**
     * 
     * @param {VirtualField} leftField 
     * @param {VirtualField} rightField 
     * @returns {String[]}
     */
    getCombinedColumnTitles(leftField, rightField) {
        let titleRow = leftField.tableInfo.getAllExtendedNotationFieldNames();
        let rightFieldNames = rightField.tableInfo.getAllExtendedNotationFieldNames();
        return titleRow.concat(rightFieldNames);
    }
}