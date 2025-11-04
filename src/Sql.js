// @author Chris Demmings - https://demmings.github.io/
/*  *** DEBUG START ***
//  Remove comments for testing in NODE
export { Sql, gsSQL, GasSql, BindData, TableExtract };
import { Table } from './Table.js';
import { TableData } from './TableData.js';
import { SqlParse } from './SimpleParser.js';
import { SelectTables } from './Views.js';

class Logger {
    static log(msg) {
        console.log(msg);
    }
}
//  *** DEBUG END ***/
/**
 * Query any sheet range using standard SQL SELECT syntax.
 * @example
 * gsSQL("select * from expenses where type = ?1", "expenses", A1:B, true, "travel")
 * 
 * @param {String} statement - SQL string 
 * @param {...any} parms - "table name",  SheetRange, [..."table name", SheetRange], OutputTitles (true/false), [...Bind Variable] 
 * @returns {any[][]} - Double array of selected data.  First index ROW, Second index COLUMN.
 * @customfunction
 */
function gsSQL(statement, ...parms) {     //  skipcq: JS-0128
    return GasSql.execute(statement, parms);
}

/**
 * @classdesc 
 * Top level class used by Google Sheets custom function to process SELECT and return table data. 
 */
class GasSql {
    /**
     * Run SELECT command statement and returns data in a table format (double array).
     * The appropriate functions are selected to be run based on the format of the command line parameters.
     * @param {String} statement 
     * @param {any[]} parms 
     * @returns {any[][]}
     */
    static execute(statement, parms) {
        if (parms.length === 0 || (parms.length > 0 && (Array.isArray(parms[0]) || parms[0] === ''))) {
            return GasSql.executeSqlv1(statement, parms);
        }
        else if (parms.length > 0 && typeof parms[0] === 'string') {
            return GasSql.executeSqlv2(statement, parms);
        }
        else {
            throw new Error("Invalid gsSQL() parameter list.");
        }
    }

    /**
     * Processes SQL SELECT using original command line syntax.  This syntax does not update automatically if the
     * data changes, so is not recommended anymore.
     * @param {String} statement 
     * @param {any[]} parms 
     * @returns {any[][]}
     */
    static executeSqlv1(statement, parms) {
        const sqlCmd = new Sql();
        let columnTitle = true;
        const bindings = [];

        //  If first item of parms is an array, the parms are assumed to be:
        // @param {any[][]} tableArr - {{"tableName", "sheetRange", cacheSeconds, hasColumnTitle}; {"name","range",cache,true};...}"
        // @param {Boolean} columnTitle - TRUE will add column title to output (default=TRUE)
        // @param {...any} bindings - Bind variables to match '?' in SQL statement.
        const tableArr = parms.length > 0 ? parms[0] : [];

        const tableList = GasSql.parseTableSettings(tableArr, statement);
        Logger.log(`gsSQL: tableList=${tableList}.  Statement=${statement}. List Len=${tableList.length}`);

        for (const tableDef of tableList) {
            sqlCmd.addTableData(tableDef[0], tableDef[1], tableDef[2], tableDef[3]);
        }
        columnTitle = parms.length > 1 ? parms[1] : true;

        for (let i = 2; i < parms.length; i++) {
            bindings.push(parms[i]);
        }

        sqlCmd.enableColumnTitle(columnTitle);

        for (const bind of bindings) {
            sqlCmd.addBindParameter(bind);
        }

        return sqlCmd.execute(statement);
    }

    /**
     * Process SQL SELECT using new command line syntax.  Using this syntax ensures that the select data is refreshed
     * if any of the selected table data changes - and is therefore the recommended usage.
     * @param {String} statement 
     * @param {any[]} parms 
     * @returns {any[][]}
     */
    static executeSqlv2(statement, parms) {
        const sqlCmd = new Sql();
        let columnTitle = true;
        const bindings = [];

        //  We expect:  "tableName", tableData[], ...["tableName", tableData[]], includeColumnOutput, ...bindings
        let i = 0;
        while (i + 1 < parms.length && typeof parms[i] !== 'boolean') {
            // Logger.log(`Add Table: ${parms[i]}. Items=${parms[i + 1].length}`);
            sqlCmd.addTableData(parms[i], parms[i + 1], 0, true);
            i += 2;
        }
        if (i < parms.length && typeof parms[i] === 'boolean') {
            columnTitle = parms[i];
            i++
        }
        Logger.log(`Column Titles: ${columnTitle}`);
        while (i < parms.length) {
            Logger.log(`Add BIND Variable: ${parms[i]}`);
            bindings.push(parms[i]);
            i++
        }

        sqlCmd.enableColumnTitle(columnTitle);

        for (const bind of bindings) {
            sqlCmd.addBindParameter(bind);
        }

        return sqlCmd.execute(statement);
    }

