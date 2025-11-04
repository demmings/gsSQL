/*  *** DEBUG START ***
//  Remove comments for testing in NODE

import { Table } from './Table.js';
import { BindData } from './Sql.js';
import { DerivedTable, TableFields, TableField, CalculatedField, SqlServerFunctions, FieldComparisons } from './Views.js';
export { JoinTables, JoinTablesRecordIds };
//  *** DEBUG END ***/

/** 
 * @classdesc Handle the various JOIN table types. 
 */
class JoinTables {                                   //  skipcq: JS-0128
    constructor() {
        /** @property {JoinTablesRecordIds} */
        this.joinTableIDs = new JoinTablesRecordIds(this);
        /** @property {TableFields} */
        this.tableFields = null;
        /** @property {BindData} */
        this.bindVariables = null;
        /** @property {Map<String,Table>} */
        this.tableInfo = null;
    }

    /**
     * Info for all tables referenced in join.
     * @param {Map<String,Table>} tableInfo - Map of table info.
     * @returns {JoinTables}
     */
    setTableInfo(tableInfo) {
        this.tableInfo = tableInfo;
        this.joinTableIDs.setTableInfo(tableInfo);
        return this;
    }

    /**
     * Add info about all known tables and their fields.
     * @param {TableFields} tableFields 
     * @returns {JoinTables}
     */
    setTableFields(tableFields) {
        this.tableFields = tableFields;
        this.joinTableIDs.setTableFields(tableFields);
        return this;
    }

    /**
     * Add data set on command line to be used when evaulating SELECT WHERE
     * @param {BindData} bindVariables - Bind variable data. 
     * @returns {JoinTables}
     */
    setBindVariables(bindVariables) {
        this.bindVariables = bindVariables;
        this.joinTableIDs.setBindVariables(bindVariables);
        return this;
    }

    /**
     * The "FROM" table.
     * @param {Table} primaryTableInfo 
     * @returns {JoinTables}
     */
    setPrimaryTableInfo(primaryTableInfo) {
        this.primaryTableInfo = primaryTableInfo;
        this.joinTableIDs.setPrimaryTableInfo(primaryTableInfo);
        return this;
    }

    /**
     * Join the tables and create a derived table with the combined data from all.
     * @param {Object} ast - AST list of tables to join.
     */
    load(ast) {
        /** @property {DerivedTable} - result table after tables are joined */
        this.derivedTable = new DerivedTable();

        ast.JOIN.forEach(joinTable => this.joinNextTable(joinTable, ast.FROM.table.toUpperCase(), ast.FROM.as));
    }

    /**
     * Updates derived table with join to new table.
     * @param {Object} astJoin
     * @param {String} leftTableName
     * @param {String} leftAlias
     */
    joinNextTable(astJoin, leftTableName, leftAlias) {
        const recIds = this.joinCondition(astJoin, leftTableName);
        const joinFieldsInfo = this.joinTableIDs.getJoinFieldsInfo();

        this.derivedTable = JoinTables.joinTables(joinFieldsInfo, astJoin, recIds, leftAlias);

        //  Field locations have changed to the derived table, so update our
        //  virtual field list with proper settings.
        this.tableFields.updateDerivedTableVirtualFields(this.derivedTable);
    }

    /**
     * Find the record ID's from table that match specified conditions.
     * @param {Object} conditions
     * @param {String} leftTableName
     * @returns {MatchingJoinRecordIDs}
     */
    joinCondition(conditions, leftTableName) {
        let recIds = null;
        const rightTableName = conditions.table;
        const joinType = conditions.type;

        if (typeof conditions.cond.logic === 'undefined') {
            recIds = this.resolveCondition("OR", [conditions], joinType, rightTableName, leftTableName);
        }
        else {
            recIds = this.resolveCondition(conditions.cond.logic, conditions.cond.terms, joinType, rightTableName, leftTableName);
        }

        return recIds;
    }

