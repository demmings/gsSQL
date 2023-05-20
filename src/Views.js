/*  *** DEBUG START ***
//  Remove comments for testing in NODE

export { DERIVEDTABLE, VirtualFields, VirtualField, SelectTables, TableFields, TableField, CalculatedField, SqlServerFunctions, DerivedTable };
import { Table } from './Table.js';
import { Sql, BindData } from './Sql.js';
import { SqlParse } from './SimpleParser.js';
import { JoinTables } from './JoinTables.js';
//  *** DEBUG END ***/

const DERIVEDTABLE = "::DERIVEDTABLE::";

/** 
 * @classdesc 
 * Perform SQL SELECT operations to retrieve requested data. 
 */
class SelectTables {
    /**
     * @param {Object} ast - Abstract Syntax Tree
     * @param {Map<String,Table>} tableInfo - Map of table info.
     * @param {BindData} bindVariables - List of bind data.
     */
    constructor(ast, tableInfo, bindVariables) {
        /** @property {String} - primary table name. */
        this.primaryTable = ast.FROM.table;

        /** @property {Object} - AST of SELECT fields */
        this.astFields = ast.SELECT;

        /** @property {Map<String,Table>} tableInfo - Map of table info. */
        this.tableInfo = tableInfo;

        /** @property {BindData} - Bind variable data. */
        this.bindVariables = bindVariables;

        /** @property {TableFields} */
        this.tableFields = new TableFields();

        /** @property {Table} - Primary table info. */
        this.primaryTableInfo = tableInfo.get(this.primaryTable.toUpperCase());

        /** @property {JoinTables} - Join table object. */
        this.dataJoin = new JoinTables()
            .setTableFields(this.tableFields)
            .setTableInfo(this.tableInfo)
            .setBindVariables(bindVariables)
            .setPrimaryTableInfo(this.primaryTableInfo);

        if (!tableInfo.has(this.primaryTable.toUpperCase()))
            throw new Error(`Invalid table name: ${this.primaryTable}`);

        //  Keep a list of all possible fields from all tables.
        this.tableFields.loadVirtualFields(this.primaryTable, tableInfo);
    }

    /**
     * Update internal FIELDS list to indicate those fields that are in the SELECT fields - that will be returned in data.
     * @param {Object} ast
     * @returns {void} 
     */
    updateSelectedFields(ast) {
        let astFields = ast.SELECT;

        const tableInfo = !this.dataJoin.isDerivedTable() ? this.primaryTableInfo : this.dataJoin.derivedTable.tableInfo;

        //  Expand any 'SELECT *' fields and add the actual field names into 'astFields'.
        astFields = VirtualFields.expandWildcardFields(tableInfo, astFields);

        //  Define the data source of each field in SELECT field list.
        this.tableFields.updateSelectFieldList(astFields, 0, false);

        //  These are fields REFERENCED, but not actually in the SELECT FIELDS.
        //  So columns referenced by GROUP BY, ORDER BY and not in SELECT.
        //  These temp columns need to be removed after processing.
        if (typeof ast["GROUP BY"] !== 'undefined') {
            this.tableFields.updateSelectFieldList(ast["GROUP BY"], this.tableFields.getNextSelectColumnNumber(), true);
        }

        if (typeof ast["ORDER BY"] !== 'undefined') {
            this.tableFields.updateSelectFieldList(ast["ORDER BY"], this.tableFields.getNextSelectColumnNumber(), true);
        }
    }

    /**
     * Process any JOIN condition.
     * @param {Object} ast - Abstract Syntax Tree
     * @returns {void}
     */
    join(ast) {
        if (typeof ast.JOIN !== 'undefined')
            this.dataJoin.load(ast);
    }