    /**
     * 
     * @param {any[][]} tableArr - Referenced Table list.  This is normally the second parameter in gsSQL() custom function.  
     * It is a double array with first index for TABLE, and the second index are settings in the table. 
     * The setting index for each table is as follows:
     * * 0 - Table Name.
     * * 1 - Sheet Range.
     * * 2 - Cache seconds.
     * * 3 - First row contains title (for field name)
     * @param {String} statement - SQL SELECT statement.  If no data specified in 'tableArr', the SELECT is 
     * parsed and each referenced table is assumed to be a TAB name on the sheet.
     * @param {Boolean} randomOrder - Returned table list is randomized.
     * @returns {any[][]} - Data from 'tableArr' PLUS any extracted tables referenced from SELECT statement.
     * It is a double array with first index for TABLE, and the second index are settings in the table. 
     * The setting index for each table is as follows:
     * * 0 - Table Name.
     * * 1 - Sheet Range.
     * * 2 - Cache seconds.
     * * 3 - First row contains title (for field name)
     */
    static parseTableSettings(tableArr, statement = "", randomOrder = true) {
        let tableList = [];
        let referencedTableSettings = tableArr;

        //  Get table names from the SELECT statement when no table range info is given.
        if (tableArr.length === 0 && statement !== "") {
            referencedTableSettings = TableExtract.getReferencedTableNames(statement);
        }

        if (referencedTableSettings.length === 0) {
            throw new Error('Missing table definition {{"name","range",cache};{...}}');
        }

        Logger.log(`tableArr = ${referencedTableSettings}`);
        for (/** @type {any[]} */ const table of referencedTableSettings) {
            if (table.length === 1)
                table.push(table[0]);   // if NO RANGE, assumes table name is sheet name.
            if (table.length === 2)
                table.push(60);         //  default 0 second cache.
            if (table.length === 3)
                table.push(true);       //  default HAS column title row.
            if (table[1] === "")
                table[1] = table[0];    //  If empty range, assumes TABLE NAME is the SHEET NAME and loads entire sheet.
            if (table.length !== 4)
                throw new Error("Invalid table definition [name,range,cache,hasTitle]");

            tableList.push(table);
        }

        //  If called at the same time, loading similar tables in similar order - all processes
        //  just wait for table - but if loaded in different order, each process could be loading something.
        if (randomOrder)
            tableList = tableList.sort(() => Math.random() - 0.5);

        return tableList;
    }
}

/** 
 * @classdesc
 * Perform SQL SELECT using this class.
 */
class Sql {
    constructor() {
        /** @property {Map<String,Table>} - Map of referenced tables.*/
        this.tables = new Map();
        /** @property {Boolean} - Are column tables to be ouptout? */
        this.columnTitle = false;
        /** @property {BindData} - List of BIND data linked to '?' in statement. */
        this.bindData = new BindData();
        /** @property {String} - derived table name to output in column title replacing source table name. */
        this.columnTableNameReplacement = null;
    }

    /**
    * Parse SQL SELECT statement, performs SQL query and returns data ready for custom function return.
    * <br>Execute() can be called multiple times for different SELECT statements, provided that all required
    * table data was loaded in the constructor.  
    * Methods that would be used PRIOR to execute are:
    * <br>**enableColumnTitle()** - turn on/off column title in output
    * <br>**addBindParameter()** - If bind data is needed in select.  e.g. "select * from table where id = ?"
    * <br>**addTableData()** - At least ONE table needs to be added prior to execute. This tells **execute** where to find the data.
    * <br>**Example SELECT and RETURN Data**
    * ```js
    *   let stmt = "SELECT books.id, books.title, books.author_id " +
    *        "FROM books " +
    *        "WHERE books.author_id IN ('11','12') " +
    *        "ORDER BY books.title";
    *
    *    let data = new Sql()
    *        .addTableData("books", this.bookTable())
    *        .enableColumnTitle(true)
    *        .execute(stmt);
    * 
    *    Logger.log(data);
    * 
    * [["books.id", "books.title", "books.author_id"],
    *    ["4", "Dream Your Life", "11"],
    *    ["8", "My Last Book", "11"],
    *    ["5", "Oranges", "12"],
    *    ["1", "Time to Grow Up!", "11"]]
    * ```
    * @param {any} statement - SELECT statement as STRING or AST of SELECT statement.
    * @returns {any[][]} - Double array where first index is ROW and second index is COLUMN.
    */
    execute(statement) {
        this.ast = (typeof statement === 'string') ? SqlParse.sql2ast(statement) : statement;

        //  "SELECT * from (select a,b,c from table) as derivedtable"
        //  Sub query data is loaded and given the name 'derivedtable' (using ALIAS from AS)
        //  The AST.FROM is updated from the sub-query to the new derived table name. 
        this.selectFromSubQuery();

        //  A JOIN table can a sub-query.  When this is the case, the sub-query SELECT is
        //  evaluated and the return data is given the ALIAS (as) name.  The AST is then
        //  updated to use the new table.
        this.selectJoinSubQuery();

        TableAlias.setTableAlias(this.tables, this.ast);
        Sql.loadSchema(this.tables);

        let selectResults = this.select(this.ast);

        //  Apply SET rules to SELECTs (UNION, UNION ALL, EXCEPT, INTERSECT)
        selectResults = this.selectSet(selectResults, this.ast);

        return selectResults;
    }

