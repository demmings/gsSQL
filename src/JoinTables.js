/*  *** DEBUG START ***
//  Remove comments for testing in NODE

import { Table } from './Table.js';
import { Sql, BindData } from './Sql.js';
import { SqlParse } from './SimpleParser.js';
import { DerivedTable, TableFields, TableField, CalculatedField, SqlServerFunctions } from './Views.js';
export { JoinTables, JoinTablesRecordIds };
//  *** DEBUG END ***/


/** Handle the various JOIN table types. */
class JoinTables {                                   //  skipcq: JS-0128
    constructor() {
        this.joinTableIDs = new JoinTablesRecordIds(this);
        this.tableFields = null;
        this.bindVariables = null;
        this.tableInfo = null;
    }

    /**
     * 
     * @param {Map<String,Table>} tableInfo - Map of table info.
     * @returns {JoinTables}
     */
    setTableInfo(tableInfo) {
        this.tableInfo = tableInfo;
        this.joinTableIDs.setTableInfo(tableInfo);
        return this;
    }

    /**
     * 
     * @param {TableFields} tableFields 
     * @returns {JoinTables}
     */
    setTableFields(tableFields) {
        this.tableFields = tableFields;
        this.joinTableIDs.setTableFields(tableFields);
        return this;
    }

    /**
     * 
     * @param {BindData} bindVariables - Bind variable data. 
     * @returns {JoinTables}
     */
    setBindVariables(bindVariables) {
        this.bindVariables = bindVariables;
        this.joinTableIDs.setBindVariables(bindVariables);
        return this;
    }

    /**
     * 
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

        for (const joinTable of ast.JOIN) {
            this.joinNextTable(joinTable, ast.FROM.table.toUpperCase());
        }
    }

    /**
     * Updates derived table with join to new table.
     * @param {Object} astJoin
     * @param {String} leftTableName
     */
    joinNextTable(astJoin, leftTableName) {
        const recIds = this.joinCondition(astJoin, leftTableName);

        const joinFieldsInfo = this.joinTableIDs.getJoinFieldsInfo();
        this.derivedTable = JoinTables.joinTables(joinFieldsInfo, astJoin, recIds);

        //  Field locations have changed to the derived table, so update our
        //  virtual field list with proper settings.
        this.tableFields.updateDerivedTableVirtualFields(this.derivedTable);
    }

    /**
     *
     * @param {Object} conditions
     * @param {String} leftTableName
     * @returns {Array}
     */
    joinCondition(conditions, leftTableName) {
        let recIds = [];
        const rightTableName = conditions.table;
        const joinType = conditions.type;

        if (typeof conditions.cond.logic === 'undefined')
            recIds = this.resolveCondition("OR", [conditions], joinType, rightTableName, leftTableName);

        else
            recIds = this.resolveCondition(conditions.cond.logic, conditions.cond.terms, joinType, rightTableName, leftTableName);

        return recIds;
    }

    /**
     *
     * @param {String} logic - AND, OR
     * @param {Object} astConditions
     * @param {String} joinType - inner, full, left, right
     * @param {String} rightTableName - right join table.
     * @param {String} leftTableName - left join table name
     * @returns {Array}
     */
    resolveCondition(logic, astConditions, joinType, rightTableName, leftTableName) {
        let leftIds = [];
        let rightIds = [];
        let resultsLeft = [];
        let resultsRight = [];
        this.joinTableIDs
            .setLeftTableName(leftTableName)
            .setRightTableName(rightTableName)
            .setJoinType(joinType)
            .setTableFields(this.tableFields);

        for (const cond of astConditions) {
            if (typeof cond.logic === 'undefined') {
                [leftIds, rightIds] = this.joinTableIDs.getRecordIDs(cond);
                resultsLeft.push(leftIds);
                resultsRight.push(rightIds);
            }
            else {
                [leftIds, rightIds] = this.resolveCondition(cond.logic, cond.terms, joinType, rightTableName, leftTableName);
                resultsLeft.push(leftIds);
                resultsRight.push(rightIds);
            }
        }

        if (logic === "AND") {
            resultsLeft = JoinTables.andJoinIds(resultsLeft);
            resultsRight = JoinTables.andJoinIds(resultsRight);
        }
        if (logic === "OR") {
            resultsLeft = JoinTables.orJoinIds(resultsLeft);
            resultsRight = JoinTables.orJoinIds(resultsRight);
        }

        return [resultsLeft, resultsRight];
    }