    /**
     * Retrieve filtered record ID's.
     * @param {Object} ast - Abstract Syntax Tree
     * @returns {Number[]} - Records ID's that match WHERE condition.
     */
    whereCondition(ast) {
        let sqlData = [];

        let conditions = {};
        if (typeof ast.WHERE !== 'undefined') {
            conditions = ast.WHERE;
        }
        else if (typeof ast["GROUP BY"] === 'undefined' && typeof ast.HAVING !== 'undefined') {
            //  This will work in mySql as long as select field is in having clause.
            conditions = ast.HAVING;
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
    * Recursively resolve WHERE condition and then apply AND/OR logic to results.
    * @param {String} logic - logic condition (AND/OR) between terms
    * @param {Object} terms - terms of WHERE condition (value compared to value)
    * @returns {Number[]} - record ID's 
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
    * Find record ID's where condition is TRUE.
    * @param {Object} condition - WHERE test condition
    * @returns {Number[]} - record ID's which are true.
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
     * Evaulate value on left/right side of condition
     * @param {ResolvedFieldCondition} fieldConditions - the value to be found will come from:
     * * constant data
     * * field data
     * * calculated field
     * * sub-query 
     * @param {CalculatedField} calcSqlField - data to resolve the calculated field.
     * @param {Number} masterRecordID - current record in table to grab field data from
     * @returns {any} - resolve value.
     */
    static getConditionValue(fieldConditions, calcSqlField, masterRecordID) {
        let leftValue = fieldConditions.constantData;
        if (fieldConditions.columnNumber >= 0) {
            leftValue = fieldConditions.fieldConditionTableInfo.tableData[masterRecordID][fieldConditions.columnNumber];
        }
        else if (fieldConditions.calculatedField !== "") {
            if (fieldConditions.calculatedField.toUpperCase() === "NULL") {
                leftValue = "NULL";
            }
            else {
                leftValue = calcSqlField.evaluateCalculatedField(fieldConditions.calculatedField, masterRecordID);
            }
        }
        else if (fieldConditions.subQuery !== null) {
            const arrayResult = fieldConditions.subQuery.select(masterRecordID, calcSqlField);
            if (typeof arrayResult !== 'undefined' && arrayResult !== null && arrayResult.length > 0)
                leftValue = arrayResult[0][0];
        }

        return leftValue;
    }

    /**
     * Compare where term values using operator and see if comparision is true.
     * @param {any} leftValue - left value of condition
     * @param {String} operator - operator for comparision
     * @param {any} rightValue  - right value of condition
     * @returns {Boolean} - is comparison true.
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
                keep = SelectTables.notLikeCondition(leftValue, rightValue);
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

            case "EXISTS":
                keep = SelectTables.existsCondition(rightValue);
                break;

            case "NOT EXISTS":
                keep = !(SelectTables.existsCondition(rightValue));
                break;

            default:
                throw new Error(`Invalid Operator: ${operator}`);
        }

        return keep;
    }

    /**
     * Retrieve the data for the record ID's specified for ALL SELECT fields.
     * @param {Number[]} recordIDs - record ID's which are SELECTed.
     * @returns {any[][]} - double array of select data.  No column title is included here.
     */
    getViewData(recordIDs) {
        const virtualData = [];
        const calcSqlField = new CalculatedField(this.masterTable, this.primaryTableInfo, this.tableFields);
        const subQuery = new CorrelatedSubQuery(this.tableInfo, this.tableFields, this.bindVariables);

        for (const masterRecordID of recordIDs) {
            const newRow = [];

            for (const field of this.tableFields.getSelectFields()) {
                if (field.tableInfo !== null)
                    newRow.push(field.getData(masterRecordID));
                else if (field.subQueryAst !== null) {
                    const result = subQuery.select(masterRecordID, calcSqlField, field.subQueryAst);
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
     * Returns the entire string in UPPER CASE - except for anything between quotes.
     * @param {String} srcString - source string to convert.
     * @returns {String} - converted string.
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
            else if (ch === inQuotes) {
                inQuotes = "";
            }

            finalString += ch;
        }

        return finalString;
    }

    /**
     * Parse input string for 'func' and then parse if found.
     * @param {String} functionString - Select field which may contain a function.
     * @param {String} func - Function name to parse for.
     * @returns {String[]} - Parsed function string.
     *   * null if function not found, 
     *   * string array[0] - original string, e.g. **sum(quantity)**
     *   * string array[1] - function parameter, e.g. **quantity**
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
     * Parse the input for a calculated field.
     * String split on comma, EXCEPT if comma is within brackets (i.e. within an inner function)
     * or within a string like ", "
     * @param {String} paramString - Search and parse this string for parameters.
     * @returns {String[]} - List of function parameters.
     */
    static parseForParams(paramString, startBracket = "(", endBracket = ")") {
        const args = [];
        let bracketCount = 0;
        let inQuotes = "";
        let start = 0;

        for (let i = 0; i < paramString.length; i++) {
            const ch = paramString.charAt(i);

            if (ch === "," && bracketCount === 0 && inQuotes === "") {
                args.push(paramString.substring(start, i));
                start = i + 1;
            }
            else {
                bracketCount += SelectTables.functionBracketCounter(ch, startBracket, endBracket);
            }

            inQuotes = SelectTables.checkIfWithinString(ch, inQuotes);
        }

        const lastStr = paramString.substring(start);
        if (lastStr !== "")
            args.push(lastStr);

        return args;
    }

    /**
     * Track net brackets encountered in string.
     * @param {String} ch 
     * @param {String} startBracket 
     * @param {String} endBracket 
     * @returns {Number}
     */
    static functionBracketCounter(ch, startBracket, endBracket) {
        let counter = 0;
        if (ch === startBracket)
            counter = 1;
        else if (ch === endBracket)
            counter = -1;

        return counter;
    }

    /**
     * Track if current ch(ar) is within quotes.
     * @param {String} ch 
     * @param {String} inQuotes 
     * @returns {String} - Returns empty string if not within a string constant.
     * If it is within a string, it will return either a single or double quote so we can
     * determine when the string ends (it will match the starting quote.)
     */
    static checkIfWithinString(ch, inQuotes) {
        if (inQuotes === "") {
            if (ch === '"' || ch === "'")
                return ch;
        }
        else if (ch === inQuotes) {
            return "";
        }

        return inQuotes;
    }

    /**
     * Compress the table data so there is one record per group (fields in GROUP BY).
     * The other fields MUST be aggregate calculated fields that works on the data in that group.
     * @param {Object} ast - Abstract Syntax Tree
     * @param {any[][]} viewTableData - Table data.
     * @returns {any[][]} - Aggregated table data.
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
    * Group table data by group fields.
    * @param {any[]} astGroupBy - AST group by fields.
    * @param {any[][]} selectedData - table data
    * @returns {any[][]} - compressed table data
    */
    groupByFields(astGroupBy, selectedData) {
        if (selectedData.length === 0)
            return selectedData;

        //  Sort the least important first, and most important last.
        astGroupBy.reverse();

        for (const orderField of astGroupBy) {
            const selectColumn = this.tableFields.getSelectFieldColumn(orderField.name);
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
     * Create a composite key that is comprised from all field data in group by clause.
     * @param {any[]} row  - current row of data.
     * @param {any[]} astGroupBy - group by fields
     * @returns {String} - group key
     */
    createGroupByKey(row, astGroupBy) {
        let key = "";

        for (const orderField of astGroupBy) {
            const selectColumn = this.tableFields.getSelectFieldColumn(orderField.name);
            if (selectColumn !== -1)
                key += row[selectColumn].toString();
        }

        return key;
    }

    /**
    * Take the compressed data from GROUP BY and then filter those records using HAVING conditions.
    * @param {Object} astHaving - AST HAVING conditons
    * @param {any[][]} selectedData - compressed table data (from group by)
    * @returns {any[][]} - filtered data using HAVING conditions.
    */
    having(astHaving, selectedData) {
        //  Add in the title row for now
        selectedData.unshift(this.tableFields.getColumnNames());

        //  Create our virtual GROUP table with data already selected.
        const groupTable = new Table(this.primaryTable).loadArrayData(selectedData);

        /** @type {Map<String, Table>} */
        const tableMapping = new Map();
        tableMapping.set(this.primaryTable.toUpperCase(), groupTable);

        //  Set up for our SQL.
        const inSQL = new Sql().setTables(tableMapping);

        //  Fudge the HAVING to look like a SELECT.
        const astSelect = {};
        astSelect.FROM = { table: this.primaryTable, as: '' };
        astSelect.SELECT = [{ name: "*" }];
        astSelect.WHERE = astHaving;

        return inSQL.execute(astSelect);
    }

    /**
     * Take select data and sort by columns specified in ORDER BY clause.
     * @param {Object} ast - Abstract Syntax Tree for SELECT
     * @param {any[][]} selectedData - Table data to sort.  On function return, this array is sorted.
     */
    orderBy(ast, selectedData) {
        if (typeof ast['ORDER BY'] === 'undefined')
            return;

        const astOrderby = ast['ORDER BY']

        //  Sort the least important first, and most important last.
        const reverseOrderBy = astOrderby.reverse();

        for (const orderField of reverseOrderBy) {
            const selectColumn = this.tableFields.getSelectFieldColumn(orderField.name);

            if (selectColumn === -1) {
                throw new Error(`Invalid ORDER BY: ${orderField.name}`);
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
     * Removes temporary fields from return data.  These temporary fields were needed to generate
     * the final table data, but are not included in the SELECT fields for final output.
     * @param {any[][]} viewTableData - table data that may contain temporary columns.
     * @returns {any[][]} - table data with temporary columns removed.
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
     * @param {Object} ast 
     * @param {any[][]} viewTableData 
     * @returns {any[][]}
     */
    static limit(ast, viewTableData) {
        if (typeof ast.LIMIT !== 'undefined') {
            const maxItems = ast.LIMIT.nb;
            if (viewTableData.length > maxItems)
                viewTableData.splice(maxItems);
        }

        return viewTableData;
    }

    /**
     * Sort the table data from lowest to highest using the data in colIndex for sorting.
     * @param {any[][]} tableData - table data to sort.
     * @param {Number} colIndex - column index which indicates which column to use for sorting.
     * @returns {any[][]} - sorted table data.
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
     * Sort the table data from highest to lowest using the data in colIndex for sorting.
     * @param {any[][]} tableData - table data to sort.
     * @param {Number} colIndex - column index which indicates which column to use for sorting.
     * @returns {any[][]} - sorted table data.
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
     * @typedef {Object} ResolvedFieldCondition
     * @property {Table} fieldConditionTableInfo
     * @property {Number} columnNumber - use column data from this column, unless -1.
     * @property {String} constantData - constant data used for column, unless null.
     * @property {String} calculatedField - calculation of data for column, unless empty.
     * @property {CorrelatedSubQuery} subQuery - use this correlated subquery object if not null. 
     * 
     */
    /**
     * Determine what the source of value is for the current field condition.
     * @param {Object} fieldCondition - left or right portion of condition
     * @returns {ResolvedFieldCondition}
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
        /** @type {CorrelatedSubQuery} */
        let subQuery = null;

        if (typeof fieldCondition.SELECT !== 'undefined') {
            //  Maybe a SELECT within...
            [subQuery, constantData] = this.resolveSubQuery(fieldCondition);
        }
        else if (SelectTables.isStringConstant(fieldCondition))
            //  String constant
            constantData = SelectTables.extractStringConstant(fieldCondition);
        else if (fieldCondition.startsWith('?')) {
            //  Bind variable data.
            constantData = this.resolveBindData(fieldCondition);
        }
        else if (!isNaN(fieldCondition)) {
            //  Literal number.
            constantData = fieldCondition;
        }
        else if (this.tableFields.hasField(fieldCondition)) {
            //  Table field.
            columnNumber = this.tableFields.getFieldColumn(fieldCondition);
            fieldConditionTableInfo = this.tableFields.getTableInfo(fieldCondition);
        }
        else {
            //  Calculated field?
            calculatedField = fieldCondition;
        }

        return { fieldConditionTableInfo, columnNumber, constantData, calculatedField, subQuery };
    }

    /**
     * Handle subquery.  If correlated subquery, return object to handle, otherwise resolve and return constant data.
     * @param {Object} fieldCondition - left or right portion of condition
     * @returns {any[]}
     */
    resolveSubQuery(fieldCondition) {
        /** @type {CorrelatedSubQuery} */
        let subQuery = null;
        /** @type {String} */
        let constantData = null;

        if (SelectTables.isCorrelatedSubQuery(fieldCondition)) {
            subQuery = new CorrelatedSubQuery(this.tableInfo, this.tableFields, this.bindVariables, fieldCondition);
        }
        else {
            const subQueryTableInfo = SelectTables.getSubQueryTableSet(fieldCondition, this.tableInfo);
            const inData = new Sql()
                .setTables(subQueryTableInfo)
                .setBindValues(this.bindVariables)
                .execute(fieldCondition);

            constantData = inData.join(",");
        }

        return [subQuery, constantData];
    }

    /**
     * Get constant bind data
     * @param {String} fieldCondition - left or right portion of condition
     * @returns {any}
     */
    resolveBindData(fieldCondition) {
        //  Bind variable data.
        const constantData = this.bindVariables.get(fieldCondition);
        if (typeof constantData === 'undefined') {
            if (fieldCondition === '?') {
                throw new Error("Bind variable naming is ?1, ?2... where ?1 is first bind data point in list.")
            }
            else {
                throw new Error(`Bind variable ${fieldCondition} was not found`);
            }
        }

        return constantData;
    }

    /**
     * 
     * @param {Object} ast 
     * @returns {Boolean}
     */
    static isCorrelatedSubQuery(ast) {
        const tableSet = new Map();
        Sql.extractAstTables(ast, tableSet);

        const tableSetCorrelated = new Map();
        if (typeof ast.WHERE !== 'undefined') {
            Sql.getTableNamesWhereCondition(ast.WHERE, tableSetCorrelated);
        }

        // @ts-ignore
        for (const tableName of tableSetCorrelated.keys()) {
            let isFound = false;
            // @ts-ignore
            for (const outerTable of tableSet.keys()) {
                if (outerTable === tableName || tableSet.get(outerTable) === tableName) {
                    isFound = true;
                    break;
                }
            }
            if (!isFound) {
                return true;
            }
        }

        return false;
    }

    /**
     * Create a set of tables that are used in sub-query.
     * @param {Object} ast - Sub-query AST.
     * @param {Map<String,Table>} tableInfo - Master set of tables used for entire select.
     * @returns {Map<String,Table>} - table set for sub-query.
     */
    static getSubQueryTableSet(ast, tableInfo) {
        const tableSubSet = new Map();
        const selectTables = Sql.getReferencedTableNamesFromAst(ast);

        for (const found of selectTables) {
            if (found[0] !== "" && !tableSubSet.has(found[0])) {
                tableSubSet.set(found[0], tableInfo.get(found[0]));
            }
            if (found[1] !== "" && !tableSubSet.has(found[1])) {
                tableSubSet.set(found[1], tableInfo.get(found[1]));
            }
        }

        return tableSubSet;
    }

    /**
     * Is the string a constant in the SELECT condition.  
     * @param {String} value - condition to test
     * @returns {Boolean} - Is this string a constant.
     */
    static isStringConstant(value) {
        return value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'");
    }

    /**
     * Extract the string literal out of condition.  This removes surrounding quotes.
     * @param {String} value - String that encloses literal string data.
     * @returns {String} - String with quotes removed.
     */
    static extractStringConstant(value) {
        if (value.startsWith('"') && value.endsWith('"'))
            return value.replace(/"/g, '');

        if (value.startsWith("'") && value.endsWith("'"))
            return value.replace(/'/g, '');

        return value;
    }

    /**
     * Convert input into milliseconds.
     * @param {any} value - date as as Date or String.
     * @returns {Number} - date as ms.
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
                year = Number(dateParts[2]);
                month = Number(dateParts[0]) - 1;
                dayNum = Number(dateParts[1]);
            }
        }

        const newDate = new Date(Date.UTC(year, month, dayNum, 12, 0, 0, 0));
        return newDate.getTime();
    }

    /**
     * Compare strings in LIKE condition
     * @param {String} leftValue - string for comparison
     * @param {String} rightValue - string with wildcard
     * @returns {Boolean} - Do strings match?
     */
    static likeCondition(leftValue, rightValue) {
        if ((leftValue === null || rightValue === null) && !(leftValue === null && rightValue === null)) {
            return false;
        }

        return SelectTables.likeConditionMatch(leftValue, rightValue) !== -1;
    }

    /**
     * Compare strings in NOT LIKE condition
     * @param {String} leftValue - string for comparison
     * @param {String} rightValue - string with wildcard
     * @returns {Boolean} - Do strings NOT match?
     */
    static notLikeCondition(leftValue, rightValue) {
        if ((leftValue === null || rightValue === null) && !(leftValue === null && rightValue === null)) {
            return false;
        }

        return SelectTables.likeConditionMatch(leftValue, rightValue) === -1;
    }

    /**
     * Compare strings in (NOT) LIKE condition
     * @param {String} leftValue - string for comparison
     * @param {String} rightValue - string with wildcard
     * @returns {Number} - Found position (not found === -1)
     */
    static likeConditionMatch(leftValue, rightValue) {
        // @ts-ignore
        const expanded = `^${rightValue.replace(/%/g, ".*").replace(/_/g, ".")}`;

        const result = leftValue.search(expanded);

        return result;
    }

    /**
     * Check if leftValue is contained in list in rightValue
     * @param {any} leftValue - value to find in right value
     * @param {String} rightValue - list of comma separated values
     * @returns {Boolean} - Is contained IN list.
     */
    static inCondition(leftValue, rightValue) {
        let items = [];
        if (typeof rightValue === 'string') {
            items = rightValue.split(",");
        }
        else {
            //  select * from table WHERE IN (select number from table)
            // @ts-ignore
            items = [rightValue.toString()];
        }

        items = items.map(a => a.trim());

        let index = items.indexOf(leftValue);
        if (index === -1 && typeof leftValue === 'number') {
            index = items.indexOf(leftValue.toString());
        }

        return index !== -1;
    }

    /**
     * If leftValue is empty (we will consider that as NULL), condition will be true
     * @param {any} leftValue - test this value for NULL
     * @param {any} rightValue - 'NULL' considered as NULL.
     * @returns {Boolean} - Is leftValue NULL (like).
     */
    static isCondition(leftValue, rightValue) {
        return (leftValue === "" && rightValue === "NULL");
    }

    /**
     * Test if input is not empty
     * @param {*} rightValue - value to check if empty
     * @returns - true if NOT empty
     */
    static existsCondition(rightValue) {
        return rightValue !== '';
    }

    /**
     * Return a list of column titles for this table.
     * @param {String} columnTableNameReplacement
     * @returns {String[]} - column titles
     */
    getColumnTitles(columnTableNameReplacement) {
        return this.tableFields.getColumnTitles(columnTableNameReplacement);
    }
}

/** 
 * @classdesc 
 * Evaulate calculated fields in SELECT statement.  This is achieved by converting the request 
 * into javascript and then using 'Function' to evaulate it.  
 */
class CalculatedField {
    /**
     * 
     * @param {Table} masterTable - JOINed table (unless not joined, then primary table)
     * @param {Table} primaryTable - First table in SELECT
     * @param {TableFields} tableFields - All fields from all tables
     */
    constructor(masterTable, primaryTable, tableFields) {
        /** @property {Table} */
        this.masterTable = masterTable;
        /** @property {Table} */
        this.primaryTable = primaryTable;
        /** @property {Map<String,String>} - Map key=calculated field in SELECT, value=javascript equivalent code */
        this.sqlServerFunctionCache = new Map();
        /** @property {TableField[]} */
        this.masterFields = tableFields.allFields.filter((vField) => this.masterTable === vField.tableInfo);

        /** @property {Map<String, TableField>} */
        this.mapMasterFields = new Map();
        this.masterFields.forEach(fld => this.mapMasterFields.set(fld.fieldName, fld));
    }

    /**
     * Get data from the table for the requested field name and record number
     * @param {String} fldName - Name of field to get data for.
     * @param {Number} masterRecordID - The row number in table to extract data from.
     * @returns {any} - Data from table.  undefined if not found.
     */
    getData(fldName, masterRecordID) {
        const vField = this.mapMasterFields.get(fldName);
        if (typeof vField === 'undefined')
            return vField;

        return vField.getData(masterRecordID);
    }

    /**
     * Evaluate the calculated field for the current table record and return a value.
     * @param {String} calculatedFormula - calculation from SELECT statement
     * @param {Number} masterRecordID - current record ID.
     * @returns {any} - Evaluated data from calculation.
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
            if (calculatedFormula !== '') {
                throw new Error(`Invalid select field: ${calculatedFormula}`);
            }

            throw new Error(`Calculated Field Error: ${ex.message}.  ${functionString}`);
        }

        return result;
    }

    /**
     * The program is attempting to build some javascript code which we can then execute to 
     * find the value of the calculated field.  There are two parts.
     * 1)  Build LET statements to assign to all possible field name variants,
     * 2)  Add the 'massaged' calculated field so that it can be run in javascript.
     * @param {String} calculatedFormula - calculation from SELECT statement
     * @param {Number} masterRecordID - current table record ID.
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

            if (typeof varData === "string") {
                varData = `'${varData.replace(/'/g, "\\'")}'`;
            }
            else if (varData instanceof Date) {
                varData = `'${varData}'`;
            }

            myVars += this.createAssignmentStatments(vField, objectsDeclared, variablesDeclared, varData);
        }

        const functionString = this.sqlServerFunctions(calculatedFormula);

        return `${myVars} return ${functionString}`;
    }

    /**
     * Creates a javascript code block.  For the current field (vField), a variable is assigned the appropriate
     * value from 'varData'.  For example, if the column was 'ID' and the table was 'BOOKS'.
     * ```
     * "let BOOKS = {};BOOKS.ID = '9';"
     * ```
     * If the BOOKS object had already been declared, later variables would just be:
     * ```
     * "BOOKS.NAME = 'To Kill a Blue Jay';"
     * ```
     * @param {TableField} vField - current field that LET statements will be assigning to.
     * @param {Map<String, Boolean>} objectsDeclared - tracks if TABLE name was been encountered yet.
     * @param {Map<String, Boolean>} variablesDeclared - tracks if variables has already been assigned.
     * @param {String} varData - the data from the table that will be assigned to the variable.
     * @returns {String} - the javascript code block.
     */
    createAssignmentStatments(vField, objectsDeclared, variablesDeclared, varData) {
        let myVars = "";

        for (const aliasName of vField.aliasNames) {
            if ((this.primaryTable.tableName !== vField.tableInfo.tableName && aliasName.indexOf(".") === -1)) {
                continue;
            }

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

/** 
 * @classdesc
 * Correlated Sub-Query requires special lookups for every record in the primary table. */
class CorrelatedSubQuery {
    /**
     * 
     * @param {Map<String, Table>} tableInfo - Map of table info.
     * @param {TableFields} tableFields - Fields from all tables.
     * @param {BindData}  bindData - List of bind data.
     * @param {Object} defaultSubQuery - Select AST
     */
    constructor(tableInfo, tableFields, bindData, defaultSubQuery = null) {
        /** @property {Map<String, Table>} - Map of table info. */
        this.tableInfo = tableInfo;
        /** @property {TableFields} - Fields from all tables.*/
        this.tableFields = tableFields;
        /** @property {BindData} */
        this.bindVariables = bindData;
        /** @property {Object} - AST can be set here and skipped in select() statement. */
        this.defaultSubQuery = defaultSubQuery;
    }

    /**
     * Perform SELECT on sub-query using data from current record in outer table.
     * @param {Number} masterRecordID - Current record number in outer table.
     * @param {CalculatedField} calcSqlField - Calculated field object.
     * @param {Object} ast - Sub-query AST.
     * @returns {any[][]} - double array of selected table data.
     */
    select(masterRecordID, calcSqlField, ast = this.defaultSubQuery) {
        const innerTableInfo = this.tableInfo.get(ast.FROM.table.toUpperCase());
        if (typeof innerTableInfo === 'undefined')
            throw new Error(`No table data found: ${ast.FROM.table}`);

        //  Add BIND variable for all matching fields in WHERE.
        const tempAst = JSON.parse(JSON.stringify(ast));
        const tempBindVariables = new BindData();
        tempBindVariables.addList(this.bindVariables.getBindDataList());

        this.replaceOuterFieldValueInCorrelatedWhere(calcSqlField, masterRecordID, tempAst, tempBindVariables);

        const inData = new Sql()
            .setTables(this.tableInfo)
            .setBindValues(tempBindVariables)
            .execute(tempAst);

        return inData;
    }

    /**
     * If we find the field name in the AST, just replace with '?' and add to bind data variable list.
     * @param {CalculatedField} calcSqlField - List of fields in outer query.  If any are found in subquery, the value of that field for the current record is inserted into subquery before it is executed.
     * @param {Number} masterRecordID - current record number in outer query.
     * @param {Object} tempAst - AST for subquery.  Any field names found from outer query will be replaced with bind place holder '?'.
     * @param {BindData} bindData
     */
    replaceOuterFieldValueInCorrelatedWhere(calcSqlField, masterRecordID, tempAst, bindData) {
        const where = tempAst.WHERE;

        if (typeof where === 'undefined')
            return;

        if (typeof where.logic === 'undefined')
            this.traverseWhere(calcSqlField, [where], masterRecordID, bindData);
        else
            this.traverseWhere(calcSqlField, where.terms, masterRecordID, bindData);
    }

    /**
     * Search the WHERE portion of the subquery to find all references to the table in the outer query.
     * @param {CalculatedField} calcSqlField - List of fields in outer query.
     * @param {Object} terms - terms of WHERE.  It is modified with bind variable placeholders when outer table fields are located.
     * @param {Number} masterRecordID
     * @param {BindData} bindData
     */
    traverseWhere(calcSqlField, terms, masterRecordID, bindData) {
        for (const cond of terms) {
            if (typeof cond.logic === 'undefined') {
                let result = calcSqlField.masterFields.find(item => item.fieldName === cond.left.toUpperCase());
                if (typeof result !== 'undefined') {
                    cond.left = bindData.add(calcSqlField.getData(cond.left.toUpperCase(), masterRecordID));
                }
                result = calcSqlField.masterFields.find(item => item.fieldName === cond.right.toUpperCase());
                if (typeof result !== 'undefined') {
                    cond.right = bindData.add(calcSqlField.getData(cond.right.toUpperCase(), masterRecordID));
                }
            }
            else {
                this.traverseWhere(calcSqlField, [cond.terms], masterRecordID, bindData);
            }
        }
    }
}

/** 
 * @classdesc
 * Tracks all fields in a table (including derived tables when there is a JOIN). 
 */
class VirtualFields {
    constructor() {
        /** @property {Map<String, VirtualField>} - Map to field for fast access. Field name is key. */
        this.virtualFieldMap = new Map();
        /** @property {VirtualField[]} - List of all fields for table. */
        this.virtualFieldList = [];
    }

    /**
     * Adds info for one field into master list of fields for table.
     * @param {VirtualField} field - Information for one field in the table.
     * @param {Boolean} checkForDuplicates - throws error if adding a duplicate field name.
     */
    add(field, checkForDuplicates = false) {
        if (checkForDuplicates && this.virtualFieldMap.has(field.fieldName)) {
            throw new Error(`Duplicate field name: ${field.fieldName}`);
        }
        this.virtualFieldMap.set(field.fieldName, field);
        this.virtualFieldList.push(field);
    }

    /**
     * Returns a list of all fields in table.
     * @returns {VirtualField[]}
     */
    getAllVirtualFields() {
        return this.virtualFieldList;
    }

    /**
     * When the wildcard '*' is found in the SELECT, it will add all fields in table to the AST used in the SELECT.
     * @param {Table} masterTableInfo - The wildcard '*' (if found) will add fields from THIS table to the AST.
     * @param {any[]} astFields - existing SELECT fields list.
     * @returns {any[]} - original AST field list PLUS expanded list of fields if '*' was encountered.
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

/** 
 * @classdesc 
 * Defines all possible table fields including '*' and long/short form (i.e. table.column). 
 */
class VirtualField {                        //  skipcq: JS-0128
    /**
     * @param {String} fieldName - field name
     */
    constructor(fieldName) {
        /** @property {String} - field name */
        this._fieldName = fieldName;
    }

    get fieldName() {
        return this._fieldName;
    }
}

/**  
 * @classdesc
 * The JOIN creates a new logical table. 
 */
class DerivedTable {                     //  skipcq: JS-0128
    constructor() {
        /** @property {Table} */
        this.tableInfo = null;
        /** @property  {TableField} */
        this.leftField = null;
        /** @property  {TableField} */
        this.rightField = null;
        /** @property  {Number[][]} */
        this.leftRecords = null;
        /** @property  {Boolean} */
        this.isOuterJoin = null;
    }

    /**
     * Left side of join condition.
     * @param {TableField} leftField 
     * @returns {DerivedTable}
     */
    setLeftField(leftField) {
        this.leftField = leftField;
        return this;
    }

    /**
     * Right side of join condition
     * @param {TableField} rightField 
     * @returns {DerivedTable}
     */
    setRightField(rightField) {
        this.rightField = rightField;
        return this;
    }

    /**
     * 
     * @param {Number[][]} leftRecords - first index is record ID of left table, second index is a list of the matching record ID's in right table.
     * @returns {DerivedTable} 
     */
    setLeftRecords(leftRecords) {
        this.leftRecords = leftRecords;
        return this;
    }

    /**
     * Indicate if outer or inner join.
     * @param {Boolean} isOuterJoin - true for outer, false for inner
     * @returns {DerivedTable}
     */
    setIsOuterJoin(isOuterJoin) {
        this.isOuterJoin = isOuterJoin;
        return this;
    }

    /**
     * Create derived table from the two tables that are joined.
     * @returns {DerivedTable}
     */
    createTable() {
        const columnCount = this.rightField.tableInfo.getColumnCount();
        const emptyRightRow = Array(columnCount).fill(null);

        const joinedData = [DerivedTable.getCombinedColumnTitles(this.leftField, this.rightField)];

        for (let i = 1; i < this.leftField.tableInfo.tableData.length; i++) {
            if (typeof this.leftRecords[i] !== "undefined") {
                if (typeof this.rightField.tableInfo.tableData[this.leftRecords[i][0]] === "undefined")
                    joinedData.push(this.leftField.tableInfo.tableData[i].concat(emptyRightRow));
                else {
                    const maxJoin = this.leftRecords[i].length;
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
    * Is this a derived table - one that has been joined.
    * @returns {Boolean}
    */
    isDerivedTable() {
        return this.tableInfo !== null;
    }

    /**
     * Get derived table info.
     * @returns {Table}
     */
    getTableData() {
        return this.tableInfo;
    }

    /**
     * Create title row from LEFT and RIGHT table.
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

/** 
 * @classdesc
 * Convert SQL CALCULATED fields into javascript code that can be evaulated and converted to data. 
 */
class SqlServerFunctions {
    /**
     * Convert SQL formula to javascript code.
     * @param {String} calculatedFormula - contains SQL formula and parameter(s)
     * @param {TableField[]} masterFields - table fields
     * @returns {String} - javascript code
     */
    convertToJs(calculatedFormula, masterFields) {
        const sqlFunctions = ["ABS", "ADDDATE", "CASE", "CEILING", "CHARINDEX", "COALESCE", "CONCAT", "CONCAT_WS", "CONVERT", "CURDATE",
            "DAY", "DATEDIFF", "FLOOR", "IF", "LEFT", "LEN", "LENGTH", "LOG", "LOG10", "LOWER",
            "LTRIM", "MONTH", "NOW", "POWER", "RAND", "REPLICATE", "REVERSE", "RIGHT", "ROUND", "RTRIM",
            "SPACE", "STUFF", "SUBSTR", "SUBSTRING", "SQRT", "TRIM", "UPPER", "YEAR"];
        /** @property {String} - regex to find components of CASE statement. */
        this.matchCaseWhenThenStr = /WHEN(.*?)THEN(.*?)(?=WHEN|ELSE|$)|ELSE(.*?)(?=$)/;
        /** @property {String} - Original CASE statement. */
        this.originalCaseStatement = "";
        /** @property {String} - Existing state of function string when CASE encountered. */
        this.originalFunctionString = "";
        /** @property {Boolean} - when working on each WHEN/THEN in CASE, is this the first one encountered. */
        this.firstCase = true;
        /** @property {String[]} */
        this.referencedTableColumns = [];

        let functionString = SelectTables.toUpperCaseExceptQuoted(calculatedFormula);

        for (const func of sqlFunctions) {
            let args = SelectTables.parseForFunctions(functionString, func);

            [args, functionString] = this.caseStart(func, args, functionString);

            while (args !== null && args.length > 0) {
                // Split on COMMA, except within brackets.
                const parms = typeof args[1] === 'undefined' ? [] : SelectTables.parseForParams(args[1]);

                let replacement = "";
                try {
                    replacement = this[func.toLocaleLowerCase()](parms, args, masterFields);
                }
                catch (ex) {
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
     * @returns {String[]}
     */
    getReferencedColumns() {
        return this.referencedTableColumns;
    }

    //  START SQL SUPPORTED FUNCTIONS
    //  Supported SQL functions entered here!!.  If a new function is to be added, add a new function below
    //  which returns a STRING that can be executed as a Javascript statement.
    abs(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `Math.abs(${parms[0]})`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    adddate(parms) {                            //  skipcq: JS-0105
        return SqlServerFunctions.adddate(parms);
    }

    /**
     * @param {String[]} _parms 
     * @param {String[]} args 
     * @returns {String}
     */
    case(_parms, args) {
        return this.caseWhen(args);
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    ceiling(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `Math.ceil(${parms[0]})`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    charindex(parms) {                          //  skipcq: JS-0105
        return SqlServerFunctions.charIndex(parms);
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    coalesce(parms) {                           //  skipcq: JS-0105
        return SqlServerFunctions.coalesce(parms);
    }

    /**
     * @param {String[]} parms 
     * @param {String[]} _args 
     * @param {TableField[]} masterFields 
     * @returns {String}
     */
    concat(parms, _args, masterFields) {         //  skipcq: JS-0105
        return SqlServerFunctions.concat(parms, masterFields);
    }

    /**
     * @param {String[]} parms 
     * @param {String[]} _args 
     * @param {TableField[]} masterFields 
     * @returns {String}
     */
    concat_ws(parms, _args, masterFields) {      //  skipcq: JS-0105
        return SqlServerFunctions.concat_ws(parms, masterFields);
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    convert(parms) {                            //  skipcq: JS-0105
        return SqlServerFunctions.convert(parms);
    }

    /**
     * @returns {String}
     */
    curdate() {                                 //  skipcq: JS-0105
        return "new Date().toLocaleString().split(',')[0]";
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    datediff(parms) {                            //  skipcq: JS-0105
        return SqlServerFunctions.datediff(parms);
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    day(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `new Date(${parms[0]}).getDate()`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    floor(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `Math.floor(${parms[0]})`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    if(parms) {                                       //  skipcq: JS-0105
        const ifCond = SqlParse.sqlCondition2JsCondition(parms[0]);
        return `${ifCond} ? ${parms[1]} : ${parms[2]};`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    left(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.substring(0,${parms[1]})`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    len(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.length`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    length(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.length`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    log(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `Math.log2(${parms[0]})`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    log10(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `Math.log10(${parms[0]})`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    lower(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.toLowerCase()`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    ltrim(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.trimStart()`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    month(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `new Date(${parms[0]}).getMonth() + 1`;
    }

    /**
     * @returns {String}
     */
    now() {                                     //  skipcq: JS-0105
        return "new Date().toLocaleString()";
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    power(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `Math.pow(${parms[0]},${parms[1]})`;
    }

    /**
     * @returns {String}
     */
    rand() {                                    //  skipcq: JS-0105
        return "Math.random()";
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    replicate(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.toString().repeat(${parms[1]})`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    reverse(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.toString().split("").reverse().join("")`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    right(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.toString().slice(${parms[0]}.length - ${parms[1]})`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    round(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `Math.round(${parms[0]})`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    rtrim(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.toString().trimEnd()`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    space(parms) {                                  //  skipcq: JS-0105
        return `' '.repeat(${parms[0]})`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    stuff(parms) {                                  //  skipcq: JS-0105
        return `${parms[0]}.toString().substring(0,${parms[1]}-1) + ${parms[3]} + ${parms[0]}.toString().substring(${parms[1]} + ${parms[2]} - 1)`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    substr(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.toString().substring(${parms[1]} - 1, ${parms[1]} + ${parms[2]} - 1)`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    substring(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.toString().substring(${parms[1]} - 1, ${parms[1]} + ${parms[2]} - 1)`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    sqrt(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `Math.sqrt(${parms[0]})`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    trim(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.toString().trim()`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    upper(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `${parms[0]}.toString().toUpperCase()`;
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    year(parms) {
        this.referencedTableColumns.push(parms[0]);
        return `new Date(${parms[0]}).getFullYear()`;
    }
    //  END SQL SUPPORTED FUNCTIONS

    /**
     * Search for SELECT function arguments for specified 'func' only.  Special case for 'CASE'.  It breaks down one WHEN condition at a time.
     * @param {String} func - an SQL function name.
     * @param {String} functionString - SELECT SQL string to search
     * @returns {String[]}
     */
    parseFunctionArgs(func, functionString) {
        let args = [];

        if (func === "CASE")
            args = this.matchCaseWhenThenStr.exec(functionString);
        else
            args = SelectTables.parseForFunctions(functionString, func);

        return args;
    }

    /**
     * Find the position of a substring within a field - in javascript code.
     * @param {any[]} parms - 
     * * parms[0] - string to search for
     * * parms[1] - field name
     * * parms[2] - start to search from this position (starts at 1)
     * @returns {String} - javascript code to find substring position.
     */
    static charIndex(parms) {
        let replacement = "";

        if (typeof parms[2] === 'undefined')
            replacement = `${parms[1]}.toString().indexOf(${parms[0]}) + 1`;
        else
            replacement = `${parms[1]}.toString().indexOf(${parms[0]},${parms[2]} -1) + 1`;

        return replacement;
    }

    /**
     * Returns first non-empty value in a list, in javascript code.
     * @param {any[]} parms - coalesce parameters - no set limit for number of inputs.
     * @returns {String} - javascript to solve
     */
    static coalesce(parms) {
        let replacement = "";
        for (const parm of parms) {
            replacement += `${parm} !== '' ? ${parm} : `;
        }

        replacement += "''";

        return replacement;
    }

    /**
     * 
     * @param {any[]} parms 
     * @param {TableField[]} masterFields 
     * @returns {String}
     */
    static concat(parms, masterFields) {
        parms.unshift("''");
        return SqlServerFunctions.concat_ws(parms, masterFields);
    }

    /**
     * Concatenate all data and use separator between concatenated fields.
     * @param {any[]} parms - 
     * * parm[0] - separator string
     * * parms... - data to concatenate.
     * @param {TableField[]} masterFields - fields in table.
     * @returns {String} - javascript to concatenate all data.
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
     * Convert data to another type.
     * @param {any[]} parms - 
     * * parm[0] - value to convert
     * * parms[1] -  data type.
     * @returns {String} - javascript to convert data to specified type.
     */
    static convert(parms) {
        let replacement = "";

        const dataType = parms[1].toUpperCase().trim();
        switch (dataType) {
            case "SIGNED":
                replacement = `isNaN(parseInt(${parms[0]}, 10))?0:parseInt(${parms[0]}, 10)`;
                break;
            case "DECIMAL":
                replacement = `isNaN(parseFloat(${parms[0]}))?0:parseFloat(${parms[0]})`;
                break;
            case "CHAR":
                replacement = `${parms[0]}.toString()`;
                break;
            default:
                throw new Error(`Unrecognized data type ${dataType} in CONVERT`);
        }

        return replacement;
    }

    /**
     * Add number of days to a date and return JS code to return this date.
     * @param {any[]} parms 
     * parms[0] - A date.
     * parms[1] - Number of days to add to the date.
     * @returns {String}
     */
    static adddate(parms) {
        if (parms.length < 2) {
            throw new Error("ADDDATE expecting at least two parameters");
        }

        const parm1 = `(new Date(${parms[0]})).getTime()`;
        const parm2 = `(${parms[1]} * (1000 * 3600 * 24))`;
        const totalMs = `(${parm1} + ${parm2})`;

        return `new Date(${totalMs})`;
    }

    /**
     * DATEDIFF(date1, date2) = date1 - date2 (as days)
     * @param {any[]} parms 
     * @returns {String}
     */
    static datediff(parms) {
        if (parms.length !== 2) {
            throw new Error("DATEDIFF expecting two parameters");
        }

        let parm1 = `(new Date(${parms[0]}).getTime())/(1000 * 3600 * 24)`;
        let parm2 = `(new Date(${parms[1]}).getTime())/(1000 * 3600 * 24)`;

        parm1 = `Math.floor(${parm1})`;
        parm2 = `Math.floor(${parm2})`;

        return `${parm1} - ${parm2}`;
    }

    /**
     * When examining the SQL Select CASE, parse for next WHEN,END condition.
     * @param {String} func - current function worked on.  If <> 'CASE', ignore.
     * @param {any[]} args - default return value. 
     * @param {String} functionString 
     * @returns {any[]}
     */
    caseStart(func, args, functionString) {
        let caseArguments = args;
        let caseString = functionString;

        if (func === "CASE") {
            caseArguments = /CASE(.*?)END/i.exec(functionString);

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
     * Convert SQL CASE to javascript executeable code to solve case options.
     * @param {any[]} args - current CASE WHEN strings.
     * * args[0] - entire WHEN ... THEN ...
     * * args[1] - parsed string after WHEN, before THEN
     * * args[2] - parse string after THEN
     * @returns {String} - js code to handle this WHEN case.
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
     * Finish up the javascript code to handle the select CASE.
     * @param {String} func - current function being processed.  If <> 'CASE', ignore.
     * @param {String} funcString - current SQL/javascript string in the process of being converted to js.
     * @returns {String} - updated js code
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

/** 
 * @classdesc
 * Used to create a single row from multiple rows for GROUP BY expressions. 
 */
class ConglomerateRecord {
    /**
     * @param {TableField[]} virtualFields 
     */
    constructor(virtualFields) {
        /** @property {TableField[]} */
        this.selectVirtualFields = virtualFields;
    }

    /**
     * Compress group records to a single row by applying appropriate aggregate functions.
     * @param {any[][]} groupRecords - a group of table data records to compress.
     * @returns {any[]} - compressed record.
     * * If column is not an aggregate function, value from first row of group records is selected. (should all be the same)
     * * If column has aggregate function, that function is applied to all rows from group records.
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
     * Apply aggregate function to all rows on specified column and return result.
     * @param {TableField} field - field with aggregate function
     * @param {any[]} groupRecords - group of records we apply function to.
     * @param {Number} columnIndex - the column index where data is read from and function is applied on.
     * @returns {any} - value of aggregate function for all group rows.
     */
    static aggregateColumn(field, groupRecords, columnIndex) {
        let groupValue = 0;
        const aggregator = new AggregateTrack(field);

        for (const groupRow of groupRecords) {
            if (groupRow[columnIndex] === 'null')
                continue;

            const numericData = ConglomerateRecord.aggregateColumnToNumeric(groupRow[columnIndex]);

            switch (field.aggregateFunction) {
                case "SUM":
                    groupValue = aggregator.sum(numericData);
                    break;
                case "COUNT":
                    groupValue = aggregator.count(groupRow[columnIndex]);
                    break;
                case "MIN":
                    groupValue = aggregator.minCase(numericData);
                    break;
                case "MAX":
                    groupValue = aggregator.maxCase(numericData);
                    break;
                case "AVG":
                    aggregator.sum(numericData);
                    break;
                case "GROUP_CONCAT":
                    aggregator.addGroupConcatItem(groupRow[columnIndex]);
                    break;
                default:
                    throw new Error(`Invalid aggregate function: ${field.aggregateFunction}`);
            }
        }

        if (field.aggregateFunction === "AVG") {
            groupValue = aggregator.getAverage();
        }

        if (field.aggregateFunction === "GROUP_CONCAT") {
            return aggregator.getGroupConcat();
        }

        return groupValue;
    }

    /**
     * 
     * @param {any} columnData 
     * @returns {Number}
     */
    static aggregateColumnToNumeric(columnData) {
        /** @type {any} */
        let numericData = 0;
        if (columnData instanceof Date) {
            numericData = columnData;
        }
        else {
            numericData = Number(columnData);
            numericData = (isNaN(numericData)) ? 0 : numericData;
        }

        return numericData;
    }
}

/**
 * @classdesc Accumulator methods for the various aggregate functions.
 */
class AggregateTrack {
    constructor(field) {
        this.groupValue = 0;
        this.groupConcat = [];
        this.isDistinct = field.distinctSetting === "DISTINCT";
        this.distinctSet = new Set();
        this.first = true;
        this.avgCounter = 0;
    }

    /**
     * 
     * @param {Number} numericData 
     * @returns {Number}
     */
    minCase(numericData) {
        this.groupValue = this.first ? numericData : this.groupValue;
        this.first = false;
        this.groupValue = numericData < this.groupValue ? numericData : this.groupValue;
        return this.groupValue;
    }

    /**
     * 
     * @param {Number} numericData 
     * @returns {Number}
     */
     maxCase(numericData) {
        this.groupValue = this.first ? numericData : this.groupValue;
        this.first = false;
        this.groupValue = numericData > this.groupValue ? numericData : this.groupValue;
        return this.groupValue;
    }

    /**
     * 
     * @param {Number} numericData 
     * @returns {Number}
     */
    sum(numericData) {
        this.avgCounter++;
        this.groupValue += numericData;

        return this.groupValue;
    }

    /**
     * 
     * @returns {Number}
     */
    getAverage() {
        return this.groupValue / this.avgCounter;
    }

    /**
     * 
     * @param {any} columnData 
     * @returns {Number}
     */
    count(columnData) {
        this.groupValue++;
        if (this.isDistinct) {
            this.distinctSet.add(columnData);
            this.groupValue = this.distinctSet.size;
        }

        return this.groupValue;
    }

    /**
     * 
     * @param {any} columnData 
     * @returns {void}
     */
    addGroupConcatItem(columnData) {
        if (this.isDistinct) {
            this.distinctSet.add(columnData);
        }
        else {
            this.groupConcat.push(columnData);
        }
    }

    /**
     * All data from column returned as single string with items separated by comma.
     * @returns {String}
     */
    getGroupConcat() {
        if (this.isDistinct) {
            this.groupConcat = Array.from(this.distinctSet.keys());
        }
        this.groupConcat.sort((a, b) => {
            if (a > b) {
                return 1;
            }
            if (b > a) {
                return -1;
            }
            return 0;
        });

        return this.groupConcat.join();
    }
}

/** 
 * @classdesc
 * Fields from all tables. 
 * */
class TableFields {
    constructor() {
        /** @property {TableField[]} */
        this.allFields = [];
        /** @property {Map<String, TableField>} */
        this.fieldNameMap = new Map();
        /** @property {Map<String, TableField>} */
        this.tableColumnMap = new Map();
    }

    /**
     * Iterate through all table fields and create a list of these VirtualFields.
     * @param {String} primaryTable - primary FROM table name in select.
     * @param {Map<String,Table>} tableInfo - map of all loaded tables. 
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

        this.allFields.sort(TableFields.sortPrimaryFields);
    }

    /**
     * Sort function for table fields list.
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
     * Set up mapping to quickly find field info - by all (alias) names, by table+column.
     * @param {TableField} field - field info.
     * @param {Boolean} isPrimaryTable - is this a field from the SELECT FROM TABLE.
     */
    indexTableField(field, isPrimaryTable = false) {
        for (const aliasField of field.aliasNames) {
            const fieldInfo = this.fieldNameMap.get(aliasField);

            if (typeof fieldInfo === 'undefined' || isPrimaryTable) {
                this.fieldNameMap.set(aliasField, field);
            }
        }

        //  This is something referenced in GROUP BY but is NOT in the SELECTED fields list.
        if (field.tempField && !this.fieldNameMap.has(field.columnName.toUpperCase())) {
            this.fieldNameMap.set(field.columnName.toUpperCase(), field);
        }

        if (field.originalTableColumn !== -1) {
            const key = `${field.originalTable}:${field.originalTableColumn}`;
            if (!this.tableColumnMap.has(key))
                this.tableColumnMap.set(key, field);
        }
    }

    /**
     * Quickly find field info for TABLE + COLUMN NUMBER (key of map)
     * @param {String} tableName - Table name to search for.
     * @param {Number} tableColumn - Column number to search for.
     * @returns {TableField} -located table info (null if not found).
     */
    findTableField(tableName, tableColumn) {
        const key = `${tableName}:${tableColumn}`;
        return !this.tableColumnMap.has(key) ? null : this.tableColumnMap.get(key);
    }

    /**
     * Is this field in our map.
     * @param {String} field - field name
     * @returns {Boolean} - found in map if true.
     */
    hasField(field) {
        return this.fieldNameMap.has(field.toUpperCase());
    }

    /**
     * Get field info.
     * @param {String} field - table column name to find 
     * @returns {TableField} - table info (undefined if not found)
     */
    getFieldInfo(field) {
        return this.fieldNameMap.get(field.toUpperCase());
    }

    /**
     * Get table associated with field name.
     * @param {String} field - field name to search for
     * @returns {Table} - associated table info (undefined if not found)
     */
    getTableInfo(field) {
        const fldInfo = this.getFieldInfo(field);
        return typeof fldInfo !== 'undefined' ? fldInfo.tableInfo : fldInfo;
    }

    /**
     * Get column number for field.
     * @param {String} field - field name
     * @returns {Number} - column number in table for field (-1 if not found)
     */
    getFieldColumn(field) {
        const fld = this.getFieldInfo(field);
        return fld !== null ? fld.tableColumn : -1;
    }

    /**
     * Get field column number.
     * @param {String} field - field name
     * @returns {Number} - column number.
     */
    getSelectFieldColumn(field) {
        const fld = this.getFieldInfo(field);
        if (typeof fld !== 'undefined' && fld.selectColumn !== -1) {
            return fld.selectColumn;
        }

        return -1;
    }

    /**
     * @typedef {Object} SelectFieldParameters
     * @property {Object} selField 
     * @property {Object} parsedField 
     * @property {String} columnTitle 
     * @property {Number} nextColumnPosition
     * @property {Boolean} isTempField
     */

    /**
     * Updates internal SELECTED (returned in data) field list.
     * @param {Object} astFields - AST from SELECT
     * @param {Number} nextColumnPosition
     * @param {Boolean} isTempField
     */
    updateSelectFieldList(astFields, nextColumnPosition, isTempField) {
        for (const selField of astFields) {
            const parsedField = this.parseAstSelectField(selField);
            const columnTitle = (typeof selField.as !== 'undefined' && selField.as !== "" ? selField.as : selField.name);

            /** @type {SelectFieldParameters} */
            const selectedFieldParms = {
                selField, parsedField, columnTitle, nextColumnPosition, isTempField
            };

            if (parsedField.calculatedField === null && this.hasField(parsedField.columnName)) {
                this.updateColumnAsSelected(selectedFieldParms);
                nextColumnPosition = selectedFieldParms.nextColumnPosition;
            }
            else if (parsedField.calculatedField !== null) {
                this.updateCalculatedAsSelected(selectedFieldParms);
                nextColumnPosition++;
            }
            else {
                this.updateConstantAsSelected(selectedFieldParms);
                nextColumnPosition++;
            }
        }
    }

    /**
     * 
     * @param {SelectFieldParameters} selectedFieldParms 
     * @returns {void}
     */
    updateColumnAsSelected(selectedFieldParms) {
        let fieldInfo = this.getFieldInfo(selectedFieldParms.parsedField.columnName);

        //  If GROUP BY field is in our SELECT field list - we can ignore.
        if (selectedFieldParms.isTempField && fieldInfo.selectColumn !== -1)
            return;

        if (selectedFieldParms.parsedField.aggregateFunctionName !== "" || fieldInfo.selectColumn !== -1) {
            //  A new SELECT field, not from existing.
            const newFieldInfo = new TableField();
            Object.assign(newFieldInfo, fieldInfo);
            fieldInfo = newFieldInfo;

            this.allFields.push(fieldInfo);
        }

        fieldInfo
            .setAggregateFunction(selectedFieldParms.parsedField.aggregateFunctionName)
            .setColumnTitle(selectedFieldParms.columnTitle)
            .setColumnName(selectedFieldParms.selField.name)
            .setDistinctSetting(selectedFieldParms.parsedField.fieldDistinct)
            .setSelectColumn(selectedFieldParms.nextColumnPosition)
            .setIsTempField(selectedFieldParms.isTempField);

        selectedFieldParms.nextColumnPosition++;

        this.indexTableField(fieldInfo);
    }

    /**
     * 
     * @param {SelectFieldParameters} selectedFieldParms 
     */
    updateCalculatedAsSelected(selectedFieldParms) {
        const fieldInfo = new TableField();
        this.allFields.push(fieldInfo);

        fieldInfo
            .setColumnTitle(selectedFieldParms.columnTitle)
            .setColumnName(selectedFieldParms.selField.name)
            .setSelectColumn(selectedFieldParms.nextColumnPosition)
            .setCalculatedFormula(selectedFieldParms.selField.name)
            .setSubQueryAst(selectedFieldParms.selField.subQuery)
            .setIsTempField(selectedFieldParms.isTempField);

        this.indexTableField(fieldInfo);
    }

    /**
     * 
     * @param {SelectFieldParameters} selectedFieldParms 
     */
    updateConstantAsSelected(selectedFieldParms) {
        const fieldInfo = new TableField();
        this.allFields.push(fieldInfo);

        fieldInfo
            .setCalculatedFormula(selectedFieldParms.parsedField.columnName)
            .setAggregateFunction(selectedFieldParms.parsedField.aggregateFunctionName)
            .setSelectColumn(selectedFieldParms.nextColumnPosition)
            .setColumnName(selectedFieldParms.selField.name)
            .setColumnTitle(selectedFieldParms.columnTitle)
            .setIsTempField(selectedFieldParms.isTempField);

        this.indexTableField(fieldInfo);
    }

    /**
     * Find next available column number in selected field list.
     * @returns {Number} - column number
     */
    getNextSelectColumnNumber() {
        let next = -1;
        for (const fld of this.getSelectFields()) {
            next = fld.selectColumn > next ? fld.selectColumn : next;
        }

        return next === -1 ? next : ++next;
    }

    /**
     * Return a list of temporary column numbers in select field list.
     * @returns {Number[]} - sorted list of temp column numbers.
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
     * Get a sorted list (by column number) of selected fields.
     * @returns {TableField[]} - selected fields
     */
    getSelectFields() {
        const selectedFields = this.allFields.filter((a) => a.selectColumn !== -1);
        selectedFields.sort((a, b) => a.selectColumn - b.selectColumn);

        return selectedFields;
    }

    /**
     * Get SELECTED Field names sorted list of column number.
     * @returns {String[]} - Table field names
     */
    getColumnNames() {
        const columnNames = [];
        this.getSelectFields().forEach(fld => columnNames.push(fld.columnName));

        return columnNames;
    }

    /**
     * Get column titles. If alias was set, that column would be the alias, otherwise it is column name.
     * @param {String} columnTableNameReplacement
     * @returns {String[]} - column titles
     */
    getColumnTitles(columnTableNameReplacement) {
        const columnTitles = [];

        for (const fld of this.getSelectFields()) {
            if (!fld.tempField) {
                let columnOutput = fld.columnTitle;

                //  When subquery table data becomes data for the derived table name, references to
                //  original table names in column output needs to be changed to new derived table name.
                if (columnTableNameReplacement !== null) {
                    const matchingTableIndex = columnOutput.toUpperCase().indexOf(`${fld.originalTable}.`);
                    columnOutput = matchingTableIndex === 0 ? columnTableNameReplacement + columnOutput.slice(matchingTableIndex + fld.originalTable.length) : columnOutput;
                }
                columnTitles.push(columnOutput);
            }
        }

        return columnTitles;
    }

    /**
     * Derived tables will cause an update to any TableField.  It updates with a new column number and new table (derived) info.
     * @param {DerivedTable} derivedTable - derived table info.
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
     * @typedef {Object} ParsedSelectField
     * @property {String} columnName
     * @property {String} aggregateFunctionName
     * @property {Object} calculatedField
     * @property {String} fieldDistinct
     */

    /**
     * Parse SELECT field in AST (may include functions or calculations)
     * @param {Object} selField 
     * @returns {ParsedSelectField}
     */
    parseAstSelectField(selField) {
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

                // e.g.  select count(distinct field)    OR   select count(all field)
                [columnName, fieldDistinct] = TableFields.getSelectCountModifiers(columnName);
            }
        }

        return { columnName, aggregateFunctionName, calculatedField, fieldDistinct };
    }

    /**
     * Parse for any SELECT COUNT modifiers like 'DISTINCT' or 'ALL'.
     * @param {String} originalColumnName - column (e.g. 'distinct customer_id')
     * @returns {String[]} - [0] - parsed column name, [1] - count modifier
     */
    static getSelectCountModifiers(originalColumnName) {
        let fieldDistinct = "";
        let columnName = originalColumnName;

        //  e.g.  count(distinct field)
        const distinctParts = columnName.split(" ");
        if (distinctParts.length > 1) {
            const distinctModifiers = ["DISTINCT", "ALL"];
            if (distinctModifiers.includes(distinctParts[0].toUpperCase())) {
                fieldDistinct = distinctParts[0].toUpperCase();
                columnName = distinctParts[1];
            }
        }

        //  Edge case for group_concat(distinct(field))
        if (fieldDistinct === '') {
            const matches = SelectTables.parseForFunctions(columnName.toUpperCase(), "DISTINCT");

            if (matches !== null && matches.length > 1) {
                columnName = matches[1];
                fieldDistinct = "DISTINCT";
            }
        }


        return [columnName, fieldDistinct];
    }

    /**
     * Counts the number of conglomerate field functions in SELECT field list.
     * @returns {Number} - Number of conglomerate functions.
     */
    getConglomerateFieldCount() {
        return this.getSelectFields().filter(field => field.aggregateFunction !== "").length;
    }
}

/** 
 * @classdesc
 * Table column information. 
 */
class TableField {
    constructor() {
        /** @property {String} */
        this.originalTable = "";
        /** @property {Number} */
        this.originalTableColumn = -1;
        /** @property {String[]} */
        this.aliasNames = [];
        /** @property {String} */
        this.fieldName = "";
        /** @property {Number} */
        this.derivedTableColumn = -1;
        /** @property {Number} */
        this.selectColumn = -1;
        /** @property {Boolean} */
        this.tempField = false;
        /** @property {String} */
        this.calculatedFormula = "";
        /** @property {String} */
        this.aggregateFunction = "";
        /** @property {String} */
        this.columnTitle = "";
        /** @property {String} */
        this.columnName = "";
        /** @property {String} */
        this.distinctSetting = "";
        /** @property {Object} */
        this.subQueryAst = null;
        /** @property {Boolean} */
        this._isPrimaryTable = false;
        /** @property {Table} */
        this.tableInfo = null;
    }

    /**
     * Get field column number.
     * @returns {Number} - column number
     */
    get tableColumn() {
        return this.derivedTableColumn === -1 ? this.originalTableColumn : this.derivedTableColumn;
    }

    /**
     * Original table name before any derived table updates.
     * @param {String} table - original table name
     * @returns {TableField}
     */
    setOriginalTable(table) {
        this.originalTable = table.trim().toUpperCase();
        return this;
    }

    /**
     * Column name found in column title row.
     * @param {Number} column 
     * @returns {TableField}
     */
    setOriginalTableColumn(column) {
        this.originalTableColumn = column;
        return this;
    }

    /**
     * Alias name assigned to field in select statement.
     * @param {String} columnAlias - alias name
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
     * Set column number in table data for field.
     * @param {Number} column - column number.
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
     * Aggregate function number used (e.g. 'SUM')
     * @param {String} value - aggregate function name or ''
     * @returns {TableField}
     */
    setAggregateFunction(value) {
        this.aggregateFunction = value.toUpperCase();
        return this;
    }

    /**
     * Calculated formula for field (e.g. 'CASE WHEN QUANTITY >= 100 THEN 1 ELSE 0 END')
     * @param {String} value 
     * @returns {TableField}
     */
    setCalculatedFormula(value) {
        this.calculatedFormula = value;
        return this;
    }

    /**
     * The AST from just the subquery in the SELECT.
     * @param {Object} ast - subquery ast.
     * @returns {TableField}
     */
    setSubQueryAst(ast) {
        this.subQueryAst = ast;
        return this;
    }

    /**
     * Set column TITLE.  If an alias is available, that is used - otherwise it is column name.
     * @param {String} columnTitle - column title used in output
     * @returns {TableField}
     */
    setColumnTitle(columnTitle) {
        this.columnTitle = columnTitle;
        return this;
    }

    /**
     * Set the columnname.
     * @param {String} columnName 
     * @returns {TableField}
     */
    setColumnName(columnName) {
        this.columnName = columnName;
        return this;
    }

    /**
     * Set any count modified like 'DISTINCT' or 'ALL'.
     * @param {String} distinctSetting 
     * @returns {TableField}
     */
    setDistinctSetting(distinctSetting) {
        this.distinctSetting = distinctSetting;
        return this
    }

    /**
     * Set if this field belongs to primary table (i.e. select * from table), rather than a joined tabled.
     * @param {Boolean} isPrimary - true if from primary table.
     * @returns {TableField}
     */
    setIsPrimaryTable(isPrimary) {
        this._isPrimaryTable = isPrimary;
        return this;
    }

    /**
     * Is this field in the primary table.
     * @returns {Boolean}
     */
    get isPrimaryTable() {
        return this._isPrimaryTable;
    }

    /**
     * Link this field to the table info.
     * @param {Table} tableInfo 
     * @returns {TableField}
     */
    setTableInfo(tableInfo) {
        this.tableInfo = tableInfo;
        return this;
    }

    /**
     * Retrieve field data for tableRow
     * @param {Number} tableRow - row to read data from
     * @returns {any} - data
     */
    getData(tableRow) {
        const columnNumber = this.derivedTableColumn === -1 ? this.originalTableColumn : this.derivedTableColumn;

        return this.tableInfo.tableData[tableRow][columnNumber];
    }

    /**
     * Search through list of fields and return a list of those that include the table name (e.g. TABLE.COLUMN vs COLUMN)
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