    /**
     * Modifies AST when FROM is a sub-query rather than a table name.
     */
    selectFromSubQuery() {
        if (typeof this.ast.FROM === 'undefined' || typeof this.ast.FROM.SELECT === 'undefined')
            return;

        const data = new Sql()
            .setTables(this.tables)
            .enableColumnTitle(true)
            .replaceColumnTableNameWith(this.ast.FROM.table)
            .execute(this.ast.FROM);

        if (typeof this.ast.FROM.table !== 'undefined') {
            this.addTableData(this.ast.FROM.table, data);
        }

        if (this.ast.FROM.table === '') {
            throw new Error("Every derived table must have its own alias");
        }

        this.ast.FROM.as = '';
    }

    /**
     * Checks if the JOINed table is a sub-query.  
     * The sub-query is evaluated and assigned the alias name.
     * The AST is adjusted to use the new JOIN TABLE.
     * @returns {void}
     */
    selectJoinSubQuery() {
        if (typeof this.ast.JOIN === 'undefined')
            return;

        //  When joinAst.table is an OBJECT, then it is a sub-query.
        const subQueries = this.ast.JOIN.filter(joinAst => typeof joinAst.table !== 'string');

        for (const joinAst of subQueries) {
            const data = new Sql()
                .setTables(this.tables)
                .enableColumnTitle(true)
                .replaceColumnTableNameWith(joinAst.as)
                .execute(joinAst.table);

            if (typeof joinAst.as !== 'undefined') {
                this.addTableData(joinAst.as, data);
            }

            if (joinAst.as === '') {
                throw new Error("Every derived table must have its own alias");
            }
            joinAst.table = joinAst.as;
            joinAst.as = '';
        }
    }

    /**
     * Apply set rules to each select result.
     * @param {any[][]} leftTableData 
     * @param {Object} unionAst 
     * @returns {any[][]}
     */
    selectSet(leftTableData, unionAst) {
        if (!SqlSets.isSqlSet(unionAst)) {
            return leftTableData;
        }

        const columnTitles = this.areColumnTitlesOutput() && leftTableData.length > 0 ? leftTableData.shift() : [];

        this.enableColumnTitle(false);
        let ast = unionAst;
        while (SqlSets.isSqlSet(ast)) {
            const setType = SqlSets.getSetType(ast);
            ast = ast[setType][0];
            const rightTableData = this.select(ast);
            leftTableData = SqlSets.applySet(setType, leftTableData, rightTableData);
        }

        if (columnTitles.length > 0) {
            leftTableData.unshift(columnTitles);
        }

        return leftTableData;
    }

    /**
     * Load SELECT data and return in double array.
     * @param {Object} selectAst - Abstract Syntax Tree of SELECT
     * @returns {any[][]} - double array useable by Google Sheet in custom function return value.
     * * First row of data will be column name if column title output was requested.
     * * First Array Index - ROW
     * * Second Array Index - COLUMN
     */
    select(selectAst) {
        let ast = selectAst;

        Sql.errorCheckSelectAST(ast);

        //  Manipulate AST to add GROUP BY if DISTINCT keyword.
        ast = Sql.distinctField(ast);

        //  Manipulate AST add pivot fields.
        ast = Pivot.pivotField(ast, this.tables, this.bindData);

        const view = new SelectTables(ast, this.tables, this.bindData);

        //  JOIN tables to create a derived table.
        view.join(ast);                 // skipcq: JS-D008

        view.updateSelectedFields(ast);

        //  Get the record ID's of all records matching WHERE condition.
        const recordIDs = view.whereCondition(ast);

        //  Get selected data records.
        let viewTableData = view.getViewData(recordIDs);

        //  Compress the data.
        viewTableData = view.groupBy(ast, viewTableData);

        //  Sort our selected data.
        viewTableData = view.orderBy(ast, viewTableData);

        //  Remove fields referenced but not included in SELECT field list.
        view.removeTempColumns(viewTableData);

        //  Limit rows returned.
        viewTableData = SelectTables.limit(ast, viewTableData);

        //  Add column titles
        viewTableData = this.addColumnTitles(viewTableData, view);

        //  Deal with empty dataset.
        viewTableData = Sql.cleanUp(viewTableData);

        return viewTableData;
    }