    /**
     * Apply logic and conditions between the two tables to find the record ID's from LEFT and RIGHT tables.
     * @param {String} logic - AND, OR
     * @param {Object} astConditions
     * @param {String} joinType - inner, full, left, right
     * @param {String} rightTableName - right join table.
     * @param {String} leftTableName - left join table name
     * @returns {MatchingJoinRecordIDs}
     */
    resolveCondition(logic, astConditions, joinType, rightTableName, leftTableName) {
        let leftJoinRecordIDs = [];
        let rightJoinRecordIDs = [];
        /** @type {MatchingJoinRecordIDs} */
        let matchedIDs = null;

        this.joinTableIDs
            .setLeftTableName(leftTableName)
            .setRightTableName(rightTableName)
            .setJoinType(joinType)
            .setTableFields(this.tableFields);

        for (const cond of astConditions) {
            if (typeof cond.logic === 'undefined') {
                matchedIDs = this.joinTableIDs.getRecordIDs(cond);
            }
            else {
                matchedIDs = this.resolveCondition(cond.logic, cond.terms, joinType, rightTableName, leftTableName);
            }

            leftJoinRecordIDs.push(matchedIDs.leftJoinRecordIDs);
            rightJoinRecordIDs.push(matchedIDs.rightJoinRecordIDs);
        }

        if (logic === "AND") {
            leftJoinRecordIDs = JoinTables.andJoinIds(leftJoinRecordIDs);
            rightJoinRecordIDs = JoinTables.andJoinIds(rightJoinRecordIDs);
        }
        if (logic === "OR") {
            leftJoinRecordIDs = JoinTables.orJoinIds(leftJoinRecordIDs);
            rightJoinRecordIDs = JoinTables.orJoinIds(rightJoinRecordIDs);
        }

        return { leftJoinRecordIDs, rightJoinRecordIDs };
    }

    /**
     * AND logic applied to the record ID's
     * @param {Array} recIds
     * @returns {Array}
     */
    static andJoinIds(recIds) {
        const result = [];

        for (let i = 0; i < recIds[0].length; i++) {
            const temp = recIds.map(rec => typeof rec[i] === 'undefined' ? [] : rec[i]);
            const row = temp.reduce((accumulator, currentRecords) => accumulator.filter(c => currentRecords.includes(c)), temp[0]);

            if (row.length > 0) {
                result[i] = row;
            }
        }

        return result;
    }

    /**
     * OR logic applied to the record ID's
     * @param {Array} recIds
     * @returns {Array}
     */
    static orJoinIds(recIds) {
        const result = [];

        for (let i = 0; i < recIds[0].length; i++) {
            let temp = [];

            recIds.forEach(rec => { temp = temp.concat(rec[i]) });

            if (typeof temp[0] !== 'undefined') {
                result[i] = Array.from(new Set(temp));
            }
        }

        return result;
    }

    /**
     * Does this object contain a derived (joined) table.
     * @returns {Boolean}
     */
    isDerivedTable() {
        if (typeof this.derivedTable === 'undefined') {
            return false;
        }

        return this.derivedTable.isDerivedTable();
    }

    /**
     * Get derived table after tables are joined.
     * @returns {Table}
     */
    getJoinedTableInfo() {
        return this.derivedTable.getTableData();
    }

    /**
    * Join two tables and create a derived table that contains all data from both tables.
    * @param {LeftRightJoinFields} leftRightFieldInfo - left table field of join
    * @param {Object} joinTable - AST that contains join type.
    * @param {MatchingJoinRecordIDs} recIds
    * @param {String} leftAlias
    * @returns {DerivedTable} - new derived table after join of left and right tables.
    */
    static joinTables(leftRightFieldInfo, joinTable, recIds, leftAlias) {
        let derivedTable = null;
        let rightDerivedTable = null;

        switch (joinTable.type) {
            case "left":
                derivedTable = new DerivedTable()
                    .setLeftField(leftRightFieldInfo.leftSideInfo.fieldInfo)
                    .setRightField(leftRightFieldInfo.rightSideInfo.fieldInfo)
                    .setLeftRecords(recIds.leftJoinRecordIDs)
                    .setIsOuterJoin(true)
                    .setJoinTableAlias(leftAlias, joinTable.as)
                    .createTable();
                break;

            case "inner":
                derivedTable = new DerivedTable()
                    .setLeftField(leftRightFieldInfo.leftSideInfo.fieldInfo)
                    .setRightField(leftRightFieldInfo.rightSideInfo.fieldInfo)
                    .setLeftRecords(recIds.leftJoinRecordIDs)
                    .setIsOuterJoin(false)
                    .setJoinTableAlias(leftAlias, joinTable.as)
                    .createTable();
                break;

            case "right":
                derivedTable = new DerivedTable()
                    .setLeftField(leftRightFieldInfo.rightSideInfo.fieldInfo)
                    .setRightField(leftRightFieldInfo.leftSideInfo.fieldInfo)
                    .setLeftRecords(recIds.leftJoinRecordIDs)
                    .setIsOuterJoin(true)
                    .setJoinTableAlias(leftAlias, joinTable.as)
                    .createTable();

                break;

            case "full":
                derivedTable = new DerivedTable()
                    .setLeftField(leftRightFieldInfo.leftSideInfo.fieldInfo)
                    .setRightField(leftRightFieldInfo.rightSideInfo.fieldInfo)
                    .setLeftRecords(recIds.leftJoinRecordIDs)
                    .setIsOuterJoin(true)
                    .setJoinTableAlias(joinTable.as)
                    .createTable();

                rightDerivedTable = new DerivedTable()
                    .setLeftField(leftRightFieldInfo.rightSideInfo.fieldInfo)
                    .setRightField(leftRightFieldInfo.leftSideInfo.fieldInfo)
                    .setLeftRecords(recIds.rightJoinRecordIDs)
                    .setIsOuterJoin(true)
                    .setJoinTableAlias(joinTable.as)
                    .createTable();

                derivedTable.tableInfo.concat(rightDerivedTable.tableInfo); // skipcq: JS-D008

                break;

            default:
                throw new Error(`Internal error.  No support for join type: ${joinTable.type}`);
        }
        return derivedTable;
    }
}