    /**
     * AND logic applied to the record ID's
     * @param {Array} recIds
     * @returns {Array}
     */
    static andJoinIds(recIds) {
        const result = [];

        for (let i = 0; i < recIds[0].length; i++) {
            const temp = [];

            for (const rec of recIds) {
                temp.push(typeof rec[i] === 'undefined' ? [] : rec[i]);
            }
            const row = temp.reduce((a, b) => a.filter(c => b.includes(c)));

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

            for (const rec of recIds) {
                temp = temp.concat(rec[i]);
            }

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
    * @param {Array} recIds
    * @returns {DerivedTable} - new derived table after join of left and right tables.
    */
    static joinTables(leftRightFieldInfo, joinTable, recIds) {
        let derivedTable = null;
        let rightDerivedTable = null;

        const [matchedRecordIDs, rightJoinRecordIDs] = recIds;

        switch (joinTable.type) {
            case "left":
                derivedTable = new DerivedTable()
                    .setLeftField(leftRightFieldInfo.leftSideInfo.fieldInfo)
                    .setRightField(leftRightFieldInfo.rightSideInfo.fieldInfo)
                    .setLeftRecords(matchedRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();
                break;

            case "inner":
                derivedTable = new DerivedTable()
                    .setLeftField(leftRightFieldInfo.leftSideInfo.fieldInfo)
                    .setRightField(leftRightFieldInfo.rightSideInfo.fieldInfo)
                    .setLeftRecords(matchedRecordIDs)
                    .setIsOuterJoin(false)
                    .createTable();
                break;

            case "right":
                derivedTable = new DerivedTable()
                    .setLeftField(leftRightFieldInfo.rightSideInfo.fieldInfo)
                    .setRightField(leftRightFieldInfo.leftSideInfo.fieldInfo)
                    .setLeftRecords(matchedRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();

                break;

            case "full":
                derivedTable = new DerivedTable()
                    .setLeftField(leftRightFieldInfo.leftSideInfo.fieldInfo)
                    .setRightField(leftRightFieldInfo.rightSideInfo.fieldInfo)
                    .setLeftRecords(matchedRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();

                rightDerivedTable = new DerivedTable()
                    .setLeftField(leftRightFieldInfo.rightSideInfo.fieldInfo)
                    .setRightField(leftRightFieldInfo.leftSideInfo.fieldInfo)
                    .setLeftRecords(rightJoinRecordIDs)
                    .setIsOuterJoin(true)
                    .createTable();

                derivedTable.tableInfo.concat(rightDerivedTable.tableInfo); // skipcq: JS-D008

                break;

            default:
                throw new Error(`Internal error.  No support for join type: ${joinTable.type}`);
        }
        return derivedTable;
    }
}

class JoinTablesRecordIds {
    constructor(joinTables) {
        this.dataJoin = joinTables;
        this.tableFields = null;
        /** @type {LeftRightJoinFields} */
        this.joinFields = null;
        this.tableFields = null;
        this.tableInfo = null;
        this.bindVariables = null;
        this.primaryTableInfo = null
        /** @type {Table} */
        this.masterTable = null;
        this.rightTableName = "";
        this.leftTableName = "";
        this.joinType = "";
    }

    /**
     *
     * @param {Object} conditionAst
     * @returns {Array}
     */
    getRecordIDs(conditionAst) {
        /** @type {Table} */
        this.masterTable = this.dataJoin.isDerivedTable() ? this.dataJoin.getJoinedTableInfo() : this.primaryTableInfo;
        this.calcSqlField = new CalculatedField(this.masterTable, this.primaryTableInfo, this.tableFields);

        this.joinFields = this.getLeftRightFieldInfo(conditionAst);
        const recIds = this.getMatchedRecordIds();

        return recIds;
    }

    /**
     * 
     * @param {TableFields} tableFields 
     * @returns {JoinTablesRecordIds}
     */
    setTableFields(tableFields) {
        this.tableFields = tableFields;
        return this;
    }

    /**
     * 
     * @param {Map<String,Table>} tableInfo - Map of table info.
     * @returns {JoinTablesRecordIds}
     */
    setTableInfo(tableInfo) {
        this.tableInfo = tableInfo;
        return this;
    }

    /**
     * 
     * @param {BindData} bindVariables - Bind variable data. 
     * @returns {JoinTablesRecordIds}
     */
    setBindVariables(bindVariables) {
        this.bindVariables = bindVariables;
        return this;
    }

    /**
     * 
     * @param {String} name 
     * @returns {JoinTablesRecordIds}
     */
    setRightTableName(name) {
        this.rightTableName = name;
        return this;
    }

    /**
     * 
     * @param {String} name 
     * @returns {JoinTablesRecordIds}
     */
    setLeftTableName(name) {
        this.leftTableName = name;
        return this;
    }

    /**
     * 
     * @param {String} joinType 
     * @returns {JoinTablesRecordIds}
     */
    setJoinType(joinType) {
        this.joinType = joinType;
        return this;
    }

    /**
     * 
     * @param {Table} primaryTableInfo 
     * @returns {JoinTablesRecordIds}
    */
    setPrimaryTableInfo(primaryTableInfo) {
        this.primaryTableInfo = primaryTableInfo;
        return this;
    }

    /**
     * 
     * @returns {LeftRightJoinFields}
     */
    getJoinFieldsInfo() {
        return this.joinFields;
    }

    /**
     * @typedef {Object} LeftRightJoinFields
     * @property {JoinSideInfo} leftSideInfo
     * @property {JoinSideInfo} rightSideInfo
     * 
     */

    /**
     * @typedef {Object} JoinSideInfo
     * @property {TableField} fieldInfo
     * @property {String} column
     */

    /**
     *
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

        leftFieldInfo = this.getTableInfoFromCalculatedField(left);
        rightFieldInfo = this.getTableInfoFromCalculatedField(right);

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
        if (typeof leftFieldInfo !== 'undefined' && this.rightTableName === leftFieldInfo.originalTable) {
            return {
                leftSideInfo: rightSideInfo,
                rightSideInfo: leftSideInfo
            };
        }

        return { leftSideInfo, rightSideInfo };
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
     * 
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
        if (foundTableField !== null)
            return foundTableField;

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
     * 
     * @param {String} calcField 
     * @param {String[]} columns 
     * @returns {TableField}
     */
    searchColumnsForTable(calcField, columns) {
        let fieldInfo = null;
        let foundTableField = null;

        for (const col of columns) {
            fieldInfo = this.tableFields.getFieldInfo(col);
            if (typeof fieldInfo !== 'undefined') {
                foundTableField = Object.assign({}, fieldInfo);
                foundTableField.calculatedFormula = calcField;
                return foundTableField;
            }
        }

        return foundTableField;
    }

    /**
     *
     * @returns {Array}
     */
    getMatchedRecordIds() {
        /** @type {Number[][]} */
        let matchedRecordIDs = [];
        let rightJoinRecordIDs = [];

        switch (this.joinType) {
            case "left":
                matchedRecordIDs = this.leftRightJoin(this.joinFields.leftSideInfo, this.joinFields.rightSideInfo, this.joinType);
                break;
            case "inner":
                matchedRecordIDs = this.leftRightJoin(this.joinFields.leftSideInfo, this.joinFields.rightSideInfo, this.joinType);
                break;
            case "right":
                matchedRecordIDs = this.leftRightJoin(this.joinFields.rightSideInfo, this.joinFields.leftSideInfo, this.joinType);
                break;
            case "full":
                matchedRecordIDs = this.leftRightJoin(this.joinFields.leftSideInfo, this.joinFields.rightSideInfo, this.joinType);
                rightJoinRecordIDs = this.leftRightJoin(this.joinFields.rightSideInfo, this.joinFields.leftSideInfo, "outer");
                break;
            default:
                throw new Error(`Invalid join type: ${this.joinType}`);
        }


        return [matchedRecordIDs, rightJoinRecordIDs];
    }

    /**
     * Returns array of each matching record ID from right table for every record in left table.
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

        const leftTableData = leftField.fieldInfo.tableInfo.tableData;
        const leftTableCol = leftField.fieldInfo.tableColumn;

        //  Map the RIGHT JOIN key to record numbers.
        const keyFieldMap = this.createKeyFieldRecordMap(rightField);

        let keyMasterJoinField = null;
        for (let leftTableRecordNum = 1; leftTableRecordNum < leftTableData.length; leftTableRecordNum++) {
            keyMasterJoinField = this.getJoinColumnData(leftField, leftTableRecordNum);

            const joinRows = !keyFieldMap.has(keyMasterJoinField) ? [] : keyFieldMap.get(keyMasterJoinField);

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

    /**
     * 
     * @param {JoinSideInfo} fieldInfo 
     * @param {Number} recordNumber
     * @returns {String}
     */
    getJoinColumnData(fieldInfo, recordNumber) {
        let keyMasterJoinField = null;
        const tableColumnNumber = fieldInfo.fieldInfo.tableColumn;

        if (typeof tableColumnNumber !== 'undefined') {
            keyMasterJoinField = fieldInfo.fieldInfo.tableInfo.tableData[recordNumber][tableColumnNumber];
        }
        else {
            keyMasterJoinField = this.calcSqlField.evaluateCalculatedField(fieldInfo.column, recordNumber);
        }

        if (keyMasterJoinField !== null) {
            keyMasterJoinField = keyMasterJoinField.toString();
        }    

        return keyMasterJoinField;
    }

    /**
     * 
     * @param {JoinSideInfo} rightField 
     * @returns {Map<String, Number[]>}
     */
    createKeyFieldRecordMap(rightField) {
        let keyFieldMap = null;

        if (typeof rightField.fieldInfo.tableColumn !== 'undefined') {
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