    /**
     * Add data for each referenced table in SELECT, before EXECUTE().
     * @param {String} tableName - Name of table referenced in SELECT.
     * @param {any} tableData - Either double array or a named range.
     * @param {Number} cacheSeconds - How long should loaded data be cached (default=0)
     * @param {Boolean} hasColumnTitle - Is first data row the column title?
     * @returns {Sql}
     */
    addTableData(tableName, tableData, cacheSeconds = 0, hasColumnTitle = true) {
        let tableInfo = null;

        if (Array.isArray(tableData)) {
            tableInfo = new Table(tableName)
                .setHasColumnTitle(hasColumnTitle)
                .loadArrayData(tableData);
        }
        else {
            tableInfo = new Table(tableName)
                .setHasColumnTitle(hasColumnTitle)
                .loadNamedRangeData(tableData, cacheSeconds);
        }

        this.tables.set(tableName.toUpperCase(), tableInfo);

        return this;
    }

    /**
     * Copies the data from an external tableMap to this instance.  
     * It copies a reference to outside array data only.  
     * The schema would need to be re-loaded.
     * @param {Map<String,Table>} tableMap 
     */
    copyTableData(tableMap) {
        // @ts-ignore
        for (const tableName of tableMap.keys()) {
            const tableInfo = tableMap.get(tableName);
            this.addTableData(tableName, tableInfo.tableData);
        }

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
     * Derived table data that requires the ALIAS table name in column title.
     * @param {String} replacementTableName - derived table name to replace original table name.  To disable, set to null.
     * @returns {Sql}
     */
    replaceColumnTableNameWith(replacementTableName) {
        this.columnTableNameReplacement = replacementTableName;
        return this;
    }

    /**
     * Query if this instance of Sql() will generate column titles.
     * @returns {Boolean}
     */
    areColumnTitlesOutput() {
        return this.columnTitle;
    }

    /**
     * Add a bind data value.  Must be added in order.  If bind data is a named range, use addBindNamedRangeParameter().
     * @param {any} value - literal data. 
     * @returns {Sql}
     */
    addBindParameter(value) {
        this.bindData.add(value);
        return this;
    }

    /**
     * List of bind data added so far.
     * @returns {any[]}
     */
    getBindData() {
        return this.bindData.getBindDataList();
    }

    /**
     * The BIND data is a sheet named range that will be read and used for bind data.
     * @param {String} value - Sheets Named Range for SINGLE CELL only.
     * @returns {Sql}
     */
    addBindNamedRangeParameter(value) {
        const namedValue = TableData.getValueCached(value, 30);
        this.bindData.add(namedValue);
        Logger.log(`BIND=${value} = ${namedValue}`);
        return this;
    }

    /**
     * Set all bind data at once using array.
     * @param {BindData} value - Bind data.
     * @returns {Sql}
     */
    setBindValues(value) {
        this.bindData = value;
        return this;
    }

    /**
     * Clears existing BIND data so Sql() instance can be used again with new bind parameters.
     * @returns {Sql}
     */
    clearBindParameters() {
        this.bindData.clear();
        return this;
    }

    /**
     * Updates 'tables' with table column information.
     * @param {Map<String,Table>} tables 
     */
    static loadSchema(tables) {
        // @ts-ignore
        for (const table of tables.keys()) {
            const tableInfo = tables.get(table.toUpperCase());
            tableInfo.loadSchema();
        }
    }

    /**
     * Sets all tables referenced SELECT.
     * @param {Map<String,Table>} mapOfTables - Map of referenced tables indexed by TABLE name.
     */
    setTables(mapOfTables) {
        this.tables = mapOfTables;
        return this;
    }

    /**
     * Returns a map of all tables configured for this SELECT.
     * @returns {Map<String,Table>} - Map of referenced tables indexed by TABLE name.
     */
    getTables() {
        return this.tables;
    }

    /**
     * Basic sanity check of AST for a SELECT statement.
     * @param {object} ast 
     */
    static errorCheckSelectAST(ast) {
        if (typeof ast.SELECT === 'undefined') {
            throw new Error("Only SELECT statements are supported.");
        }

        if (typeof ast.FROM === 'undefined') {
            throw new Error("Missing keyword FROM");
        }
    }

    /**
     * If 'GROUP BY' is not set and 'DISTINCT' column is specified, update AST to add 'GROUP BY'.
     * @param {Object} ast - Abstract Syntax Tree for SELECT.
     * @returns {Object} - Updated AST to include GROUP BY when DISTINCT field used.
     */
    static distinctField(ast) {
        const astFields = ast.SELECT;

        if (astFields.length === 0) {
            return ast;
        }

        const firstField = astFields[0].name.toUpperCase();
        if (firstField.startsWith("DISTINCT")) {
            astFields[0].name = firstField.replace("DISTINCT", "").trim();

            if (typeof ast['GROUP BY'] === 'undefined') {
                ast["GROUP BY"] = astFields.map(astItem => ({ name: astItem.name, as: '' }));
            }
        }

        return ast;
    }

    /**
     * Add column titles to data if needed.
     * @param {any[][]} viewTableData 
     * @param {SelectTables} view 
     * @returns {any[][]}
     */
    addColumnTitles(viewTableData, view) {
        if (this.columnTitle) {
            viewTableData.unshift(view.getColumnTitles(this.columnTableNameReplacement));
        }

        return viewTableData;
    }

    /**
     * If no data and no titles, create empty double array so sheets function does not have an error.
     * @param {any[][]} viewTableData 
     * @returns {any[][]}
     */
    static cleanUp(viewTableData) {
        if (viewTableData.length === 0) {
            viewTableData.push([""]);
        }

        if (viewTableData.length === 1 && viewTableData[0].length === 0) {
            viewTableData[0] = [""];
        }

        return viewTableData;
    }
}

/**
 * @classdesc Deals with the table ALIAS inside select AST.
 */
class TableAlias {
    /**
     * Updates 'tables' with associated table ALIAS name found in ast.
     * @param {Map<String,Table>} tables 
     * @param {Object} ast 
     */
    static setTableAlias(tables, ast) {
        // @ts-ignore
        for (const table of tables.keys()) {
            const tableAlias = TableAlias.getTableAlias(table, ast);

            const tableInfo = tables.get(table.toUpperCase());
            tableInfo.setTableAlias(tableAlias);
        }
    }