/**
 * @classdesc
 * Find record ID's for matching JOINed table records.
 */
class JoinTablesRecordIds {
    /**
     * @param {JoinTables} joinTables 
     */
    constructor(joinTables) {
        /** @property {JoinTables} */
        this.dataJoin = joinTables;
        /** @property {TableFields} */
        this.tableFields = null;
        /** @property {LeftRightJoinFields} */
        this.joinFields = null;
        /** @property {TableFields} */
        this.tableFields = null;
        /** @property {Map<String,Table>} */
        this.tableInfo = null;
        /** @property {BindData} */
        this.bindVariables = null;
        /** @property {Table} */
        this.primaryTableInfo = null
        /** @property {Table} */
        this.masterTable = null;
        /** @property {String} */
        this.rightTableName = "";
        /** @property {String} */
        this.leftTableName = "";
        /** @property {String} */
        this.joinType = "";
    }

    /**
     * @param {Object} conditionAst The condition to JOIN our two tables.
     * @returns {MatchingJoinRecordIDs}
     */
    getRecordIDs(conditionAst) {
        /** @type {Table} */
        this.masterTable = this.dataJoin.isDerivedTable() ? this.dataJoin.getJoinedTableInfo() : this.primaryTableInfo;
        this.calcSqlField = new CalculatedField(this.masterTable, this.primaryTableInfo, this.tableFields);
        this.joinFields = this.getLeftRightFieldInfo(conditionAst);

        return this.getMatchedRecordIds();
    }

    /**
     * @param {TableFields} tableFields 
     * @returns {JoinTablesRecordIds}
     */
    setTableFields(tableFields) {
        this.tableFields = tableFields;

        return this;
    }

    /**
     * @param {Map<String,Table>} tableInfo - Map of table info.
     * @returns {JoinTablesRecordIds}
     */
    setTableInfo(tableInfo) {
        this.tableInfo = tableInfo;

        return this;
    }

    /**
     * @param {BindData} bindVariables - Bind variable data. 
     * @returns {JoinTablesRecordIds}
     */
    setBindVariables(bindVariables) {
        this.bindVariables = bindVariables;

        return this;
    }

    /**
     * @param {String} name 
     * @returns {JoinTablesRecordIds}
     */
    setRightTableName(name) {
        this.rightTableName = name;

        return this;
    }

    /**
     * @param {String} name 
     * @returns {JoinTablesRecordIds}
     */
    setLeftTableName(name) {
        this.leftTableName = name;

        return this;
    }

    /**
     * @param {String} joinType 
     * @returns {JoinTablesRecordIds}
     */
    setJoinType(joinType) {
        this.joinType = joinType;

        return this;
    }

    /**
     * @param {Table} primaryTableInfo 
     * @returns {JoinTablesRecordIds}
    */
    setPrimaryTableInfo(primaryTableInfo) {
        this.primaryTableInfo = primaryTableInfo;

        return this;
    }

    /**
     * @returns {LeftRightJoinFields}
     */
    getJoinFieldsInfo() {
        return this.joinFields;
    }

    /**
     * @typedef {Object} LeftRightJoinFields
     * @property {JoinSideInfo} leftSideInfo
     * @property {JoinSideInfo} rightSideInfo
     * @property {String} operator
     * 
     */

    /**
     * @typedef {Object} JoinSideInfo
     * @property {TableField} fieldInfo
     * @property {String} column
     */

