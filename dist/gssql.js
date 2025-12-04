// @author Chris Demmings - https://demmings.github.io/
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
        if (this.ast.FROM === undefined || this.ast.FROM.SELECT === undefined)
            return;

        const data = new Sql()
            .setTables(this.tables)
            .enableColumnTitle(true)
            .replaceColumnTableNameWith(this.ast.FROM.table)
            .execute(this.ast.FROM);

        if (this.ast.FROM.table !== undefined) {
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
        if (this.ast.JOIN === undefined)
            return;

        //  When joinAst.table is an OBJECT, then it is a sub-query.
        const subQueries = this.ast.JOIN.filter(joinAst => typeof joinAst.table !== 'string');

        for (const joinAst of subQueries) {
            const data = new Sql()
                .setTables(this.tables)
                .enableColumnTitle(true)
                .replaceColumnTableNameWith(joinAst.as)
                .execute(joinAst.table);

            if (joinAst.as !== undefined) {
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
        if (ast.SELECT === undefined) {
            throw new Error("Only SELECT statements are supported.");
        }

        if (ast.FROM === undefined) {
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

            if (ast['GROUP BY'] === undefined) {
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
        const tableAlias = [];
        const ucTableName = tableName.toUpperCase();

        tableAlias.push(
            ...TableAlias.getTableAliasFromJoin(ucTableName, ast),
            ...TableAlias.getTableAliasUnion(ucTableName, ast),
            ...TableAlias.getTableAliasWhereIn(ucTableName, ast),
            ...TableAlias.getTableAliasWhereTerms(ucTableName, ast));

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

        if (ast[astBlock] === undefined) {
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
            if (ast[astRecursiveTableBlocks[i]] !== undefined) {
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

        if (ast.WHERE !== undefined && ast.WHERE.operator === "IN") {
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

        if (ast.WHERE !== undefined && ast.WHERE.terms !== undefined) {
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
        if (ast === undefined || ast === null) {
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
        while (fromAst !== undefined) {
            if (fromAst.isDerived === undefined) {
                tableSet.set(fromAst.table.toUpperCase(), fromAst.as === undefined ? '' : fromAst.as.toUpperCase());
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
        if (ast.JOIN === undefined)
            return;

        for (const astItem of ast.JOIN) {
            if (typeof astItem.table === 'string') {
                tableSet.set(astItem.table.toUpperCase(), astItem.as === undefined ? '' : astItem.as.toUpperCase());
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
            if (ast[block] !== undefined) {
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
        const subQueryTerms = new Set(["IN", "NOT IN", "EXISTS", "NOT EXISTS"]);

        if (ast.WHERE !== undefined && (subQueryTerms.has(ast.WHERE.operator))) {
            this.extractAstTables(ast.WHERE.right, tableSet);
        }

        if (subQueryTerms.has(ast.operator)) {
            this.extractAstTables(ast.right, tableSet);
        }
    }

    /**
     * Search WHERE to find referenced table names.
     * @param {Object} ast -  AST to search.
     * @param {Map<String,String>} tableSet - Function updates this map of table names and alias name.
     */
    static getTableNamesWhereTerms(ast, tableSet) {
        if (ast.WHERE !== undefined && ast.WHERE.terms !== undefined) {
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
        if (ast.terms !== undefined) {
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
        if (ast.SELECT === undefined)
            return;

        for (const term of ast.SELECT) {
            this.extractAstTables(term.subQuery, tableSet);
        }
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
        if (ast.PIVOT === undefined) {
            return ast;
        }
        else if (ast['GROUP BY'] === undefined) {
            throw new Error("PIVOT requires GROUP BY");
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
                    const asField = `${fld[0]} ${selectField.as !== undefined && selectField.as !== "" ? selectField.as : selectField.name}`;
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
            if (ast[type] !== undefined) {
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
        return SqlSets.getUnionTypes().some(type => ast[type] !== undefined);
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



/** 
 * @classdesc 
 * Data and methods for each (logical) SQL table. 
 */
class Table {       //  skipcq: JS-0128
    /**
     * @param {String} tableName - name of sql table.
     */
    constructor(tableName) {
        /** @property {String} - table name. */
        this.tableName = tableName.toUpperCase();

        /** @property {any[][]} - table data. */
        this.tableData = [];

        /** @property {Boolean} */
        this.hasColumnTitle = true;

        /** @property {Schema} */
        this.schema = new Schema()
            .setTableName(tableName)
            .setTable(this);
    }

    /**
     * Set associated table alias name to object.
     * @param {String[]} tableAlias - table alias that may be used to prefix column names.
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
            Table.addColumnLetters(this.tableData);
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
        if (tableData === undefined || tableData.length === 0)
            return this;

        if (!this.hasColumnTitle) {
            Table.addColumnLetters(tableData);
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
            if (tableData[i].join().replaceAll(',', "").length > 0)
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
    static addColumnLetters(tableData) {
        if (tableData.length === 0)
            return [[]];

        const newTitleRow = [];

        for (let i = 1; i <= tableData[0].length; i++) {
            newTitleRow.push(Table.numberToSheetColumnLetter(i));
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
    static numberToSheetColumnLetter(number) {
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
            result = Table.numberToSheetColumnLetter(quotient) + result;
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
     * @param {String} aliasName
     * @returns {String[]} - field names
     */
    getAllExtendedNotationFieldNames(aliasName = '') {
        return this.schema.getAllExtendedNotationFieldNames(aliasName);
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
        const minStartRecord = Math.max(startRecord, 1);
        const maxLastRecord = lastRecord < 0 ? this.tableData.length - 1 : lastRecord;

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
    createKeyFieldRecordMap(fieldName, calcSqlField = null, calcField = "") {
        const indexedFieldName = fieldName.trim().toUpperCase();
        /** @type {Map<String,Number[]>} */
        const fieldValuesMap = new Map();

        let value = null;
        const fieldIndex = calcSqlField === null ? this.schema.getFieldColumn(indexedFieldName) : null;

        for (let i = 1; i < this.tableData.length; i++) {
            value = calcSqlField === null ? this.tableData[i][fieldIndex] : calcSqlField.evaluateCalculatedField(calcField, i);
            value = (value === null) ? value : value.toString();

            if (value !== "") {
                value = typeof value === 'string' ? value.toUpperCase() : value;
                const rowNumbers = fieldValuesMap.has(value) ? fieldValuesMap.get(value) : [];
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
        this.tableAlias = [];

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
     * @param {String[]} tableAlias - table alias name
     * @returns {Schema}  
     */
    setTableAlias(tableAlias) {
        const uniqueAliasSet = new Set();

        for (const alias of tableAlias) {
            if (alias !== '') {
                uniqueAliasSet.add(alias.toUpperCase());
            }
        }

        this.tableAlias = Array.from(uniqueAliasSet);

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
     * @param {String} aliasName
     * @returns {String[]} - list of all field names with table prefix.
     */
    getAllExtendedNotationFieldNames(aliasName) {
        /** @type {String[]} */
        const fieldNames = [];
        const tableName = aliasName === '' ? this.tableName : aliasName;

        // @ts-ignore
        for (const [key, value] of this.fields.entries()) {
            if (value !== null) {
                const fieldParts = key.split(".");
                if (fieldNames[value] === undefined ||
                    (fieldParts.length === 2 && (fieldParts[0] === tableName || this.isDerivedTable)))
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
        const fieldIndex = fieldNames.map(f => this.fields.has(f.trim().toUpperCase()) ? this.fields.get(f.trim().toUpperCase()) : -1)

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
                const virtualField = new VirtualField(columnName);
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
     * @property {String[]} columnNameVariants
     */

    /**
     * Find all valid variations for a column name.  This will include base column name,
     * the column name prefixed with full table name, and the column name prefixed with table alias.
     * @param {String} colName 
     * @returns {FieldVariants}
     */
    getColumnNameVariants(colName) {
        const columnName = colName.trim().toUpperCase().replace(/\s/g, "_");
        const columnNameVariants = [];

        if (!columnName.includes(".")) {
            columnNameVariants.push(`${this.tableName}.${columnName}`);

            for (const tableAlias of this.tableAlias) {
                columnNameVariants.push(`${tableAlias}.${columnName}`);
            }
        }

        return { columnName, columnNameVariants };
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
                for (const fld of fieldVariants.columnNameVariants) {
                    this.fields.set(fld, colNum);
                }
            }
        }
    }
}

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

        const tableInfo = this.dataJoin.isDerivedTable() ? this.dataJoin.derivedTable.tableInfo : this.primaryTableInfo;

        //  Expand any 'SELECT *' fields and add the actual field names into 'astFields'.
        astFields = VirtualFields.expandWildcardFields(tableInfo, astFields);

        //  Define the data source of each field in SELECT field list.
        this.tableFields.updateSelectFieldList(astFields, 0, false);

        //  These are fields REFERENCED, but not actually in the SELECT FIELDS.
        //  So columns referenced by GROUP BY, ORDER BY and not in SELECT.
        //  These temp columns need to be removed after processing.
        if (ast["GROUP BY"] !== undefined) {
            const referencedFields = this.getAggregateFunctionFieldsInGroupByCalculation(astFields);
            this.tableFields.updateSelectFieldList(referencedFields, this.tableFields.getNextSelectColumnNumber(), true);

            this.tableFields.updateSelectFieldList(ast["GROUP BY"], this.tableFields.getNextSelectColumnNumber(), true);
        }

        if (ast["ORDER BY"] !== undefined) {
            this.tableFields.updateSelectFieldList(ast["ORDER BY"], this.tableFields.getNextSelectColumnNumber(), true);
        }
    }

    /**
     * 
     * @param {Object[]} astFields 
     * @returns {Object[]}
     */
    getAggregateFunctionFieldsInGroupByCalculation(astFields) {
        const fields = [];
        const aggFuncList = ["SUM", "MIN", "MAX", "COUNT", "AVG", "DISTINCT", "GROUP_CONCAT"];

        //  When fld.terms is defined, it is a calculation, not just a single function.
        const aggregateFunctions = astFields.filter(f => f.terms !== undefined);
        for (const fld of aggregateFunctions) {
            const functionString = SelectTables.toUpperCaseExceptQuoted(fld.name, true);
            const usedFunctions = aggFuncList.map(func => SelectTables.parseForFunctions(functionString, func)).filter(f => f != null);

            for (const parsedFunctionList of usedFunctions) {
                this.tableFields.updateCalculatedFieldAsAggregateCalculation(fld.name);

                if (!this.tableFields.isFieldAlreadyInSelectList(parsedFunctionList)) {
                    fields.push({ name: parsedFunctionList[0], as: '', order: '' });
                }
            }
        }

        return fields;
    }

    /**
     * Process any JOIN condition.
     * @param {Object} ast - Abstract Syntax Tree
     * @returns {void}
     */
    join(ast) {
        if (ast.JOIN !== undefined) {
            this.dataJoin.load(ast);
        }
    }

    /**
     * Retrieve filtered record ID's.
     * @param {Object} ast - Abstract Syntax Tree
     * @returns {Number[]} - Records ID's that match WHERE condition.
     */
    whereCondition(ast) {
        // Default is entire table is selected.
        let conditions = { operator: "=", left: "\"A\"", right: "\"A\"" };
        if (ast.WHERE !== undefined) {
            conditions = ast.WHERE;
        }
        else if (ast["GROUP BY"] === undefined && ast.HAVING !== undefined) {
            //  This will work in mySql as long as select field is in having clause.
            conditions = ast.HAVING;
        }

        let sqlData = [];
        if (conditions.logic === undefined) {
            sqlData = this.resolveCondition("OR", [conditions]);
        }
        else {
            sqlData = this.resolveCondition(conditions.logic, conditions.terms);
        }

        return sqlData;
    }

    /**
    * Recursively resolve WHERE condition and then apply AND/OR logic to results.
    * @param {String} logic - logic condition (AND/OR) between terms
    * @param {Object} terms - terms of WHERE condition (value compared to value)
    * @returns {Number[]} - record ID's 
    */
    resolveCondition(logic, terms) {
        const recordIDs = terms.map(cond => cond.logic === undefined
            ? this.getRecordIDs(cond)
            : this.resolveCondition(cond.logic, cond.terms));

        return SelectTables.applyLogicOperatorToRecordIds(logic, recordIDs);
    }

    /**
     * Each array element in recordIDs is an array of record ID's.
     * Either 'AND' or 'OR' logic is applied to the ID's to find the final set of record ID's.
     * @param {String} logic  ["AND", "OR"]
     * @param {Number[][]} recordIDs 
     * @returns {Number[]}
     */
    static applyLogicOperatorToRecordIds(logic, recordIDs) {
        let results = [];

        if (logic === "AND") {
            results = recordIDs.reduce((a, b) => a.filter(c => b.includes(c)), recordIDs[0]);
        }
        else if (logic === "OR") {
            results = Array.from(new Set(recordIDs.reduce((a, b) => a.concat(b), recordIDs[0])));
        }

        return results;
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
        const conditionFunction = FieldComparisons.getComparisonFunction(condition.operator);

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

            if (conditionFunction(leftValue, rightValue))
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
        let fieldValue = fieldConditions.constantData;
        if (fieldConditions.columnNumber >= 0) {
            fieldValue = fieldConditions.fieldConditionTableInfo.tableData[masterRecordID][fieldConditions.columnNumber];
        }
        else if (fieldConditions.calculatedField !== "") {
            fieldValue = "NULL";
            if (fieldConditions.calculatedField.toUpperCase() !== "NULL") {
                fieldValue = calcSqlField.evaluateCalculatedField(fieldConditions.calculatedField, masterRecordID);
            }
        }
        else if (fieldConditions.subQuery !== null) {
            const arrayResult = fieldConditions.subQuery.select(masterRecordID, calcSqlField);
            if (arrayResult !== undefined && arrayResult !== null && arrayResult.length > 0) {
                fieldValue = arrayResult[0][0];
            }
        }

        return fieldValue;
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
        const selectedFields = this.tableFields.getSelectFields();

        for (const masterRecordID of recordIDs) {
            const newRow = [];

            for (const field of selectedFields) {
                if (field.tableInfo !== null)
                    newRow.push(field.getData(masterRecordID));
                else if (field.subQueryAst !== null) {
                    const result = subQuery.select(masterRecordID, calcSqlField, field.subQueryAst);
                    newRow.push(result[0][0]);
                }
                else if (field.calculatedFormula !== "") {
                    let result = null;
                    if (field.calculatedAggregateFunction === "") {
                        result = calcSqlField.evaluateCalculatedField(field.calculatedFormula, masterRecordID);
                    }
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
     * @param {Boolean} removeExtraSpaces - if true, will remove spaces EXCEPT within quotes.
     * @returns {String} - converted string.
     */
    static toUpperCaseExceptQuoted(srcString, removeExtraSpaces = false) {
        let finalString = "";
        let inQuotes = "";

        for (let i = 0; i < srcString.length; i++) {
            let ch = srcString.charAt(i);

            if (inQuotes === "") {
                if (ch === '"' || ch === "'") {
                    inQuotes = ch;
                }

                ch = removeExtraSpaces && ch === ' ' ? '' : ch.toUpperCase();
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
        const expMatch = String.raw`\b%1\b\s*\(`;

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
                    args.push(
                        searchStr.substring(0, i + 1),
                        searchStr.substring(startLeft + 1, i)
                    );
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
        if (ch === startBracket)
            return 1;
        else if (ch === endBracket)
            return -1;

        return 0;
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

        if (ast['GROUP BY'] !== undefined) {
            groupedTableData = this.groupByFields(ast['GROUP BY'], viewTableData);

            if (ast.HAVING !== undefined) {
                groupedTableData = this.having(ast.HAVING, groupedTableData);
            }
        }
        //  If any conglomerate field functions (SUM, COUNT,...)
        //  we summarize all records into ONE.
        else if (this.tableFields.getConglomerateFieldCount() > 0) {
            const compressedData = [];
            const conglomerate = new ConglomerateRecord(this.tableFields.getSelectFields());
            compressedData.push(conglomerate.squish(viewTableData));
            groupedTableData = compressedData;
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
        selectedData = this.orderDataByListOfFields(astGroupBy, selectedData);

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
     * @returns {any[][]}
     */
    orderBy(ast, selectedData) {
        if (ast['ORDER BY'] === undefined)
            return selectedData;

        return this.orderDataByListOfFields(ast['ORDER BY'].reverse(), selectedData);
    }

    /**
     * 
     * @param {any[]} orderedFieldList 
     * @param {any[][]} selectedData 
     * @returns {any[][]}
     */
    orderDataByListOfFields(orderedFieldList, selectedData) {
        for (const orderField of orderedFieldList) {
            const selectColumn = this.tableFields.getSelectFieldColumn(orderField.name);

            if (selectColumn === -1) {
                throw new Error(`Invalid FIELD: ${orderField.name}`);
            }

            if (orderField.order !== undefined && orderField.order.toUpperCase() === "DESC") {
                SelectTables.sortByColumnDESC(selectedData, selectColumn);
            }
            else {
                //  Default ordering is ASC.
                SelectTables.sortByColumnASC(selectedData, selectColumn);
            }
        }

        return selectedData;
    }

    /**
     * Removes temporary fields from return data.  These temporary fields were needed to generate
     * the final table data, but are not included in the SELECT fields for final output.
     * @param {any[][]} viewTableData - table data that may contain temporary columns.
     * @returns {any[][]} - table data with temporary columns removed.
     */
    removeTempColumns(viewTableData) {
        const tempColumns = this.tableFields.getSelectedTempColumnNumbers();

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
     * Returns the first 'x' records from table if a LIMIT is defined.
     * @param {Object} ast AST that may contain a LIMIT clause
     * @param {any[][]} viewTableData Table data before limit is applied.
     * @returns {any[][]} Table data after limit is applied.
     */
    static limit(ast, viewTableData) {
        if (ast.LIMIT !== undefined) {
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
        let constantData = null;
        let columnNumber = -1;
        let fieldConditionTableInfo = null;
        let calculatedField = "";
        let subQuery = null;

        if (fieldCondition.SELECT !== undefined) {
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

        if (constantData !== undefined) {
            return constantData;
        }

        if (fieldCondition === '?') {
            throw new Error("Bind variable naming is ?1, ?2... where ?1 is first bind data point in list.")
        }
        throw new Error(`Bind variable ${fieldCondition} was not found`);
    }

    /**
     * Check if correlated sub-query is used.
     * Check all table references in WHERE clause.  
     * Any table found NOT in FROM is deemed a reference to correlated subquery.
     * @param {Object} ast 
     * @returns {Boolean} - TRUE if a reference to a WHERE table field not in FROM.
     */
    static isCorrelatedSubQuery(ast) {
        const tableSet = new Map();
        TableExtract.extractAstTables(ast, tableSet);

        const tableSetCorrelated = new Map();
        if (ast.WHERE !== undefined) {
            TableExtract.getTableNamesWhereCondition(ast.WHERE, tableSetCorrelated);
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
            };

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
        const selectTables = TableExtract.getReferencedTableNamesFromAst(ast);

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
            return value.replaceAll('"', '');

        if (value.startsWith("'") && value.endsWith("'"))
            return value.replaceAll("'", '');

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
            const dateParts = value.split("/");     //  We assume MM/DD/YY (this could be improved)
            if (dateParts.length === 3) {
                year = Number(dateParts[2]);
                month = Number(dateParts[0]) - 1;
                dayNum = Number(dateParts[1]);
            }

            if (dateParts.length !== 3 || (year === 0 && month === 0 && dayNum === 0)) {
                return null;
            }
        }

        const newDate = new Date(Date.UTC(year, month, dayNum, 12, 0, 0, 0));
        return newDate.getTime();
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
 * Finds a function to be used for doing data comparisons.
 * The WHERE condition needs to execute the exact same data comparison for all records, so
 * there is no need to find (through the switch) what to execute for every record.
 */
class FieldComparisons {
    /**
     * Returns a function to be used for data comparisons.
     * @param {String} operator SQL comparison operator.
     * @returns {function}
     }}
     */
    static getComparisonFunction(operator) {
        switch (operator.toUpperCase()) {
            case "=":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return leftValue !== null && rightValue !== null && leftValue == rightValue };         // skipcq: JS-0050

            case ">":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return leftValue !== null && rightValue !== null && leftValue > rightValue };

            case "<":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return leftValue !== null && rightValue !== null && leftValue < rightValue };

            case ">=":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return leftValue !== null && rightValue !== null && leftValue >= rightValue };

            case "<=":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return leftValue !== null && rightValue !== null && leftValue <= rightValue };

            case "<>":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return leftValue !== null && rightValue !== null && leftValue != rightValue };         // skipcq: JS-0050

            case "!=":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return leftValue !== null && rightValue !== null && leftValue != rightValue };         // skipcq: JS-0050

            case "LIKE":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return FieldComparisons.likeCondition(leftValue, rightValue) };

            case "NOT LIKE":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return FieldComparisons.notLikeCondition(leftValue, rightValue) };

            case "IN":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return FieldComparisons.inCondition(leftValue, rightValue) };

            case "NOT IN":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return !(FieldComparisons.inCondition(leftValue, rightValue)) };

            case "IS NOT":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return !(FieldComparisons.isCondition(leftValue, rightValue)) };

            case "IS":
                return (leftValue, rightValue) => { [leftValue, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return FieldComparisons.isCondition(leftValue, rightValue) };

            case "EXISTS":
                return (leftValue, rightValue) => { [, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return FieldComparisons.existsCondition(rightValue) };

            case "NOT EXISTS":
                return (leftValue, rightValue) => { [, rightValue] = FieldComparisons.parmsToUpperCase(leftValue, rightValue); return !(FieldComparisons.existsCondition(rightValue)) };

            default:
                throw new Error(`Invalid Operator: ${operator}`);
        }
    }

    /**
     * 
     * @param {any} leftValue 
     * @param {any} rightValue 
     * @returns {[any,any]}
     */
    static parmsToUpperCase(leftValue, rightValue) {
        leftValue = typeof leftValue === 'string' ? leftValue.toUpperCase() : leftValue;
        rightValue = typeof rightValue === 'string' ? rightValue.toUpperCase() : rightValue;
        return [leftValue, rightValue];
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

        return FieldComparisons.likeConditionMatch(leftValue, rightValue) !== -1;
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

        return FieldComparisons.likeConditionMatch(leftValue, rightValue) === -1;
    }

    /**
     * Compare strings in (NOT) LIKE condition
     * @param {String} leftValue - string for comparison
     * @param {String} rightValue - string with wildcard
     * @returns {Number} - Found position (not found === -1)
     */
    static likeConditionMatch(leftValue, rightValue) {
        // @ts-ignore
        const expanded = `^${rightValue.replaceAll("%", ".*").replaceAll("_", ".")}`;

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
        for (const fld of this.masterFields) {
            this.mapMasterFields.set(fld.fieldName, fld)
        }
    }

    /**
     * Get data from the table for the requested field name and record number
     * @param {String} fldName - Name of field to get data for.
     * @param {Number} masterRecordID - The row number in table to extract data from.
     * @returns {any} - Data from table.  undefined if not found.
     */
    getData(fldName, masterRecordID) {
        const vField = this.mapMasterFields.get(fldName);
        if (vField === undefined)
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
                throw new Error(`Invalid CALCULATED field: ${calculatedFormula}`);
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
                varData = varData.replace(/\t/g, ' ')
                    .replace(/\n/g, ' ')
                    .replace(/\r/g, ' ');
                varData = `'${varData.replaceAll("'", String.raw`\'`)}'`;
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
            if ((this.primaryTable.tableName !== vField.tableInfo.tableName && !aliasName.includes("."))) {
                continue;
            }

            if (aliasName.includes(".")) {
                const parts = aliasName.split(".");
                if (!objectsDeclared.has(parts[0])) {
                    myVars += `let ${parts[0]} = {};`;
                    objectsDeclared.set(parts[0], true);
                }
                myVars += `${aliasName} = ${varData};`;
            }
            else if (!variablesDeclared.has(aliasName)) {
                myVars += `let ${aliasName} = ${varData};`;
                variablesDeclared.set(aliasName, true);
            }
        }

        return myVars;
    }

    /**
     * Anything 'calculated' in SQL statement is converted to equivalent Javascript code.
     * The input 'calculatedFormula' and resulting JS is placed in map so it does not need to be
     * recalculated over and over again.
     * @param {String} calculatedFormula - SQL statement calculation.
     * @returns {String} - Equivalent SQL calculation in Javascript.
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
        if (innerTableInfo === undefined)
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

        if (where === undefined)
            return;

        if (where.logic === undefined)
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
            if (cond.logic === undefined) {
                let result = calcSqlField.masterFields.find(item => item.fieldName === cond.left.toUpperCase());
                if (result !== undefined) {
                    cond.left = bindData.add(calcSqlField.getData(cond.left.toUpperCase(), masterRecordID));
                }
                result = calcSqlField.masterFields.find(item => item.fieldName === cond.right.toUpperCase());
                if (result !== undefined) {
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
                const allExpandedFields = masterTableInfo.getAllExtendedNotationFieldNames();
                const masterTableFields = allExpandedFields.map(virtualField => ({ name: virtualField }));

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
     * 
     * @param {String} leftAlias 
     * @param {String} joinAlias 
     * @returns {DerivedTable}
     */
    setJoinTableAlias(leftAlias = '', joinAlias = '') {
        this.leftTableAlias = leftAlias;
        this.rightTableAlias = joinAlias;
        return this;
    }

    /**
     * Create derived table from the two tables that are joined.
     * @returns {DerivedTable}
     */
    createTable() {
        const columnCount = this.rightField.tableInfo.getColumnCount();
        const emptyRightRow = new Array(columnCount).fill(null);
        const joinedData = [DerivedTable.getCombinedColumnTitles(this.leftField, this.rightField, this.leftTableAlias, this.rightTableAlias)];

        for (let i = 1; i < this.leftField.tableInfo.tableData.length; i++) {
            if (this.leftRecords[i] === undefined) {
                continue;
            }

            if (this.rightField.tableInfo.tableData[this.leftRecords[i][0]] === undefined) {
                joinedData.push(this.leftField.tableInfo.tableData[i].concat(emptyRightRow));
            }
            else {
                for (const rec of this.leftRecords[i]) {
                    joinedData.push(this.leftField.tableInfo.tableData[i].concat(this.rightField.tableInfo.tableData[rec]));
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
     * @param {String} leftTableAlias
     * @param {String} rightTableAlias
     * @returns {String[]}
     */
    static getCombinedColumnTitles(leftField, rightField, leftTableAlias, rightTableAlias) {
        const leftAlias = leftField.originalTable === rightField.originalTable ? leftTableAlias : '';
        const rightAlias = leftField.originalTable === rightField.originalTable ? rightTableAlias : '';
        const titleRow = leftField.tableInfo.getAllExtendedNotationFieldNames(leftAlias);
        const rightFieldNames = rightField.tableInfo.getAllExtendedNotationFieldNames(rightAlias);

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
            "DAY", "DATEDIFF", "FLOOR", "IF", "INSTR", "LAST_DAY", "LEFT", "LEN", "LENGTH", "LOCATE", "LOG", "LOG10", "LOWER",
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
                try {
                    // Split on COMMA, except within brackets.
                    const parms = args[1] === undefined ? [] : SelectTables.parseForParams(args[1]);
                    const replacement = this[func.toLocaleLowerCase()](parms, args, masterFields);
                    functionString = functionString.replace(args[0], replacement);
                    args = this.parseFunctionArgs(func, functionString);
                }
                catch (ex) {
                    throw new Error(`Internal Error. Function is missing. ${func}`);
                }
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
    instr(parms) {                                      //  skipcq: JS-0105
        return SqlServerFunctions.locate(parms.toReversed());
    }

    /**
     * @param {String[]} parms 
     * @returns {String}
     */
    last_day(parms) {                            //  skipcq: JS-0105
        return SqlServerFunctions.last_day(parms);
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
     * 
     * @param {String[]} parms 
     * @returns {String}
     */
    locate(parms) {                                     //  skipcq: JS-0105
        return SqlServerFunctions.locate(parms);
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
        return `(new Date(${parms[0]}).getMonth() + 1)`;
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

        if (parms[2] === undefined)
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

        const separatorString = parms[0];
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

        return concatFields.join(` + ${separatorString} + `)
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
        const funcString = `totalMs = (${parm1} + ${parm2})`;

        return SqlServerFunctions.inlineFuncDateInReturn(funcString, "totalMs");
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
     * 
     * @param {any[]} parms 
     * @returns{String}
     */
    static last_day(parms) {
        if (parms.length !== 1) {
            throw new Error("LAST_DAY expecting one parameter");
        }

        const today = `(new Date(${parms[0]}))`;
        const funcString = `lastDay = new Date(${today}.getFullYear(), ${today}.getMonth()+1, 0)`;

        return SqlServerFunctions.inlineFuncDateInReturn(funcString, "lastDay");
    }

    /**
     * 
     * @param {String} calcDate 
     * @param {String} dateVarName 
     * @returns {String}
     */
    static inlineFuncDateInReturn(calcDate, dateVarName) {
        const funcReturn = `(function() { 
            try {
                ${calcDate}        
                let result = new Date(${dateVarName});
                return (result instanceof Date && !isNaN(result.getTime())) ? result : null;
            }
            catch(ex) {
                return null;
            }
         })()`

        return funcReturn;
    }

    /**
     * 
     * @param {any[]} parms 
     * @returns {String}
     */
    static locate(parms) {
        if (parms.length < 2) {
            throw new Error("LOCATE expecting at least two parameters");
        }
        const startPos = parms.length > 2 ? `${parms[2].toString()} - 1` : "0";

        return `(${parms[1]}.toUpperCase().indexOf(${parms[0]}.toUpperCase(), ${startPos}) + 1)`;
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
        if (args.length < 3) {
            return "";
        }

        let replacement = "";
        if (args[1] === undefined && args[2] === undefined) {
            replacement = `else return ${args[3]};`;
        }
        else {
            if (this.firstCase) {
                replacement = "(() => {if (";
                this.firstCase = false;
            }
            else {
                replacement = "else if (";
            }
            replacement += `${SqlParse.sqlCondition2JsCondition(args[1])}) return ${args[2]} ;`;
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
        for (const field of this.selectVirtualFields) {
            if (field.aggregateFunction === "") {
                row.push(groupRecords[0][i]);
            }
            else {
                row.push(ConglomerateRecord.aggregateColumn(field, groupRecords, i));
            }

            i++;
        }

        //  After all aggregate functions are solved for, it is now time to solve a 
        //  calculated field with aggregate functions.
        this.calculateFunctionWithAggregates(row);

        return row;
    }

    /**
     * Updates the 'row' array with calculated field with aggregate functions.
     * @param {any[]} row 
     * @returns {void}
     */
    calculateFunctionWithAggregates(row) {
        if (this.selectVirtualFields.filter(x => x.calculatedAggregateFunction !== "").length === 0)
            return;

        const aggTable = ConglomerateRecord.createTempAggregateTable(row);
        const mappedField = ConglomerateRecord.createMapOfOldFieldToNewField(aggTable, this.selectVirtualFields);
        const calc = ConglomerateRecord.createCalculatedFieldObjectForTable(aggTable);

        let i = 0;
        for (const field of this.selectVirtualFields) {
            if (field.calculatedAggregateFunction !== "") {
                const ucFunction = SelectTables.toUpperCaseExceptQuoted(field.calculatedAggregateFunction, true);
                const updatedFunc = ConglomerateRecord.replaceFieldNames(ucFunction, mappedField);
                row[i] = calc.evaluateCalculatedField(updatedFunc, 1);
            }
            i++;
        }
    }

    /**
     * @param {any[]} row 
     * @returns {Table}
     */
    static createTempAggregateTable(row) {
        const tempColumnTitles = [];
        for (let i = 1; i <= row.length; i++) {
            tempColumnTitles.push(Table.numberToSheetColumnLetter(i));
        }

        const tempTableData = [tempColumnTitles, row];
        return new Table("temp")
            .setHasColumnTitle(true)
            .loadArrayData(tempTableData);
    }

    /**
     * @param {Table} aggTable 
     * @param {TableField[]} virtualFields 
     * @returns {Object[]}
     */
    static createMapOfOldFieldToNewField(aggTable, virtualFields) {
        const mappedField = [];

        const aggTableColumnNames = aggTable.tableData[0];
        for (let i = 0; i < aggTableColumnNames.length; i++) {
            const oldName = SelectTables.toUpperCaseExceptQuoted(virtualFields[i].columnName, true);
            const newName = aggTableColumnNames[i];
            mappedField.push({ oldName, newName });
        }

        return mappedField;
    }

    /**
     * @param {Table} aggTable 
     * @returns {CalculatedField}
     */
    static createCalculatedFieldObjectForTable(aggTable) {
        const tempTableFields = new TableFields();
        const tableInfo = new Map();
        tableInfo.set(aggTable.tableName, aggTable);
        tempTableFields.loadVirtualFields(aggTable.tableName, tableInfo);
        return new CalculatedField(aggTable, aggTable, tempTableFields);
    }

    /**
     * Returns an updated 'calcFunc' string, where fields are given different names.
     * @param {String} calcFunc 
     * @param {Object[]} mappedField 
     * @returns {String}
     */
    static replaceFieldNames(calcFunc, mappedField) {
        for (const item of mappedField) {
            calcFunc = calcFunc.replaceAll(item.oldName, item.newName);
        }

        return calcFunc;
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
            numericData = (Number.isNaN(numericData)) ? 0 : numericData;
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
     * @param {Number} numericData 
     * @returns {Number}
     */
    sum(numericData) {
        this.avgCounter++;
        this.groupValue += numericData;

        return this.groupValue;
    }

    /**
     * @returns {Number}
     */
    getAverage() {
        return this.groupValue / this.avgCounter;
    }

    /**
     * @param {any} columnData 
     * @returns {Number}
     */
    count(columnData) {
        if (columnData === null) {
            return this.groupValue;
        }

        this.groupValue++;
        if (this.isDistinct) {
            this.distinctSet.add(columnData);
            this.groupValue = this.distinctSet.size;
        }

        return this.groupValue;
    }

    /**
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
        let tableName = "";
        let tableObject = null;

        // @ts-ignore
        for ([tableName, tableObject] of tableInfo.entries()) {
            const tableFieldNames = tableObject.getAllFieldNames();

            for (const field of tableFieldNames) {
                const tableColumn = tableObject.getFieldColumn(field);

                let virtualField = this.findTableField(tableName, tableColumn);

                if (virtualField === null) {
                    virtualField = new TableField()
                        .setOriginalTable(tableName)
                        .setOriginalTableColumn(tableColumn)
                        .addAlias(field)
                        .setIsPrimaryTable(primaryTable.toUpperCase() === tableName.toUpperCase())
                        .setTableInfo(tableObject);

                    this.allFields.push(virtualField);
                }
                else {
                    virtualField.addAlias(field);
                }

                this.indexTableField(virtualField, primaryTable.toUpperCase() === tableName.toUpperCase());
            }
        }

        this.allFields.sort(TableFields.sortPrimaryFields);
    }

    /**
     * Set up mapping to quickly find field info - by all (alias) names, by table+column.
     * @param {TableField} field - field info.
     * @param {Boolean} isPrimaryTable - is this a field from the SELECT FROM TABLE.
     */
    indexTableField(field, isPrimaryTable = false) {
        for (const aliasField of field.aliasNames) {
            const fieldInfo = this.fieldNameMap.get(aliasField);

            if (fieldInfo === undefined || isPrimaryTable) {
                this.fieldNameMap.set(aliasField, field);
            }
        }

        //  This is something referenced in GROUP BY but is NOT in the SELECTED fields list.
        if (field.tempField && !this.fieldNameMap.has(field.columnName.toUpperCase())) {
            this.fieldNameMap.set(field.columnName.toUpperCase(), field);
        }

        if (field.originalTableColumn !== -1) {
            this.setTableField(field);
        }
    }

    /**
     * Sort function for table fields list.
     * @param {TableField} fldA 
     * @param {TableField} fldB 
     * @return {Number}
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
     * Quickly find field info for TABLE + COLUMN NUMBER (key of map)
     * @param {String} tableName - Table name to search for.
     * @param {Number} tableColumn - Column number to search for.
     * @returns {TableField} -located table info (null if not found).
     */
    findTableField(tableName, tableColumn) {
        const key = `${tableName}:${tableColumn}`;
        return this.tableColumnMap.has(key) ? this.tableColumnMap.get(key) : null;
    }

    /**
     * @param {TableField} field - field info.
     * @returns {TableFields}
     */
    setTableField(field) {
        const key = `${field.originalTable}:${field.originalTableColumn}`;
        if (!this.tableColumnMap.has(key)) {
            this.tableColumnMap.set(key, field);
        }

        return this;
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
        return fldInfo === undefined ? undefined : fldInfo.tableInfo;
    }

    /**
     * Get column number for field.
     * @param {String} field - field name
     * @returns {Number} - column number in table for field (-1 if not found)
     */
    getFieldColumn(field) {
        const fld = this.getFieldInfo(field);
        return fld == null ? -1 : fld.getTableColumn(field)
    }

    /**
     * Get field column number.
     * @param {String} field - field name
     * @returns {Number} - column number.
     */
    getSelectFieldColumn(field) {
        const fld = this.getFieldInfo(field);
        if (fld !== undefined && fld.selectColumn !== -1) {
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
            const columnTitle = (selField.as !== undefined && selField.as !== "" ? selField.as : selField.name);

            /** @type {SelectFieldParameters} */
            const selectedFieldParms = {
                selField, parsedField, columnTitle, nextColumnPosition, isTempField
            };

            if (parsedField.calculatedField === null && this.hasField(parsedField.columnName)) {
                this.updateColumnAsSelected(selectedFieldParms);
                nextColumnPosition = selectedFieldParms.nextColumnPosition;
            }
            else if (parsedField.calculatedField === null) {
                this.updateConstantAsSelected(selectedFieldParms);
                nextColumnPosition++;
            }
            else {
                this.updateCalculatedAsSelected(selectedFieldParms);
                nextColumnPosition++;
            }
        }
    }

    /**
     * @param {SelectFieldParameters} selectedFieldParms 
     * @returns {void}
     */
    updateColumnAsSelected(selectedFieldParms) {
        let fieldInfo = this.getFieldInfo(selectedFieldParms.parsedField.columnName);

        //  If GROUP BY field is in our SELECT field list - we can ignore.
        if (selectedFieldParms.isTempField && fieldInfo.selectColumn !== -1) {
            return;
        }

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
     * @param {SelectFieldParameters} selectedFieldParms 
     */
    updateCalculatedAsSelected(selectedFieldParms) {
        const fieldInfo = new TableField();
        this.allFields.push(fieldInfo);

        const columnName = selectedFieldParms.selField.as === "" ? selectedFieldParms.selField.name : selectedFieldParms.selField.as;

        fieldInfo
            .setColumnTitle(selectedFieldParms.columnTitle)
            .setColumnName(columnName)
            .setSelectColumn(selectedFieldParms.nextColumnPosition)
            .setCalculatedFormula(selectedFieldParms.selField.name)
            .setSubQueryAst(selectedFieldParms.selField.subQuery)
            .setIsTempField(selectedFieldParms.isTempField)
            .addAlias(selectedFieldParms.selField.as);

        this.indexTableField(fieldInfo);
    }

    /**
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
     * @param {String} fieldName 
     * @returns {void}
     */
    updateCalculatedFieldAsAggregateCalculation(fieldName) {
        for (const fld of this.allFields) {
            if (fld.calculatedFormula === fieldName) {
                fld.setCalculatedAggregateFunction(fieldName);
                break;
            }
        }
    }

    /**
     * @param {String[]} columnName
     * @returns {Boolean} 
     */
    isFieldAlreadyInSelectList(columnName) {
        const fldList = this.getSelectFields();

        return fldList.some(fldInfo => SelectTables.toUpperCaseExceptQuoted(fldInfo.columnName, true) === columnName[0]);
    }

    /**
     * Find next available column number in selected field list.
     * @returns {Number} - column number
     */
    getNextSelectColumnNumber() {
        let next = -1;
        for (const fld of this.getSelectFields()) {
            next = Math.max(fld.selectColumn, next);
        }

        return next === -1 ? next : ++next;
    }

    /**
     * Return a list of temporary column numbers in select field list.
     * @returns {Number[]} - sorted list of temp column numbers.
     */
    getSelectedTempColumnNumbers() {
        /** @type {Number[]} */
        const tempCols = this.getSelectFields().filter(fld => fld.tempField).map(fld => fld.selectColumn);
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
        for (const fld of this.getSelectFields()) {
            columnNames.push(fld.columnName);
        }

        return columnNames;
    }

    /**
     * Get column titles. If alias was set, that column would be the alias, otherwise it is column name.
     * @param {String} columnTableNameReplacement
     * @returns {String[]} - column titles
     */
    getColumnTitles(columnTableNameReplacement) {
        const columnTitles = [];
        for (const fld of this.getSelectFields().filter(selectField => !selectField.tempField)) {
            let columnOutput = fld.columnTitle;

            //  When subquery table data becomes data for the derived table name, references to
            //  original table names in column output needs to be changed to new derived table name.
            if (columnTableNameReplacement !== null) {
                const matchingTableIndex = columnOutput.toUpperCase().indexOf(`${fld.originalTable}.`);
                columnOutput = matchingTableIndex === 0 ? columnTableNameReplacement + columnOutput.slice(matchingTableIndex + fld.originalTable.length) : columnOutput;
            }
            columnTitles.push(columnOutput);
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
                originalField.setDerivedTableColumn(field.fieldName, fieldNo);
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
        const calculatedField = (selField.terms === undefined) ? null : selField.terms;

        if (calculatedField === null && !this.hasField(columnName)) {
            const functionNameRegex = /^\w+\s*(?=\()/;
            let matches = columnName.match(functionNameRegex)
            if (matches !== null && matches.length > 0) {
                aggregateFunctionName = matches[0].trim();
            }

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
        /** @property {Map<String, Number>} */
        this._derivedTableColumn = new Map();
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
        this.calculatedAggregateFunction = "";
    }

    /**
     * Get field column number.
     * @returns {Number} - column number
     */
    getTableColumn(fieldName = "") {
        return this.getDerivedTableColumn(fieldName) === -1 ? this.originalTableColumn : this.getDerivedTableColumn(fieldName);
    }

    /**
     * 
     * @param {String} fieldName 
     * @param {Number} columnNumber 
     * @returns {TableField}
     */
    setDerivedTableColumn(fieldName, columnNumber) {
        this._derivedTableColumn.set(fieldName, columnNumber);
        return this;
    }

    /**
     * 
     * @param {String} fieldName 
     * @returns {Number}
     */
    getDerivedTableColumn(fieldName) {
        if (this._derivedTableColumn.size === 1) {
            const mapIterator = this._derivedTableColumn.entries();
            const firstElement = mapIterator.next().value;

            return firstElement[1]; // [key,value] - we extract the value.
        }

        if (this._derivedTableColumn.has(fieldName.toUpperCase())) {
            return this._derivedTableColumn.get(fieldName.toUpperCase());
        }

        return -1;
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
        if (this.fieldName === "" || alias.includes(".")) {
            this.fieldName = alias;
        }

        if (!this.aliasNames.includes(alias)) {
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
     * @param {String} value 
     * @returns {TableField}
     */
    setCalculatedAggregateFunction(value) {
        this.calculatedAggregateFunction = value;
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
        const columnNumber = this.getDerivedTableColumn(this.columnName) === -1 ? this.originalTableColumn : this.getDerivedTableColumn(this.columnName);

        return this.tableInfo.tableData[tableRow][columnNumber];
    }

    /**
     * Search through list of fields and return a list of those that include the table name (e.g. TABLE.COLUMN vs COLUMN)
     * @param {TableField[]} masterFields 
     * @returns {String[]}
     */
    static getAllExtendedAliasNames(masterFields) {
        let concatFields = [];

        for (const vField of masterFields) {
            const fullNotationFields = vField.aliasNames.filter(aliasName => aliasName.includes("."));
            concatFields = concatFields.concat(fullNotationFields);
        }

        return concatFields;
    }
}

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

        for (const joinTable of ast.JOIN) {
            this.joinNextTable(joinTable, ast.FROM.table.toUpperCase(), ast.FROM.as);
        }
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

        if (conditions.cond.logic === undefined) {
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
            if (cond.logic === undefined) {
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
            const temp = recIds.map(rec => rec[i] === undefined ? [] : rec[i]);
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

            for (const rec of recIds) {
                temp = temp.concat(rec[i])
            };

            if (temp[0] !== undefined) {
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
        if (this.derivedTable === undefined) {
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

        const left = astJoin.cond === undefined ? astJoin.left : astJoin.cond.left;
        const right = astJoin.cond === undefined ? astJoin.right : astJoin.cond.right;
        const operator = astJoin.cond === undefined ? astJoin.operator : astJoin.cond.operator;

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
        if (this.rightTableName === leftFieldInfo.originalTable && !isSelfJoin) {
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

        if (foundTableField === undefined && calcField !== '') {
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
        const results = calcField.replaceAll(quotedConstantsRegEx, "");
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
        const validFieldInfo = fieldInfoList.filter(fld => fld !== undefined);

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
                //  "=" - special case. Most common case AND far fewer comparisons - especially if right table is large.
                rightRecordIDs = keyFieldMap.has(keyMasterJoinField) ? keyFieldMap.get(keyMasterJoinField) : [];
            }
            else {
                rightRecordIDs = JoinTablesRecordIds.getJoinRecordIdsForNonEqualCondition(keyMasterJoinField, keyFieldMap, conditionFunction);
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

    /**
     * 
     * @param {String} keyMasterJoinField 
     * @param {Map<String, Number[]>} keyFieldMap 
     * @param {Function} conditionFunction 
     * @returns {Number[]}
     */
    static getJoinRecordIdsForNonEqualCondition(keyMasterJoinField, keyFieldMap, conditionFunction) {
        const recordIDs = [];

        // @ts-ignore
        for (const [key, data] of keyFieldMap) {
            if (conditionFunction(keyMasterJoinField, key)) {
                recordIDs.unshift(...data);
            }
        }

        return recordIDs;
    }
}

//  Code inspired from:  https://github.com/dsferruzza/simpleSqlParser

/**
 * @classdesc 
 * Parse SQL SELECT statement and convert into Abstract Syntax Tree 
 */
class SqlParse {
    /**
     * @param {String} cond 
     * @returns {String}
     */
    static sqlCondition2JsCondition(cond) {
        const ast = SqlParse.sql2ast(`SELECT A FROM c WHERE ${cond}`);
        let sqlData = "";

        if (ast.WHERE !== undefined) {
            const conditions = ast.WHERE;
            if (conditions.logic === undefined) {
                sqlData = SqlParse.resolveSqlCondition("OR", [conditions]);
            }
            else {
                sqlData = SqlParse.resolveSqlCondition(conditions.logic, conditions.terms);
            }

        }

        return sqlData;
    }

    /**
     * Parse a query
     * @param {String} sqlStatement 
     * @returns {Object}
     */
    static sql2ast(sqlStatement) {
        const query = SqlParse.filterCommentsFromStatement(sqlStatement)

        // Define which words can act as separator
        const myKeyWords = SqlParse.generateUsedKeywordList(query);
        const [parts_name, parts_name_escaped] = SqlParse.generateSqlSeparatorWords(myKeyWords);

        // Hide words defined as separator but written inside brackets in the query
        const hiddenQuery = SqlParse.hideInnerSql(query, parts_name_escaped, SqlParse.protect);

        //  Include brackets around separate selects used in things like UNION, INTERSECT...
        let modifiedQuery = SqlUnionParse.sqlSetStatementSplitter(hiddenQuery);

        //  The SET statement splitter creates a bracketed sub-query, which we need to hide.
        if (modifiedQuery !== hiddenQuery) {
            modifiedQuery = SqlParse.hideInnerSql(modifiedQuery, parts_name_escaped, SqlParse.protect);
        }

        // Write the position(s) in query of these separators
        const parts_order = SqlParse.getPositionsOfSqlParts(modifiedQuery, parts_name);

        // Delete duplicates (caused, for example, by JOIN and INNER JOIN)
        SqlParse.removeDuplicateEntries(parts_order);

        // Generate protected word list to reverse the use of protect()
        let words = parts_name_escaped.slice(0);
        words = words.map(item => SqlParse.protect(item));

        // Split parts and Unhide words previously hidden with protect()
        const parts = modifiedQuery.split(new RegExp(parts_name_escaped.join('|'), 'i'))
            .map(part => SqlParse.hideInnerSql(part, words, SqlParse.unprotect));

        // Analyze parts
        const result = SqlParse.analyzeParts(parts_order, parts);

        if (result.FROM !== undefined && result.FROM.FROM !== undefined && result.FROM.FROM.as !== undefined) {
            if (result.FROM.FROM.as === '') {
                throw new Error("Every derived table must have its own alias");
            }

            //   Subquery FROM creates an ALIAS name, which is then used as FROM table name.
            result.FROM.table = result.FROM.FROM.as;
            result.FROM.isDerived = true;
        }

        return result;
    }

    /**
     * Remove comments from SQL statement.
     * @param {String} statement 
     * @returns {String}
     */
    static filterCommentsFromStatement(statement) {
        // Remove comments with lines starting with '--' and join lines together.
        // If comment is within a STRING on a newline, it will fail ...
        // We leave inline comments and multi-line /* */ comments for another day.
        const filteredStatement = statement.split('\n').filter(line => !line.trim().startsWith('--')).join(' ');

        return filteredStatement;
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
            if (cond.logic === undefined) {
                if (jsCondition !== "" && logic === "AND") {
                    jsCondition += " && ";
                }
                else if (jsCondition !== "" && logic === "OR") {
                    jsCondition += " || ";
                }

                jsCondition += ` ${cond.left}`;
                if (cond.operator === "=") {
                    jsCondition += " == ";
                }
                else {
                    jsCondition += ` ${cond.operator}`;
                }
                jsCondition += ` ${cond.right}`;
            }
            else {
                jsCondition += SqlParse.resolveSqlCondition(cond.logic, cond.terms);
            }
        }

        return jsCondition;
    }

    /**
     * Returns a list of all keywords used in their original CASE.
     * @param {String} query
     * @returns {String[]} 
     */
    static generateUsedKeywordList(query) {
        const generatedList = new Set();
        // Define which words can act as separator
        const keywords = ['SELECT', 'FROM', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'ORDER BY', 'GROUP BY', 'HAVING', 'WHERE', 'LIMIT', 'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT', 'PIVOT'];
        const modifiedQuery = query.toUpperCase();

        for (const word of keywords) {
            let pos = modifiedQuery.indexOf(word, 0);
            while (pos !== -1) {
                generatedList.add(query.substring(pos, pos + word.length));
                pos++;
                pos = modifiedQuery.indexOf(word, pos);
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
        let parts_name = keywords.map(item => `${item} `);
        parts_name = parts_name.concat(keywords.map(item => `${item}(`));
        const parts_name_escaped = parts_name.map(item => item.replace('(', String.raw`[\(]`));

        return [parts_name, parts_name_escaped];
    }

    /**
     * 
     * @param {String} str 
     * @param {String[]} parts_name_escaped
     * @param {Object} replaceFunction
     */
    static hideInnerSql(str, parts_name_escaped, replaceFunction) {
        if (!str.includes("(") && !str.includes(")")) {
            return str;
        }

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

        for (const item of parts_name) {
            let pos = 0;
            let part = 0;

            do {
                part = modifiedQuery.indexOf(item, pos);
                if (part !== -1) {
                    const realName = item.replace(/^((\w|\s)+?)\s?\(?$/i, SqlParse.realNameCallback);

                    if (parts_order[part] === undefined || parts_order[part].length < realName.length) {
                        parts_order[part] = realName;	// Position won't be exact because the use of protect()  (above) and unprotect() alter the query string ; but we just need the order :)
                    }

                    pos = part + realName.length;
                }
            }
            while (part !== -1);
        };

        return parts_order;
    }

    /**
     * 
     * @param {String} _match 
     * @param {String} name 
     * @returns {String}
     */
    static realNameCallback(_match, name) {
        return name;
    }

    /**
     * Delete duplicates (caused, for example, by JOIN and INNER JOIN)
     * @param {String[]} partsOrder
     */
    static removeDuplicateEntries(partsOrder) {
        let busyUntil = 0;

        partsOrder.forEach((item, key) => {
            if (busyUntil > key) {
                delete partsOrder[key];
            }
            else {
                busyUntil = key + item.length;

                // Replace JOIN by INNER JOIN
                if (item.toUpperCase() === 'JOIN') {
                    partsOrder[key] = 'INNER JOIN';
                }
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
     * @param {String[]} partsOrder 
     * @param {String[]} parts 
     * @returns {Object}
     */
    static analyzeParts(partsOrder, parts) {
        const result = {};
        let j = 0;
        partsOrder.forEach(item => {
            const itemName = item.toUpperCase();
            j++;
            const selectComponentAst = SelectKeywordAnalysis.analyze(item, parts[j]);

            if (result[itemName] === undefined) {
                result[itemName] = selectComponentAst;
            }
            else {
                if (typeof result[itemName] === 'string' || result[itemName][0] === undefined) {
                    const tmp = result[itemName];
                    result[itemName] = [];
                    result[itemName].push(tmp);
                }

                result[itemName].push(selectComponentAst);
            }

        });

        // Reorganize joins
        SqlParse.reorganizeJoins(result);

        if (result.JOIN !== undefined) {
            for (const [key, item] of result.JOIN.entries()) {
                result.JOIN[key].cond = CondParser.parse(item.cond);
            }
        }

        SqlUnionParse.reorganizeUnions(result);

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
        if (result[joinName] !== undefined) {
            if (result.JOIN === undefined) {
                result.JOIN = [];
            }

            if (result[joinName][0] === undefined) {
                result[joinName].type = joinType;
                result.JOIN.push(result[joinName]);
            }
            else {
                for (const item of result[joinName]) {
                    item.type = joinType;
                    result.JOIN.push(item);
                }
            }

            delete result[joinName];
        }
    }
}

/**
 * @classdesc Parsing SQL set commands into AST.
 */
class SqlUnionParse {
    /**
     * 
     * @param {String} src 
     * @returns {String}
     */
    static sqlSetStatementSplitter(src) {
        let newStr = src;

        // Define which words can act as separator
        const reg = SqlUnionParse.makeSqlPartsSplitterRegEx(["UNION ALL", "UNION", "INTERSECT", "EXCEPT"]);

        const matchedUnions = reg.exec(newStr);
        if (matchedUnions === null || matchedUnions.length === 0) {
            return newStr;
        }

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
        let parts_name = keywords.map(item => `${item} `);
        parts_name = parts_name.concat(keywords.map(item => `${item}(`));
        parts_name = parts_name.concat(parts_name.map(item => item.toLowerCase()));
        const parts_name_escaped = parts_name.map(item => item.replace('(', String.raw`[\(]`));

        return new RegExp(parts_name_escaped.join('|'), 'gi');
    }

    /**
     * 
     * @param {Object} result 
     */
    static reorganizeUnions(result) {
        const astRecursiveTableBlocks = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];

        for (const union of astRecursiveTableBlocks) {
            if (typeof result[union] === 'string') {
                result[union] = [SqlParse.sql2ast(SqlUnionParse.parseUnion(result[union]))];
            }
            else if (result[union] !== undefined) {
                for (let i = 0; i < result[union].length; i++) {
                    result[union][i] = SqlParse.sql2ast(SqlUnionParse.parseUnion(result[union][i]));
                }
            }
        }
    }

    /**
     * 
     * @param {String} inStr 
     * @returns {String}
     */
    static parseUnion(inStr) {
        let unionString = inStr;
        if (unionString.startsWith("(") && unionString.endsWith(")")) {
            unionString = unionString.substring(1, unionString.length - 1);
        }

        return unionString;
    }
}

/**
 * @classdesc Lexical analyzer for SELECT statement.
 */
class CondLexer {
    constructor(source) {
        this.source = source;
        this.cursor = 0;
        this.currentChar = "";
        this.startQuote = "";
        this.bracketCount = 0;

        this.readNextChar();
    }

    // Read the next character (or return an empty string if cursor is at the end of the source)
    readNextChar() {
        if (typeof this.source === 'string') {
            this.currentChar = this.source[this.cursor++] ?? "";
        }
        else {
            this.currentChar = "";
        }
    }

    /**
     * Determine the next token
     * @returns {Object}
     */
    readNextToken() {
        if (/\w/.test(this.currentChar))
            return this.readWord();
        if (/["'`]/.test(this.currentChar))
            return this.readString();
        if (/[()]/.test(this.currentChar))
            return this.readGroupSymbol();
        if (/[!=<>]/.test(this.currentChar))
            return this.readOperator();
        if (/[+\-*/%]/.test(this.currentChar))
            return this.readMathOperator();
        if (this.currentChar === '?')
            return this.readBindVariable();

        if (this.currentChar === "") {
            return { type: 'eot', value: '' };
        }

        this.readNextChar();
        return { type: 'empty', value: '' };
    }

    /**
     * 
     * @returns {Object}
     */
    readWord() {
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

        if (/^(IN|IS|NOT|LIKE|EXISTS|EXISTS|BETWEEN)$/i.test(tokenValue)) {
            return { type: 'operator', value: tokenValue.toUpperCase() };
        }

        return { type: 'word', value: tokenValue };
    }

    /**
     * 
     * @param {Boolean} insideQuotedString 
     * @returns {Boolean}
     */
    isStartOrEndOfString(insideQuotedString) {
        if (!insideQuotedString && /['"`]/.test(this.currentChar)) {
            this.startQuote = this.currentChar;

            return true;
        }
        else if (insideQuotedString && this.currentChar === this.startQuote) {
            //  End of quoted string.
            return false;
        }

        return insideQuotedString;
    }

    /**
     * 
     * @param {Boolean} insideQuotedString 
     * @returns {Boolean}
     */
    isFinishedWord(insideQuotedString) {
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
    }

    /**
     * 
     * @returns {Object}
     */
    readString() {
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
    }

    /**
     * 
     * @returns {Object}
     */
    readGroupSymbol() {
        const tokenValue = this.currentChar;
        this.readNextChar();

        return { type: 'group', value: tokenValue };
    }

    /**
     * 
     * @returns {Object}
     */
    readOperator() {
        let tokenValue = this.currentChar;
        this.readNextChar();

        if (/[=<>]/.test(this.currentChar)) {
            tokenValue += this.currentChar;
            this.readNextChar();
        }

        return { type: 'operator', value: tokenValue };
    }

    /**
     * 
     * @returns {Object}
     */
    readMathOperator() {
        const tokenValue = this.currentChar;
        this.readNextChar();

        return { type: 'mathoperator', value: tokenValue };
    }

    /**
     * 
     * @returns {Object}
     */
    readBindVariable() {
        let tokenValue = this.currentChar;
        this.readNextChar();

        while (/\d/.test(this.currentChar)) {
            tokenValue += this.currentChar;
            this.readNextChar();
        }

        return { type: 'bindVariable', value: tokenValue };
    }
}

/**
 * @classdesc SQL Condition parser class
 */
class CondParser {
    constructor(source) {
        this.lexer = new CondLexer(source);
        this.currentToken = {};

        this.readNextToken();
    }

    /**
     * Parse a string
     * @param {String} source 
     * @returns {Object}
     */
    static parse(source) {
        return new CondParser(source).parseExpressionsRecursively();
    }

    /**
     * Read the next token (skip empty tokens)
     * @returns {Object}
     */
    readNextToken() {
        this.currentToken = this.lexer.readNextToken();
        while (this.currentToken.type === 'empty')
            this.currentToken = this.lexer.readNextToken();
        return this.currentToken;
    }

    /**
     * Wrapper function ; parse the source
     * @returns {Object}
     */
    parseExpressionsRecursively() {
        return this.parseLogicalExpression();
    }

    /**
     * Parse logical expressions (AND/OR)
     * @returns {Object}
     */
    parseLogicalExpression() {
        let leftNode = this.parseConditionExpression();

        while (this.currentToken.type === 'logic') {
            const logic = this.currentToken.value;
            this.readNextToken();

            const rightNode = this.parseConditionExpression();

            // If we are chaining the same logical operator, add nodes to existing object instead of creating another one
            if (leftNode.logic !== undefined && leftNode.logic === logic && leftNode.terms !== undefined) {
                leftNode.terms.push(rightNode);
            }
            else if (leftNode.operator === "BETWEEN" || leftNode.operator === "NOT BETWEEN") {
                leftNode = CondParser.createWhereBetweenAstLogic(leftNode, rightNode);
            }
            else {
                const terms = [leftNode, rightNode].slice(0);
                leftNode = { logic, terms };
            }
        }

        return leftNode;
    }

    /**
     * Parse conditions ([word/string] [operator] [word/string])
     * @returns {Object}
     */
    parseConditionExpression() {
        let left = this.parseBaseExpression();

        if (this.currentToken.type !== 'operator') {
            return left;
        }

        let operator = this.currentToken.value;
        this.readNextToken();

        // If there are 2 adjacent operators, join them with a space (exemple: IS NOT)
        if (this.currentToken.type === 'operator') {
            operator += ` ${this.currentToken.value}`;
            this.readNextToken();
        }

        let right = null;
        if (this.currentToken.type === 'group' && (operator === 'EXISTS' || operator === 'NOT EXISTS')) {
            [left, right] = this.parseSelectExistsSubQuery();
        } else {
            right = this.parseBaseExpression(operator);
        }

        return { operator, left, right };
    }

    /**
     * Modify AST for BETWEEN logic.  Create two comparisons connected with AND/OR 
     * (AND - BETWEEN, OR - NOT BETWEEN)
     * @param {Object} leftNode - contains field to compare AND the low value.
     * @param {Object} rightNode - contains high value. 
     * @returns {Object} - AST with logic and terms for comparison.
     */
    static createWhereBetweenAstLogic(leftNode, rightNode) {
        const firstOp = leftNode.operator === "BETWEEN" ? ">=" : "<";
        const secondOp = leftNode.operator === "BETWEEN" ? "<=" : ">";
        const logic = leftNode.operator === "BETWEEN" ? "AND" : "OR";

        const terms = [];
        terms.push({ left: leftNode.left, right: leftNode.right, operator: firstOp },
            { left: leftNode.left, right: rightNode, operator: secondOp });

        return { logic, terms };
    }

    /**
     * 
     * @returns {Object[]}
     */
    parseSelectExistsSubQuery() {
        let rightNode = null;
        const leftNode = '""';

        this.readNextToken();
        if (this.currentToken.type === 'word' && this.currentToken.value === 'SELECT') {
            rightNode = this.parseSelectIn("", true);
            if (this.currentToken.type === 'group') {
                this.readNextToken();
            }
        }

        return [leftNode, rightNode];
    }

    // Parse base items
    /**
     * 
     * @param {String} operator 
     * @returns {Object}
     */
    parseBaseExpression(operator = "") {
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
    }

    /**
     * 
     * @returns {Object}
     */
    parseWordExpression() {
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
    }

    /**
     * 
     * @param {String} operator 
     * @returns {Object}
     */
    parseGroupExpression(operator) {
        this.readNextToken();
        let astNode = this.parseExpressionsRecursively();

        const isSelectStatement = typeof astNode === "string" && astNode.toUpperCase() === 'SELECT';

        if (operator === 'IN' || operator === 'NOT IN' || isSelectStatement) {
            astNode = this.parseSelectIn(astNode, isSelectStatement);
        }

        this.readNextToken();

        return astNode;
    }

    /**
     * 
     * @param {any} startAstNode 
     * @param {Boolean} isSelectStatement 
     * @returns {Object}
     */
    parseSelectIn(startAstNode, isSelectStatement) {
        let astNode = startAstNode;
        let inCurrentToken = this.currentToken;
        let bracketCount = 1;

        //  If only one item in list, we hit the end bracket immediately.
        bracketCount += CondParser.groupBracketIncrementer(inCurrentToken);

        while (bracketCount !== 0 && inCurrentToken.type !== 'eot') {
            this.readNextToken();
            if (isSelectStatement) {
                astNode += ` ${inCurrentToken.value}`;
            }
            else {
                astNode += `,${inCurrentToken.value}`;
            }

            inCurrentToken = this.currentToken;
            bracketCount += CondParser.groupBracketIncrementer(inCurrentToken);
        }

        if (isSelectStatement) {
            astNode = SqlParse.sql2ast(astNode);
        }

        return astNode;
    }

    /**
     * 
     * @param {Object} inCurrentToken 
     * @returns {Number}
     */
    static groupBracketIncrementer(inCurrentToken) {
        let diff = 0;
        if (inCurrentToken.type === 'group') {
            if (inCurrentToken.value === '(') {
                diff = 1;
            }
            else if (inCurrentToken.value === ')') {
                diff = -1;
            }
        }

        return diff
    }
}

/**
 * @classdesc Analyze each distinct component of SELECT statement.
 */
class SelectKeywordAnalysis {
    /**
     * 
     * @param {String} itemName 
     * @param {Object} part 
     * @returns {any}
     */
    static analyze(itemName, part) {
        const keyWord = itemName.toUpperCase().replaceAll(' ', '_');

        if (SelectKeywordAnalysis[keyWord] === undefined) {
            throw new Error(`Can't analyze statement ${itemName}`);
        }

        return SelectKeywordAnalysis[keyWord](part);
    }

    /**
     * Sql SELECT
     * @param {String} str 
     * @param {Boolean} isOrderBy 
     * @returns {Object[]}
     */
    static SELECT(str, isOrderBy = false) {
        const selectParts = SelectKeywordAnalysis.protect_split(',', str);
        const selectResult = selectParts.filter(item => item !== '')
            .map(item => SelectKeywordAnalysis.extractSelectField(item, isOrderBy));

        if (selectResult.length === 0) {
            throw new Error("No fields SELECTED.");
        }

        return selectResult;
    }

    /**
     * 
     * @param {String} item 
     * @param {Boolean} isOrderBy 
     * @returns {Object}
     */
    static extractSelectField(item, isOrderBy) {
        let order = "";
        if (isOrderBy) {
            const order_by = /^(.+?)(\s+ASC|DESC)?$/gi;
            const orderData = order_by.exec(item);
            if (orderData !== null) {
                order = orderData[2] === undefined ? "ASC" : SelectKeywordAnalysis.trim(orderData[2]);
                item = orderData[1].trim();
            }
        }

        //  Is there a column alias?
        const [name, as] = SelectKeywordAnalysis.getNameAndAlias(item);

        const splitPattern = /[\s()*/%+-]+/g;
        let terms = name.split(splitPattern);

        if (terms !== null) {
            const aggFunc = ["SUM", "MIN", "MAX", "COUNT", "AVG", "DISTINCT", "GROUP_CONCAT"];
            terms = (aggFunc.includes(terms[0].toUpperCase())) ? null : terms;
        }
        if (name !== "*" && terms !== null && terms.length > 1) {
            const subQuery = SelectKeywordAnalysis.parseForCorrelatedSubQuery(item);
            return { name, terms, as, subQuery, order };
        }

        return { name, as, order };
    }

    /**
     * Sql FROM
     * @param {String} str 
     * @returns {Object}
     */
    static FROM(str) {
        const subqueryAst = this.parseForCorrelatedSubQuery(str);
        if (subqueryAst !== null) {
            //  If there is a subquery creating a DERIVED table, it must have a derived table name.
            //  Extract this subquery AS tableName.
            const [, alias] = SelectKeywordAnalysis.getNameAndAlias(str);
            if (alias !== "" && subqueryAst.FROM !== undefined) {
                subqueryAst.FROM.as = alias.toUpperCase();
            }

            return subqueryAst;
        }

        let fromParts = str.split(',');
        fromParts = fromParts.map(item => SelectKeywordAnalysis.trim(item));

        const fromResult = fromParts.map(item => {
            const [table, as] = SelectKeywordAnalysis.getNameAndAlias(item);
            return { table, as };
        });

        return fromResult[0];
    }

    /**
     * Sql LEFT JOIN
     * @param {String} str 
     * @returns {Object}
     */
    static LEFT_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    /**
     * Sql INNER JOIN
     * @param {String} str 
     * @returns {Object}
     */
    static INNER_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    /**
     * Sql RIGHT JOIN
     * @param {String} str 
     * @returns {Object}
     */
    static RIGHT_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    /**
     * Sql FULL JOIN
     * @param {String} str 
     * @returns {Object}
     */
    static FULL_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object}
     */
    static allJoins(str) {
        const subqueryAst = this.parseForCorrelatedSubQuery(str);

        const strParts = str.toUpperCase().split(' ON ');
        const table = strParts[0].split(' AS ');
        const joinResult = {};
        joinResult.table = subqueryAst === null ? SelectKeywordAnalysis.trim(table[0]) : subqueryAst;
        joinResult.as = SelectKeywordAnalysis.trim(table[1]) ?? '';
        joinResult.cond = SelectKeywordAnalysis.trim(strParts[1]);

        return joinResult;
    }

    /**
     * Sql WHERE
     * @param {String} str 
     * @returns {Object}
     */
    static WHERE(str) {
        return CondParser.parse(str);
    }

    /**
     * Sql ORDER BY
     * @param {String} str 
     * @returns {Object[]}
     */
    static ORDER_BY(str) {
        return SelectKeywordAnalysis.SELECT(str, true);
    }

    /**
     * Sql GROUP BY
     * @param {String} str 
     * @returns {Object[]}
     */
    static GROUP_BY(str) {
        return SelectKeywordAnalysis.SELECT(str);
    }

    /**
     * Sql PIVOT
     * @param {String} str 
     * @returns {Object[]}
     */
    static PIVOT(str) {
        const strParts = str.split(',');
        const pivotResult = [];

        for (const item of strParts) {
            const pivotOn = /([\w.]+)/gi;
            const pivotData = pivotOn.exec(item);
            if (pivotData !== null) {
                const tmp = {};
                tmp.name = SelectKeywordAnalysis.trim(pivotData[1]);
                tmp.as = "";
                pivotResult.push(tmp);
            }
        };

        return pivotResult;
    }

    /**
     * Sql LIMIT
     * @param {String} str 
     * @returns {Object}
     */
    static LIMIT(str) {
        const limitResult = {};
        limitResult.nb = Number(str);
        limitResult.from = 0;
        return limitResult;
    }

    /**
     * Sql HAVING
     * @param {String} str 
     * @returns {Object}
     */
    static HAVING(str) {
        return CondParser.parse(str);
    }

    /**
     * Sql UNION
     * @param {String} str 
     * @returns {String}
     */
    static UNION(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    /**
     * Sql UNION ALL
     * @param {String} str 
     * @returns {String}
     */
    static UNION_ALL(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    /**
     * Sql INTERSECT
     * @param {String} str 
     * @returns {String}
     */
    static INTERSECT(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    /**
     * Sql EXCEPT
     * @param {String} str 
     * @returns {String}
     */
    static EXCEPT(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    /**
     * If we find 'SELECT ' within brackets, parse the string within brackets as a correlated sub-query. 
     * @param {String} selectField 
     * @returns {Object}
     */
    static parseForCorrelatedSubQuery(selectField) {
        let subQueryAst = null;

        const regExp = /\(\s*(SELECT[\s\S]+)\)/i;
        const matches = regExp.exec(selectField);

        if (matches !== null && matches.length > 1) {
            subQueryAst = SqlParse.sql2ast(matches[1]);
        }

        return subQueryAst;
    }

    /**
     * Split a string using a separator, only if this separator isn't beetween brackets
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
        strParts = strParts.map(item => SelectKeywordAnalysis.trim(item.replaceAll(sep, separator)));

        return strParts;
    }

    /**
     * Trim input if input is a string.
     * @param {any} data trim() if a string.
     * @returns {any} Trimmed input OR original data if not a string.
     */
    static trim(data) {
        return typeof data === 'string' ? data.trim() : data;
    }

    /**
    * If an ALIAS is specified after 'AS', return the field/table name and the alias.
    * @param {String} item 
    * @returns {String[]} Two items:  Real Name, Alias
    */
    static getNameAndAlias(item) {
        const NAME_AS_ALIAS = " AS ";
        let realName = item;
        let alias = "";
        const lastAsIndex = SelectKeywordAnalysis.lastIndexOfOutsideLiteral(item.toUpperCase(), NAME_AS_ALIAS);
        if (lastAsIndex !== -1) {
            const subStr = item.substring(lastAsIndex + NAME_AS_ALIAS.length).trim();
            if (subStr.length > 0) {
                alias = subStr;
                //  Remove quotes, if any.
                if ((subStr.startsWith("'") && subStr.endsWith("'")) ||
                    (subStr.startsWith('"') && subStr.endsWith('"')) ||
                    (subStr.startsWith('[') && subStr.endsWith(']'))) {
                    alias = subStr.substring(1, subStr.length - 1);
                }

                //  Remove everything after 'AS'.
                realName = item.substring(0, lastAsIndex).trim();
            }
        }

        return [realName, alias];
    }

    /**
     * Search for last occurence of a string that is NOT inside a quoted string literal.
     * @param {String} srcString String to search
     * @param {String} searchString String to find outside of a string constant.
     * @returns {Number} -1 indicates search string not found.  Otherwise it is start position of found string.
     */
    static lastIndexOfOutsideLiteral(srcString, searchString) {
        let index = srcString.indexOf(searchString);
        if (index === -1) {
            return index;
        }

        let inQuote = "";
        for (let i = 0; i < srcString.length; i++) {
            const ch = srcString.charAt(i);

            if (inQuote !== "") {
                //  Is this the end of string literal?
                if ((inQuote === "'" && ch === "'") || (inQuote === '"' && ch === '"') || (inQuote === "[" && ch === "]"))
                    inQuote = "";
            }
            else if ("\"'[".includes(ch)) {
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

/** 
 * Interface for loading table data either from CACHE or SHEET. 
 * @class
 * @classdesc
 * * Automatically load table data from a **CACHE** or **SHEET** <br>
 * * In all cases, if the cache has expired, the data is read from the sheet. 
 * <br>
 * 
 * | Cache Seconds | Description |
 * | ---           | ---         |
 * | 0             | Data is not cached and always read directly from SHEET |
 * | <= 21600      | Data read from SHEETS cache if it has not expired |
 * | > 21600       | Data read from Google Sheets Script Settings |
 * 
 */
class TableData {       //  skipcq: JS-0128
    /**
    * Retrieve table data from SHEET or CACHE.
    * @param {String} namedRange - Location of table data.  Either a) SHEET Name, b) Named Range, c) A1 sheet notation.
    * @param {Number} cacheSeconds - 0s Reads directly from sheet. > 21600s Sets in SCRIPT settings, else CacheService 
    * @returns {any[][]}
    */
    static loadTableData(namedRange, cacheSeconds = 0) {
        if (namedRange === undefined || namedRange === "")
            return [];

        Logger.log(`loadTableData: ${namedRange}. Seconds=${cacheSeconds}`);

        return  Table.removeEmptyRecordsAtEndOfTable(TableData.getValuesCached(namedRange, cacheSeconds));
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
            if (TableData.isTimeToRunLongCacheExpiry()) {
                ScriptSettings.expire(false);
                TableData.setLongCacheExpiry();
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
     * Is it time to run the long term cache expiry check?
     * @returns {Boolean}
     */
    static isTimeToRunLongCacheExpiry() {
        const shortCache = CacheService.getScriptCache();
        return shortCache.get("LONG_CACHE_EXPIRY") === null;
    }

    /**
     * The long term expiry check is done every 21,000 seconds.  Set the clock now!
     */
    static setLongCacheExpiry() {
        const shortCache = CacheService.getScriptCache();
        shortCache.put("LONG_CACHE_EXPIRY", 'true', 21000);
    }

    /**
     * In the interest of testing, force the expiry check.
     * It does not mean items in cache will be removed - just 
     * forces a check.
     */
    static forceLongCacheExpiryCheck() {
        const shortCache = CacheService.getScriptCache();
        if (shortCache.get("LONG_CACHE_EXPIRY") !== null) {
            shortCache.remove("LONG_CACHE_EXPIRY");
        }
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
            cache.put(namedRange, JSON.stringify(singleData), seconds);
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
        const start = Date.now();
        let current = Date.now();

        Logger.log(`waitForRangeToLoad() - Start: ${namedRange}`);
        while (TableData.isRangeLoading(cache, namedRange) && (current - start) < 10000) {
            Utilities.sleep(250);
            current = Date.now();
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
            lock.waitLock(100000); // wait 100 seconds for others' use of the code section and lock to stop and then proceed
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

        Logger.log(`Just LOADED from SHEET: Item Count=${arrData.length}`);

        TableData.cachePutArray(cache, namedRange, cacheSeconds, arrData);

        return arrData;
    }

    /**
     * Read sheet data into double array.
     * @param {String} namedRange - named range, A1 notation or sheet name
     * @returns {any[][]} - table data.
     */
    static loadValuesFromRangeOrSheet(namedRange) {
        let tableNamedRange = namedRange;
        let output = [];

        try {
            Logger.log(`Getting Range of Values: ${tableNamedRange}`);
            const sheetNamedRange = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(tableNamedRange);

            if (sheetNamedRange === null) {
                //  This may be a SHEET NAME, so try getting SHEET RANGE.
                if (tableNamedRange.startsWith("'") && tableNamedRange.endsWith("'")) {
                    tableNamedRange = tableNamedRange.substring(1, tableNamedRange.length - 1);
                }
                let sheetHandle = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tableNamedRange);

                //  Actual sheet may have spaces in name.  The SQL must reference that table with
                //  underscores replacing those spaces.
                if (sheetHandle === null && tableNamedRange.includes("_")) {
                    tableNamedRange = tableNamedRange.replaceAll('_', " ");
                    sheetHandle = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tableNamedRange);
                }

                if (sheetHandle === null) {
                    throw new Error(`Invalid table range specified:  ${tableNamedRange}`);
                }

                const lastColumn = sheetHandle.getLastColumn();
                const lastRow = sheetHandle.getLastRow();
                output = sheetHandle.getSheetValues(1, 1, lastRow, lastColumn);
            }
            else {
                // @ts-ignore
                output = sheetNamedRange.getValues();
                Logger.log(`Named Range Data Loaded: ${tableNamedRange}. Items=${output.length}`);
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
        splitCount = Math.max(splitCount, 1);
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
            lock.waitLock(100000); // wait 100 seconds for others' use of the code section and lock to stop and then proceed
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
            const blocks = Number(blockStr);
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
     * Dates retrieved from a JSON structure need to be converted to JS date.
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



/** @classdesc 
 * Stores settings for the SCRIPT.  Long term cache storage for small tables.  */
class ScriptSettings {      //  skipcq: JS-0128
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

        if (PropertyData.isExpired(myPropertyData))
        {
            this.delete(propertyKey);
            return null;
        }

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
        catch (ex) {
            throw new Error("Cache Limit Exceeded.  Long cache times have limited storage available.  Only cache small tables for long periods.");
        }
    }

    /**
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
     * Puts list of data into cache using one API call.  Data is converted to JSON before it is updated.
     * @param {String[]} cacheKeys 
     * @param {any[]} newCacheData 
     * @param {Number} daysToHold
     */
    static putAllKeysWithData(cacheKeys, newCacheData, daysToHold = 7) {
        const bulkData = {};

        for (let i = 0; i < cacheKeys.length; i++) {
            //  Create our object with an expiry time.
            const objData = new PropertyData(newCacheData[i], daysToHold);

            //  Our property needs to be a string
            bulkData[cacheKeys[i]] = JSON.stringify(objData);
        }

        PropertiesService.getScriptProperties().setProperties(bulkData);
    }

    /**
     * Returns ALL cached data for each key value requested. 
     * Only 1 API call is made, so much faster than retrieving single values.
     * @param {String[]} cacheKeys 
     * @returns {any[]}
     */
    static getAll(cacheKeys) {
        const values = [];

        if (cacheKeys.length === 0) {
            return values;
        }
        
        const allProperties = PropertiesService.getScriptProperties().getProperties();

        //  Removing properties is very slow, so remove only 1 at a time.  This is enough as this function is called frequently.
        ScriptSettings.expire(false, 1, allProperties);

        for (const key of cacheKeys) {
            const myData = allProperties[key];

            if (myData === undefined) {
                values.push(null);
            }
            else {
                /** @type {PropertyData} */
                const myPropertyData = JSON.parse(myData);

                if (PropertyData.isExpired(myPropertyData)) {
                    values.push(null);
                    PropertiesService.getScriptProperties().deleteProperty(key);
                    Logger.log(`Delete expired Script Property Key=${key}`);
                }
                else {
                    values.push(PropertyData.getData(myPropertyData));
                }
            }
        }

        return values;
    }

    /**
     * Removes script settings that have expired.
     * @param {Boolean} deleteAll - true - removes ALL script settings regardless of expiry time.
     * @param {Number} maxDelete - maximum number of items to delete that are expired.
     * @param {Object} allPropertiesObject - All properties already loaded.  If null, will load iteself.
     */
    static expire(deleteAll, maxDelete = 999, allPropertiesObject = null) {
        const allProperties = allPropertiesObject === null ? PropertiesService.getScriptProperties().getProperties() : allPropertiesObject;
        const allKeys = Object.keys(allProperties);
        let deleteCount = 0;

        for (const key of allKeys) {
            let propertyValue = null;
            try {
                propertyValue = JSON.parse(allProperties[key]);
            }
            catch (e) {
                //  A property that is NOT cached by CACHEFINANCE
                continue;
            }

            const propertyOfThisApplication = propertyValue?.expiry !== undefined;

            if (propertyOfThisApplication && (PropertyData.isExpired(propertyValue) || deleteAll)) {
                PropertiesService.getScriptProperties().deleteProperty(key);
                delete allProperties[key];

                //  There is no way to iterate existing from 'short' cache, so we assume there is a
                //  matching short cache entry and attempt to delete.
                CacheFinance.deleteFromShortCache(key);

                Logger.log(`Removing expired SCRIPT PROPERTY: key=${key}`);

                deleteCount++;
            }

            if (deleteCount >= maxDelete) {
                return;
            }
        }
    }

    /**
     * Delete a specific key in script properties.
     * @param {String} key 
     */
    delete(key) {
        if (this.scriptProperties.getProperty(key) !== null) {
            this.scriptProperties.deleteProperty(key);
        }
    }
}

/**
 * @classdesc Converts data into JSON for getting/setting in ScriptSettings.
 */
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
     * @param {PropertyData} obj 
     * @returns {any}
     */
    static getData(obj) {
        let value = null;
        try {
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
     * @returns {Boolean}
     */
    static isExpired(obj) {
        const someDate = new Date();
        const expiryDate = new Date(obj.expiry);
        return (expiryDate.getTime() < someDate.getTime())
    }
}

/**
 * @classdesc - Executes a SELECT statement on sheet data.  Returned data will be any array of objects,
 * where each item is one row of data.  The property values in the object are the column names.
 * The column names will be in lower case.  If more than one table is referenced, the column name will be:
 * "table.column", otherwise it will just be the column name.  Spaces in the column name use the underscore, so
 * something like "Transaction Date" would be referenced as "transaction_date".
 */
class Select2Object {           // skipcq: JS-0128
    constructor() {
        this.tables = [];
        this.bindVariables = [];
    }

    /**
     * 
     * @param {String} tableName - table name referenced in SELECT statement.
     * @param {*} data - double array or string.  If string it must reference A1 notation, named range or sheet name.
     * @returns {Select2Object}
     */
    addTableData(tableName, data) {
        const table = { tableName, data };
        this.tables.push(table);

        return this;
    }

    /**
     * If bind variables are used in SELECT statement, this are added here.
     * Ordering is important.  The first one added will be '?1' in the select, second is '?2' in select...
     * @param {any} bindVar 
     * @returns {Select2Object}
     */
    addBindVariable(bindVar) {
        this.bindVariables.push(bindVar);

        return this;
    }

    /**
     * Query any sheet range using standard SQL SELECT syntax and return array of table info with column names as properties.
     * @example
     * gsSQL("select * from expenses where type = ?1")
     * 
     * @param {String} statement - SQL string 
     * @returns {Object[]} - array of object data.  
     */
    execute(statement) {     //  skipcq: JS-0128
        const parms = [];

        //  Add the table name and range.
        for (const tab of this.tables) {
            parms.push(tab.tableName, tab.data);
        }

        //  Add column output indicator.
        parms.push(true);   //  We want column names returned.

        //  Add bind data.
        for (const bind of this.bindVariables) {
            parms.push(bind);
        }

        const tableDataArray = GasSql.execute(statement, parms);

        if (tableDataArray === null || tableDataArray.length === 0) {
            return null;
        }

        //  First item in return array is an array of column names.
        const columnNames = Select2Object.cleanupColumnNames(tableDataArray[0]);

        return Select2Object.createTableObjectArray(columnNames, tableDataArray);
    }

    /**
     * Return column names in lower case and remove table name when only one table.
     * @param {String[]} cols 
     * @returns {String[]}
     */
    static cleanupColumnNames(cols) {
        const newColumns = cols.map(v => v.toLowerCase());
        const noTableColumns = [];

        const uniqueTables = new Set();
        for (const col of newColumns) {
            const splitColumn = col.split(".");

            if (splitColumn.length > 1) {
                uniqueTables.add(splitColumn[0]);
                noTableColumns.push(splitColumn[1]);
            }
            else {
                noTableColumns.push(splitColumn[0]);
            }
        }

        //  Leave the table name in the column since we have two or more tables.
        if (uniqueTables.size > 1) {
            return newColumns;
        }

        return noTableColumns;
    }

    /**
     * First row MUST be column names.
     * @param {any[][]} tableDataArray 
     * @returns {Object[]}
     */
    static convertTableArrayToObjectArray(tableDataArray) {
        //  First item in return array is an array of column names.
        const propertyNames = Select2Object.convertColumnTitleToPropertyName(tableDataArray[0]);

        return Select2Object.createTableObjectArray(propertyNames, tableDataArray);
    }

    /**
     * 
     * @param {Object[]} objectArray 
     * @param {String[]} columnTitles 
     * @param {Boolean} outputTitleRow
     * @returns {any[][]}
     */
    static convertObjectArrayToTableArray(objectArray, columnTitles, outputTitleRow = true) {
        const propertyNames = Select2Object.convertColumnTitleToPropertyName(columnTitles);
        const tableArray = [];

        if (outputTitleRow)
            tableArray.push(columnTitles);

        for (const objectRow of objectArray) {
            const row = [];

            for (const prop of propertyNames) {
                row.push(objectRow[prop]);
            }

            tableArray.push(row);
        }

        return tableArray;
    }

    /**
     * 
     * @param {Object} object 
     * @param {String[]} columnTitles 
     * @returns {String[]}
     */
    static convertObjectToArray(object, columnTitles) {
        const propertyNames = Select2Object.convertColumnTitleToPropertyName(columnTitles);
        const row = [];
        for (const prop of propertyNames) {
            row.push(object[prop]);
        }

        return row;
    }

    /**
     * Convert a sheet column name into format used for property name (spaces to underscore && lowercase)
     * @param {String[]} columnTitles 
     * @returns {String[]}
     */
    static convertColumnTitleToPropertyName(columnTitles) {
        const columnNames = [...columnTitles];
        const srcColumns = columnNames.map(col => col.trim()).map(col => col.toLowerCase()).map(col => col.replaceAll(' ', '_'));

        return srcColumns;
    }

    /**
     * Get column number - starting at 1 in object.
     * @param {Object} object 
     * @param {String} columnTitle 
     * @returns {Number}
     */
    static getColumnNumber(object, columnTitle) {
        const prop = Select2Object.convertColumnTitleToPropertyName([columnTitle])[0];
        let col = 1;
        for (const propName in object) {        // skipcq: JS-0051
            if (propName === prop) {
                return col;
            }
            col++;
        }

        return -1;
    }

    /**
     * 
     * @param {String[]} columnNames 
     * @param {any[]} tableDataArray 
     * @returns {Object[]}
     */
    static createTableObjectArray(columnNames, tableDataArray) {
        //  Create empty table record object.
        const emptyTableRecord = Select2Object.createEmptyRecordObject(columnNames);

        //  Create table array with record data stored in an object.
        const tableData = [];
        for (let i = 1; i < tableDataArray.length; i++) {
            const newRecord = {};
            Object.assign(newRecord, emptyTableRecord);

            for (const [index, col] of columnNames.entries()) {
                newRecord[col] = tableDataArray[i][index];
            }

            tableData.push(newRecord);
        }

        return tableData;
    }

    /**
     * Creates an empty object where each column name is a property in the object.
     * @param {String[]} columnNames 
     * @returns {Object}
     */
    static createEmptyRecordObject(columnNames) {
        //  Create empty table record object.
        const dataObject = {};
        for (const col of columnNames) {
            dataObject[col] = '';
        }

        dataObject.get = function (columnTitle) {
            const prop = Select2Object.convertColumnTitleToPropertyName([columnTitle])[0];
            return this[prop];
        };

        dataObject.set = function (columnTitle, value) {
            const prop = Select2Object.convertColumnTitleToPropertyName([columnTitle])[0];
            this[prop] = value;
        }

        return dataObject;
    }
}