    /**
    * Find table alias name (if any) for input actual table name.
    * @param {String} tableName - Actual table name.
    * @param {Object} ast - Abstract Syntax Tree for SQL.
    * @returns {String[]} - Table alias.  Empty string if not found.
    */
    static getTableAlias(tableName, ast) {
        let tableAlias = [];
        const ucTableName = tableName.toUpperCase();

        tableAlias.push(...TableAlias.getTableAliasFromJoin(ucTableName, ast));
        tableAlias.push(...TableAlias.getTableAliasUnion(ucTableName, ast));
        tableAlias.push(...TableAlias.getTableAliasWhereIn(ucTableName, ast));
        tableAlias.push(...TableAlias.getTableAliasWhereTerms(ucTableName, ast));

        return tableAlias;
    }

    /**
     * Searches the FROM and JOIN components of a SELECT to find the table alias.
     * @param {String} tableName - table name to search for.
     * @param {Object} ast - Abstract Syntax Tree to search
     * @returns {String[]} - Table alias name.
     */
    static getTableAliasFromJoin(tableName, ast) {
        const astTableBlocks = ['FROM', 'JOIN'];
        const aliasList = [];

        for (const block of astTableBlocks) {
            aliasList.push(...TableAlias.locateAstTableAlias(tableName, ast, block));
        }

        return aliasList;
    }

    /**
     * Search a property of AST for table alias name.
     * @param {String} tableName - Table name to find in AST.
     * @param {Object} ast - AST of SELECT.
     * @param {String} astBlock - AST property to search.
     * @returns {String[]} - Alias name or "" if not found.
     */
    static locateAstTableAlias(tableName, ast, astBlock) {
        const aliastSet = new Set();

        if (typeof ast[astBlock] === 'undefined') {
            return Array.from(aliastSet);
        }

        let block = [ast[astBlock]];
        if (TableAlias.isIterable(ast[astBlock])) {
            block = ast[astBlock];
        }

        for (const astItem of block) {
            if (typeof astItem.table === 'string' && tableName === astItem.table.toUpperCase() && astItem.as !== "") {
                aliastSet.add(astItem.as);
            }
        }

        return Array.from(aliastSet);
    }

    /**
     * Check if input is iterable.
     * @param {any} input - Check this object to see if it can be iterated. 
     * @returns {Boolean} - true - can be iterated.  false - cannot be iterated.
     */
    static isIterable(input) {
        if (input === null || input === undefined) {
            return false
        }

        return typeof input[Symbol.iterator] === 'function'
    }

    /**
     * Searches the UNION portion of the SELECT to locate the table alias.
     * @param {String} tableName - table name to search for.
     * @param {Object} ast - Abstract Syntax Tree to search
     * @returns {String[]} - table alias
     */
    static getTableAliasUnion(tableName, ast) {
        const astRecursiveTableBlocks = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];
        const extractedAlias = [];

        let i = 0;
        while (i < astRecursiveTableBlocks.length) {
            if (typeof ast[astRecursiveTableBlocks[i]] !== 'undefined') {
                for (const unionAst of ast[astRecursiveTableBlocks[i]]) {
                    extractedAlias.push(...TableAlias.getTableAlias(tableName, unionAst));
                }
            }
            i++;
        }

        return extractedAlias;
    }