    /**
     * Find the LEFT table and RIGHT table joining fields from AST.
     * @param {Object} astJoin
     * @returns {LeftRightJoinFields}
     */
    getLeftRightFieldInfo(astJoin) {
        /** @type {TableField} */
        let leftFieldInfo = null;
        /** @type {TableField} */
        let rightFieldInfo = null;

        const left = typeof astJoin.cond === 'undefined' ? astJoin.left : astJoin.cond.left;
        const right = typeof astJoin.cond === 'undefined' ? astJoin.right : astJoin.cond.right;
        const operator = typeof astJoin.cond === 'undefined' ? astJoin.operator : astJoin.cond.operator;

        leftFieldInfo = this.getTableInfoFromCalculatedField(left);
        rightFieldInfo = this.getTableInfoFromCalculatedField(right);
        const isSelfJoin = leftFieldInfo.originalTable === rightFieldInfo.originalTable;

        /** @type {JoinSideInfo} */
        const leftSideInfo = {
            fieldInfo: leftFieldInfo,
            column: left
        };
        /** @type {JoinSideInfo} */
        const rightSideInfo = {
            fieldInfo: rightFieldInfo,
            column: right
        }

        //  joinTable.table is the RIGHT table, so switch if equal to condition left.
        if (typeof leftFieldInfo !== 'undefined' && this.rightTableName === leftFieldInfo.originalTable && !isSelfJoin) {
            return {
                leftSideInfo: rightSideInfo,
                rightSideInfo: leftSideInfo,
                operator
            };
        }

        return { leftSideInfo, rightSideInfo, operator };
    }

    /**
     * Look for referenced columns in expression to determine table.
     * @param {String} calcField - Expression to parse.  
     * @returns {TableField} - All SQL function parameters found.  It will include COLUMN names and constant data.
     */
    getTableInfoFromCalculatedField(calcField) {
        let foundTableField = this.tableFields.getFieldInfo(calcField);

        if (typeof foundTableField === 'undefined' && calcField !== '') {
            //  Calculated expression.
            foundTableField = this.getReferencedTableInfo(calcField);
        }

        return foundTableField;
    }