    /**
     * Search WHERE IN component of SELECT to find table alias.
     * @param {String} tableName - table name to search for
     * @param {Object} ast - Abstract Syntax Tree to search
     * @returns {String[]} - table alias
     */
    static getTableAliasWhereIn(tableName, ast) {
        const extractedAlias = [];

        if (typeof ast.WHERE !== 'undefined' && ast.WHERE.operator === "IN") {
            extractedAlias.push(...TableAlias.getTableAlias(tableName, ast.WHERE.right));
        }

        if (ast.operator === "IN") {
            extractedAlias.push(...TableAlias.getTableAlias(tableName, ast.right));
        }

        return extractedAlias;
    }

    /**
     * Search WHERE terms of SELECT to find table alias.
     * @param {String} tableName  - table name to search for.
     * @param {Object} ast - Abstract Syntax Tree to search.
     * @returns {String[]} - table alias
     */
    static getTableAliasWhereTerms(tableName, ast) {
        const extractedTableAlias = [];

        if (typeof ast.WHERE !== 'undefined' && typeof ast.WHERE.terms !== 'undefined') {
            for (const term of ast.WHERE.terms) {
                extractedTableAlias.push(...TableAlias.getTableAlias(tableName, term));
            }
        }

        return extractedTableAlias;
    }
}

/**
 * @classdesc Deals with extracting all TABLE names referenece inside SELECT.
 */
class TableExtract {
    /**
     * Create table definition array from select string.
     * @param {String} statement - full sql select statement.
     * @returns {String[][]} - table definition array.
     */
    static getReferencedTableNames(statement) {
        const ast = SqlParse.sql2ast(statement);
        return TableExtract.getReferencedTableNamesFromAst(ast);
    }

    /**
     * Create table definition array from select AST.
     * @param {Object} ast - AST for SELECT. 
     * @returns {any[]} - table definition array.
     * * [0] - table name.
     * * [1] - sheet tab name
     * * [2] - cache seconds
     * * [3] - output column title flag
     */
    static getReferencedTableNamesFromAst(ast) {
        const DEFAULT_CACHE_SECONDS = 60;
        const DEFAULT_COLUMNS_OUTPUT = true;
        const tableSet = new Map();

        TableExtract.extractAstTables(ast, tableSet);

        const tableList = [];
        // @ts-ignore
        for (const key of tableSet.keys()) {
            const tableDef = [key, key, DEFAULT_CACHE_SECONDS, DEFAULT_COLUMNS_OUTPUT];

            tableList.push(tableDef);
        }

        return tableList;
    }

    /**
     * Search for all referenced tables in SELECT.
     * @param {Object} ast - AST for SELECT.
     * @param {Map<String,String>} tableSet  - Function updates this map of table names and alias name.
     */
    static extractAstTables(ast, tableSet) {
        if (typeof ast === 'undefined' || ast === null) {
            return;
        }

        TableExtract.getTableNamesFrom(ast, tableSet);
        TableExtract.getTableNamesJoin(ast, tableSet);
        TableExtract.getTableNamesUnion(ast, tableSet);
        TableExtract.getTableNamesWhereIn(ast, tableSet);
        TableExtract.getTableNamesWhereTerms(ast, tableSet);
        TableExtract.getTableNamesCorrelatedSelect(ast, tableSet);
    }

    /**
     * Search for referenced table in FROM or JOIN part of select.
     * @param {Object} ast - AST for SELECT.
     * @param {Map<String,String>} tableSet  - Function updates this map of table names and alias name.
     */
    static getTableNamesFrom(ast, tableSet) {
        let fromAst = ast.FROM;
        while (typeof fromAst !== 'undefined') {
            if (typeof fromAst.isDerived === 'undefined') {
                tableSet.set(fromAst.table.toUpperCase(), typeof fromAst.as === 'undefined' ? '' : fromAst.as.toUpperCase());
            }
            else {
                TableExtract.extractAstTables(fromAst.FROM, tableSet);
                TableExtract.getTableNamesUnion(fromAst, tableSet);
            }
            fromAst = fromAst.FROM;
        }
    }

    /**
    * Search for referenced table in FROM or JOIN part of select.
    * @param {Object} ast - AST for SELECT.
    * @param {Map<String,String>} tableSet  - Function updates this map of table names and alias name.
    */
    static getTableNamesJoin(ast, tableSet) {
        if (typeof ast.JOIN === 'undefined')
            return;

        for (const astItem of ast.JOIN) {
            if (typeof astItem.table === 'string') {
                tableSet.set(astItem.table.toUpperCase(), typeof astItem.as === 'undefined' ? '' : astItem.as.toUpperCase());
            }
            else {
                TableExtract.extractAstTables(astItem.table, tableSet);
            }
        }
    }

    /**
     * Searches for table names within SELECT (union, intersect, except) statements.
     * @param {Object} ast - AST for SELECT
     * @param {Map<String,String>} tableSet - Function updates this map of table names and alias name.
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
     * Searches for tables names within SELECT (in, exists) statements.
     * @param {Object} ast - AST for SELECT
     * @param {Map<String,String>} tableSet - Function updates this map of table names and alias name.
     */
    static getTableNamesWhereIn(ast, tableSet) {
        const subQueryTerms = ["IN", "NOT IN", "EXISTS", "NOT EXISTS"]
        if (typeof ast.WHERE !== 'undefined' && (subQueryTerms.indexOf(ast.WHERE.operator) !== -1)) {
            this.extractAstTables(ast.WHERE.right, tableSet);
        }

        if (subQueryTerms.indexOf(ast.operator) !== -1) {
            this.extractAstTables(ast.right, tableSet);
        }
    }

    /**
     * Search WHERE to find referenced table names.
     * @param {Object} ast -  AST to search.
     * @param {Map<String,String>} tableSet - Function updates this map of table names and alias name.
     */
    static getTableNamesWhereTerms(ast, tableSet) {
        if (typeof ast.WHERE !== 'undefined' && typeof ast.WHERE.terms !== 'undefined') {
            for (const term of ast.WHERE.terms) {
                this.extractAstTables(term, tableSet);
            }
        }
    }

    /**
     * Search for table references in the WHERE condition.
     * @param {Object} ast -  AST to search.
     * @param {Map<String,String>} tableSet - Function updates this map of table names and alias name. 
     */
    static getTableNamesWhereCondition(ast, tableSet) {
        const lParts = typeof ast.left === 'string' ? ast.left.split(".") : [];
        if (lParts.length > 1) {
            tableSet.set(lParts[0].toUpperCase(), "");
        }
        const rParts = typeof ast.right === 'string' ? ast.right.split(".") : [];
        if (rParts.length > 1) {
            tableSet.set(rParts[0].toUpperCase(), "");
        }
        if (typeof ast.terms !== 'undefined') {
            for (const term of ast.terms) {
                TableExtract.getTableNamesWhereCondition(term, tableSet);
            }
        }
    }

    /**
     * Search CORRELATES sub-query for table names.
     * @param {*} ast - AST to search
     * @param {*} tableSet - Function updates this map of table names and alias name.
     */
    static getTableNamesCorrelatedSelect(ast, tableSet) {
        if (typeof ast.SELECT === 'undefined')
            return;

        ast.SELECT.forEach(term => this.extractAstTables(term.subQuery, tableSet));
    }
}

/**
 * @classdesc Manipulation of AST to handle PIVOT statement.
 */
class Pivot {
    /**
     * Add new column to AST for every AGGREGATE function and unique pivot column data.
     * @param {Object} ast - AST which is checked to see if a PIVOT is used.
     * @param {Map<String,Table>} tables - Map of table info.
     * @param {BindData} bindData - List of bind data.
     * @returns {Object} - Updated AST containing SELECT FIELDS for the pivot data OR original AST if no pivot.
     */
    static pivotField(ast, tables, bindData) {
        //  If we are doing a PIVOT, it then requires a GROUP BY.
        if (typeof ast.PIVOT !== 'undefined') {
            if (typeof ast['GROUP BY'] === 'undefined')
                throw new Error("PIVOT requires GROUP BY");
        }
        else {
            return ast;
        }

        // These are all of the unique PIVOT field data points.
        const pivotFieldData = Pivot.getUniquePivotData(ast, tables, bindData);

        ast.SELECT = Pivot.addCalculatedPivotFieldsToAst(ast, pivotFieldData);

        return ast;
    }

    /**
     * Find distinct pivot column data.
     * @param {Object} ast - Abstract Syntax Tree containing the PIVOT option.
     * @returns {any[][]} - All unique data points found in the PIVOT field for the given SELECT.
     */
    static getUniquePivotData(ast, tables, bindData) {
        const pivotAST = {};

        pivotAST.SELECT = ast.PIVOT;
        pivotAST.SELECT[0].name = `DISTINCT ${pivotAST.SELECT[0].name}`;
        pivotAST.FROM = ast.FROM;
        pivotAST.WHERE = ast.WHERE;

        const pivotSql = new Sql()
            .enableColumnTitle(false)
            .setBindValues(bindData)
            .copyTableData(tables);

        // These are all of the unique PIVOT field data points.
        const tableData = pivotSql.execute(pivotAST);

        return tableData;
    }