    /**
     * Find the referenced table within the calculated field.
     * @param {String} calcField 
     * @returns {TableField}
     */
    getReferencedTableInfo(calcField) {
        let foundTableField = null;
        const sqlFunc = new SqlServerFunctions();

        //  A side effect when converting an expression to Javascript is that we have a list
        //  of referenced column data (referenced in SQL functions)
        sqlFunc.convertToJs(calcField, this.tableFields.allFields);
        const columns = sqlFunc.getReferencedColumns();

        foundTableField = this.searchColumnsForTable(calcField, columns);
        if (foundTableField !== null) {
            return foundTableField;
        }

        //  No functions with parameters were used in 'calcField', so we don't know table yet.
        //  We search the calcField for valid columns - except within quotes.
        const quotedConstantsRegEx = /["'](.*?)["']/g;
        const opRegEx = /[+\-/*()]/g;
        const results = calcField.replace(quotedConstantsRegEx, "");
        let parts = results.split(opRegEx);
        parts = parts.map(a => a.trim()).filter(a => a !== '');

        foundTableField = this.searchColumnsForTable(calcField, parts);

        if (foundTableField === null) {
            throw new Error(`Failed to JOIN:  ${calcField}`);
        }

        return foundTableField;
    }

    /**
     * @param {String} calcField 
     * @param {String[]} columns 
     * @returns {Object}
     */
    searchColumnsForTable(calcField, columns) {
        const fieldInfoList = columns.map(col => this.tableFields.getFieldInfo(col));
        const validFieldInfo = fieldInfoList.filter(fld => typeof fld != 'undefined');

        if (validFieldInfo.length > 0) {
            const foundTableField = { ...validFieldInfo[0] };
            foundTableField.calculatedFormula = calcField;
            return foundTableField;
        }

        return null;
    }

    /**
     * @typedef {Object} MatchingJoinRecordIDs
     * @property {Number[][]} leftJoinRecordIDs
     * @property {Number[][]} rightJoinRecordIDs
     */

    /**
     * Apply JOIN TYPE logic on left and right tables to find the matching record ID's from both left and right tables.
     * @returns {MatchingJoinRecordIDs}
     */
    getMatchedRecordIds() {
        /** @type {Number[][]} */
        let leftJoinRecordIDs = [];
        let rightJoinRecordIDs = [];

        switch (this.joinType) {
            case "left":
                leftJoinRecordIDs = this.leftRightJoin(this.joinFields.leftSideInfo, this.joinFields.rightSideInfo, this.joinType);
                break;
            case "inner":
                leftJoinRecordIDs = this.leftRightJoin(this.joinFields.leftSideInfo, this.joinFields.rightSideInfo, this.joinType);
                break;
            case "right":
                leftJoinRecordIDs = this.leftRightJoin(this.joinFields.rightSideInfo, this.joinFields.leftSideInfo, this.joinType);
                break;
            case "full":
                leftJoinRecordIDs = this.leftRightJoin(this.joinFields.leftSideInfo, this.joinFields.rightSideInfo, this.joinType);
                rightJoinRecordIDs = this.leftRightJoin(this.joinFields.rightSideInfo, this.joinFields.leftSideInfo, "outer");
                break;
            default:
                throw new Error(`Invalid join type: ${this.joinType}`);
        }

        return { leftJoinRecordIDs, rightJoinRecordIDs };
    }

    /**
     * Returns array of each CONDITIONAL matching record ID from right table for every record in left table.
     * If the right table entry could NOT be found, -1 is set for that record index.
     * @param {JoinSideInfo} leftField - left table field
     * @param {JoinSideInfo} rightField - right table field
     * @param {String} type - either 'inner' or 'outer'.
     * @returns {Number[][]} - first index is record ID of left table, second index is a list of the matching record ID's in right table.
    */
    leftRightJoin(leftField, rightField, type) {
        const leftRecordsIDs = [];

        //  First record is the column title.
        leftRecordsIDs.push([0]);

        const conditionFunction = FieldComparisons.getComparisonFunction(this.joinFields.operator);
        const leftTableData = leftField.fieldInfo.tableInfo.tableData;
        const keyFieldMap = this.createKeyFieldRecordMap(rightField);

        for (let leftTableRecordNum = 1; leftTableRecordNum < leftTableData.length; leftTableRecordNum++) {
            const keyMasterJoinField = this.getJoinColumnData(leftField, leftTableRecordNum);
            let rightRecordIDs = [];

            if (this.joinFields.operator === '=') {
                //  "=" - special case.  
                //  Most common case AND far fewer comparisons - especially if right table is large.
                rightRecordIDs = keyFieldMap.has(keyMasterJoinField) ? keyFieldMap.get(keyMasterJoinField) : [];
            }
            else {
                // @ts-ignore
                for (const [key, data] of keyFieldMap) {
                    if (conditionFunction(keyMasterJoinField, key)) {
                        rightRecordIDs.unshift(...data);
                    }
                }
            }

            //  For the current LEFT TABLE record, record the linking RIGHT TABLE records.
            if (rightRecordIDs.length === 0) {
                if (type !== "inner") {
                    leftRecordsIDs[leftTableRecordNum] = [-1];
                }
            }
            else if (type !== "outer") {
                //  Excludes all match recordgs (is outer the right word for this?)
                leftRecordsIDs[leftTableRecordNum] = rightRecordIDs;
            }
        }

        return leftRecordsIDs;
    }

    /**
     * Find (or calculate) the field data for the specified record number.
     * @param {JoinSideInfo} fieldInfo 
     * @param {Number} recordNumber
     * @returns {String}
     */
    getJoinColumnData(fieldInfo, recordNumber) {
        let keyMasterJoinField = null;

        if (typeof fieldInfo.fieldInfo.getTableColumn === 'function') {
            const tableColumnNumber = fieldInfo.fieldInfo.getTableColumn(fieldInfo.fieldInfo.fieldName);
            keyMasterJoinField = fieldInfo.fieldInfo.tableInfo.tableData[recordNumber][tableColumnNumber];
        }
        else {
            keyMasterJoinField = this.calcSqlField.evaluateCalculatedField(fieldInfo.column, recordNumber);
        }

        return keyMasterJoinField?.toString().toUpperCase();
    }

    /**
     * Find all KEYS in table mapped to an array of record ID's where key is located in table.
     * @param {JoinSideInfo} rightField 
     * @returns {Map<String, Number[]>}
     */
    createKeyFieldRecordMap(rightField) {
        let keyFieldMap = null;

        if (typeof rightField.fieldInfo.getTableColumn === 'function') {
            keyFieldMap = rightField.fieldInfo.tableInfo.createKeyFieldRecordMap(rightField.fieldInfo.fieldName);
        }
        else {
            //  We have to evalulate the expression for every record and put into the key map (with record ID's)
            const rightSideCalculator = new CalculatedField(rightField.fieldInfo.tableInfo, rightField.fieldInfo.tableInfo, this.tableFields);
            keyFieldMap = rightField.fieldInfo.tableInfo.createCalcFieldRecordMap(rightSideCalculator, rightField.fieldInfo.calculatedFormula);
        }

        return keyFieldMap;
    }
}