    /**
     * Add new calculated fields to the existing SELECT fields.  A field is add for each combination of
     * aggregate function and unqiue pivot data points.  The CASE function is used for each new field.
     * A test is made if the column data equal the pivot data.  If it is, the aggregate function data 
     * is returned, otherwise null.  The GROUP BY is later applied and the appropiate pivot data will
     * be calculated.
     * @param {Object} ast - AST to be updated.
     * @param {any[][]} pivotFieldData - Table data with unique pivot field data points. 
     * @returns {Object} - Abstract Sytax Tree with new SELECT fields with a CASE for each pivot data and aggregate function.
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
                    const caseTxt = `${matches[0]}(CASE WHEN ${ast.PIVOT[0].name} = '${fld}' THEN ${args[1]} ELSE 'null' END)`;
                    const asField = `${fld[0]} ${typeof selectField.as !== 'undefined' && selectField.as !== "" ? selectField.as : selectField.name}`;
                    newPivotAstFields.push({ name: caseTxt, as: asField });
                }
            }
            else {
                newPivotAstFields.push(selectField);
            }
        }

        return newPivotAstFields;
    }

}

/**
 * @classdesc Deals with processing SET theory on SELECT table results.
 */
class SqlSets {
    /**
     * Get list of valid set types.
     * @returns {String[]}
     */
    static getUnionTypes() {
        return ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];
    }

    /**
     * Determine what set type is applied to the select results.
     * @param {Object} ast 
     * @returns {String}
     */
    static getSetType(ast) {
        for (const type of SqlSets.getUnionTypes()) {
            if (typeof ast[type] !== 'undefined') {
                return type;
            }
        }

        return "";
    }

    /**
     * Apply set theory to data.
     * @param {String} type ("UNION", "UNION ALL", "INTERSECT", "EXCEPT")
     * @param {any[][]} leftTableData 
     * @param {any[][]} rightTableData 
     * @returns {any[][]}
     */
    static applySet(type, leftTableData, rightTableData) {
        if (leftTableData.length > 0 && rightTableData.length > 0 && leftTableData[0].length !== rightTableData[0].length) {
            throw new Error(`Invalid ${type}.  Selected field counts do not match.`);
        }

        switch (type) {
            case "UNION":
                leftTableData = leftTableData.concat(rightTableData);
                leftTableData = SqlSets.removeDuplicateRows(leftTableData);
                break;

            case "UNION ALL":
                //  Allow duplicates.
                leftTableData = leftTableData.concat(rightTableData);
                break;

            case "INTERSECT":
                //  Must exist in BOTH tables.
                leftTableData = SqlSets.intersectRows(leftTableData, rightTableData);
                break;

            case "EXCEPT":
                //  Remove from first table all rows that match in second table.
                leftTableData = SqlSets.exceptRows(leftTableData, rightTableData);
                break;

            default:
                throw new Error(`Internal error.  Unsupported UNION type: ${type}`);
        }

        return leftTableData;
    }

    /**
     * 
     * @param {Object} ast 
     * @returns {Boolean}
     */
    static isSqlSet(ast) {
        return SqlSets.getUnionTypes().some(type => typeof ast[type] !== 'undefined');
    }

    /**
     * Remove all duplicate table rows
     * @param {any[][]} srcData 
     * @returns {any[][]}
     */
    static removeDuplicateRows(srcData) {
        const newTableData = [];
        const srcDataRecordKeys = new Map();

        for (const row of srcData) {
            const key = row.join("::");

            if (!srcDataRecordKeys.has(key)) {
                newTableData.push(row);
                srcDataRecordKeys.set(key, true);
            }
        }

        return newTableData;
    }

    /**
     * Finds the rows that are common between srcData and newData
     * @param {any[][]} srcData - table data
     * @param {any[][]} newData - table data
     * @returns {any[][]} - returns only rows that intersect srcData and newData.
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
     * Returns all rows in srcData MINUS any rows that match it from newData.
     * @param {any[][]} srcData - starting table
     * @param {any[][]} newData  - minus table (if it matches srcData row)
     * @returns {any[][]} - srcData MINUS newData
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

        removeRowNum.sort((a, b) => b - a);
        for (rowNum of removeRowNum) {
            srcData.splice(rowNum, 1);
        }

        return srcData;
    }
}

/**
 * @classdesc 
 * Store and retrieve bind data for use in WHERE portion of SELECT statement.
 */
class BindData {
    constructor() {
        this.clear();
    }

    /**
     * Reset the bind data.
     */
    clear() {
        this.next = 1;
        this.bindMap = new Map();
        this.bindQueue = [];
    }

    /**
     * Add bind data 
     * @param {any} data - bind data
     * @returns {String} - bind variable name for reference in SQL.  e.g.  first data point would return '?1'.
     */
    add(data) {
        const key = `?${this.next.toString()}`;
        this.bindMap.set(key, data);
        this.bindQueue.push(data);

        this.next++;

        return key;
    }

    /**
     * Add a list of bind data points.
     * @param {any[]} bindList 
     */
    addList(bindList) {
        for (const data of bindList) {
            this.add(data);
        }
    }

    /**
     * Pull out a bind data entry.
     * @param {String} name - Get by name or get NEXT if empty.
     * @returns {any}
     */
    get(name = "") {
        return name === '' ? this.bindQueue.shift() : this.bindMap.get(name);
    }

    /**
     * Return the ordered list of bind data.
     * @returns {any[]} - Current list of bind data.
     */
    getBindDataList() {
        return this.bindQueue;
    }
}

