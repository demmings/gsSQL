//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { Sql, gsSQL, parseTableSettings, BindData };
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
 * @description
 * **CUSTOM FUNCTION**  
 * * Available as a custom function within your sheet.
 * * Query any sheet range using standard SQL SELECT syntax.
 * ### Parameters.
 * * Parameter 1.  SELECT statement.  All regular syntax is supported including JOIN. 
 *   * note i)  Bind variables (?) are replaced by bind data specified later.
 *   * note ii)  PIVOT field supported.  Similar to QUERY. e.g.  "SELECT date, sum(quantity) from sales group by date pivot customer_id".
 *   * note iii) If parm 2 not used and sheet name contains a space, use single quotes around table name.
 * * Parameter 2. (optional. referenced tables assumed to be SHEET NAME with column titles).  Define all tables referenced in SELECT. This is a DOUBLE ARRAY and is done using the curly bracket {{a,b,c}; {a,b,c}} syntax.
 *   * a)  table name - the table name referenced in SELECT for indicated range.
 *   * b)  sheet range - (optional) either NAMED RANGE, A1 notation range, SHEET NAME or empty (table name used as sheet name).  This input is a string.  The first row of each range MUST be unique column titles.
 *   * c)  cache seconds - (optional) time loaded range held in cache.  default=60.   
 *   * d)  has column title - (optional) first row of data is a title (for field name).  default=true 
 * * Parameter 3. (optional) Output result column title (true/false). default=true.   
 * * Parameter 4... (optional) Bind variables.  List as many as required to match '?' in SELECT statement.
 * <br>
 * * **Example** use inside Google Sheet Cell.
 * ```
 * =gsSQL("select title, (select count(*)  from Booksales where books.id = BookSales.book_id) as 'Quantity Sold' from books", {{"booksales","booksales", 60};{"books", "books", 60}})
 * ```
 * @param {String} statement - SQL (e.g.:  'select * from expenses')
 * @param {any[][]} tableArr - {{"tableName", "sheetRange", cacheSeconds, hasColumnTitle}; {"name","range",cache,true};...}"
 * @param {Boolean} columnTitle - TRUE will add column title to output (default=TRUE)
 * @param {...any} bindings - Bind variables to match '?' in SQL statement.
 * @returns {any[][]} - Double array of selected data.  First index ROW, Second index COLUMN.
 * @customfunction
 */
function gsSQL(statement, tableArr = [], columnTitle = true, ...bindings) {     //  skipcq: JS-0128
    const tableList = parseTableSettings(tableArr, statement);

    Logger.log(`gsSQL: tableList=${tableList}.  Statement=${statement}. List Len=${tableList.length}`);

    const sqlCmd = new Sql().enableColumnTitle(columnTitle);
    for (const bind of bindings) {
        sqlCmd.addBindParameter(bind);
    }
    for (const tableDef of tableList) {
        sqlCmd.addTableData(tableDef[0], tableDef[1], tableDef[2], tableDef[3]);
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
        if (table.length === 3)
            table.push(true);    //  default HAS column title row.
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

/** Perform SQL SELECT using this class. */
class Sql {
    constructor() {
        /** @property {Map<String,Table>} - Map of referenced tables.*/
        this.tables = new Map();
        /** @property {Boolean} - Are column tables to be ouptout? */
        this.columnTitle = false;
        /** @property {BindData} - List of BIND data linked to '?' in statement. */
        this.bindData = new BindData();
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
        let sqlData = [];

        if (typeof statement === 'string') {
            this.ast = SqlParse.sql2ast(statement);
        }
        else {
            this.ast = statement;
        }

        //  "SELECT * from (select a,b,c from table) as derivedtable"
        //  Sub query data is loaded and given the name 'derivedtable'
        //  The AST.FROM is updated from the sub-query to the new derived table name. 
        this.selectFromSubQuery();

        Sql.setTableAlias(this.tables, this.ast);
        Sql.loadSchema(this.tables);

        if (typeof this.ast.SELECT !== 'undefined')
            sqlData = this.select(this.ast);
        else
            throw new Error("Only SELECT statements are supported.");

        return sqlData;
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
     * Updates 'tables' with associated table ALIAS name found in ast.
     * @param {Map<String,Table>} tables 
     * @param {Object} ast 
     */
    static setTableAlias(tables, ast) {
        // @ts-ignore
        for (const table of tables.keys()) {
            const tableAlias = Sql.getTableAlias(table, ast);
            const tableInfo = tables.get(table.toUpperCase());
            tableInfo.setTableAlias(tableAlias);
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
    * Find table alias name (if any) for input actual table name.
    * @param {String} tableName - Actual table name.
    * @param {Object} ast - Abstract Syntax Tree for SQL.
    * @returns {String} - Table alias.  Empty string if not found.
    */
    static getTableAlias(tableName, ast) {
        let tableAlias = "";
        const ucTableName = tableName.toUpperCase();

        tableAlias = Sql.getTableAliasFromJoin(tableAlias, ucTableName, ast);
        tableAlias = Sql.getTableAliasUnion(tableAlias, ucTableName, ast);
        tableAlias = Sql.getTableAliasWhereIn(tableAlias, ucTableName, ast);
        tableAlias = Sql.getTableAliasWhereTerms(tableAlias, ucTableName, ast);

        return tableAlias;
    }

    /**
     * Modifies AST when FROM is a sub-query rather than a table name.
     */
    selectFromSubQuery() {
        if (typeof this.ast.FROM !== 'undefined' && typeof this.ast.FROM.SELECT !== 'undefined') {
            const data = new Sql()
                .setTables(this.tables)
                .enableColumnTitle(true)
                .execute(this.ast.FROM);
            this.addTableData(this.ast.FROM.FROM[0].as, data);
            this.ast.FROM = [{ table: this.ast.FROM.FROM[0].as, as: this.ast.FROM.FROM[0].as }];
        }
    }

    /**
     * Searches the FROM and JOIN components of a SELECT to find the table alias.
     * @param {String} tableAlias - Default alias name
     * @param {String} tableName - table name to search for.
     * @param {Object} ast - Abstract Syntax Tree to search
     * @returns {String} - Table alias name.
     */
    static getTableAliasFromJoin(tableAlias, tableName, ast) {
        const astTableBlocks = ['FROM', 'JOIN'];
        let aliasNameFound = tableAlias;

        let i = 0;
        while (aliasNameFound === "" && i < astTableBlocks.length) {
            aliasNameFound = Sql.locateAstTableAlias(tableName, ast, astTableBlocks[i]);
            i++;
        }

        return aliasNameFound;
    }

    /**
     * Searches the UNION portion of the SELECT to locate the table alias.
     * @param {String} tableAlias - default table alias.
     * @param {String} tableName - table name to search for.
     * @param {Object} ast - Abstract Syntax Tree to search
     * @returns {String} - table alias
     */
    static getTableAliasUnion(tableAlias, tableName, ast) {
        const astRecursiveTableBlocks = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];
        let extractedAlias = tableAlias;

        let i = 0;
        while (extractedAlias === "" && i < astRecursiveTableBlocks.length) {
            if (typeof ast[astRecursiveTableBlocks[i]] !== 'undefined') {
                for (const unionAst of ast[astRecursiveTableBlocks[i]]) {
                    extractedAlias = Sql.getTableAlias(tableName, unionAst);

                    if (extractedAlias !== "")
                        break;
                }
            }
            i++;
        }

        return extractedAlias;
    }

    /**
     * Search WHERE IN component of SELECT to find table alias.
     * @param {String} tableAlias - default table alias
     * @param {String} tableName - table name to search for
     * @param {Object} ast - Abstract Syntax Tree to search
     * @returns {String} - table alias
     */
    static getTableAliasWhereIn(tableAlias, tableName, ast) {
        let extractedAlias = tableAlias;
        if (tableAlias === "" && typeof ast.WHERE !== 'undefined' && ast.WHERE.operator === "IN") {
            extractedAlias = Sql.getTableAlias(tableName, ast.WHERE.right);
        }

        if (extractedAlias === "" && ast.operator === "IN") {
            extractedAlias = Sql.getTableAlias(tableName, ast.right);
        }

        return extractedAlias;
    }

    /**
     * Search WHERE terms of SELECT to find table alias.
     * @param {String} tableAlias - default table alias
     * @param {String} tableName  - table name to search for.
     * @param {Object} ast - Abstract Syntax Tree to search.
     * @returns {String} - table alias
     */
    static getTableAliasWhereTerms(tableAlias, tableName, ast) {
        let extractedTableAlias = tableAlias;
        if (tableAlias === "" && typeof ast.WHERE !== 'undefined' && typeof ast.WHERE.terms !== 'undefined') {
            for (const term of ast.WHERE.terms) {
                if (extractedTableAlias === "")
                    extractedTableAlias = Sql.getTableAlias(tableName, term);
            }
        }

        return extractedTableAlias;
    }

    /**
     * Create table definition array from select string.
     * @param {String} statement - full sql select statement.
     * @returns {String[][]} - table definition array.
     */
    static getReferencedTableNames(statement) {
        const ast = SqlParse.sql2ast(statement);
        return this.getReferencedTableNamesFromAst(ast);
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

        Sql.extractAstTables(ast, tableSet);

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
        Sql.getTableNamesFromOrJoin(ast, tableSet);
        Sql.getTableNamesUnion(ast, tableSet);
        Sql.getTableNamesWhereIn(ast, tableSet);
        Sql.getTableNamesWhereTerms(ast, tableSet);
        Sql.getTableNamesCorrelatedSelect(ast, tableSet);
    }

    /**
     * Search for referenced table in FROM or JOIN part of select.
     * @param {Object} ast - AST for SELECT.
     * @param {Map<String,String>} tableSet  - Function updates this map of table names and alias name.
     */
    static getTableNamesFromOrJoin(ast, tableSet) {
        const astTableBlocks = ['FROM', 'JOIN'];

        for (const astBlock of astTableBlocks) {
            if (typeof ast[astBlock] === 'undefined')
                continue;

            let blockData = ast[astBlock];

            //  In the case where FROM (select sub-query) it will not be iterable.
            if (!this.isIterable(blockData) && astBlock === 'FROM') {
                blockData = blockData.FROM;
            }

            for (const astItem of blockData) {
                tableSet.set(astItem.table.toUpperCase(), astItem.as.toUpperCase());
            }
        }
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
        //  where IN ().
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
                Sql.getTableNamesWhereCondition(term, tableSet);
            }
        }
    }

    /**
     * Search CORRELATES sub-query for table names.
     * @param {*} ast - AST to search
     * @param {*} tableSet - Function updates this map of table names and alias name.
     */
    static getTableNamesCorrelatedSelect(ast, tableSet) {
        if (typeof ast.SELECT !== 'undefined') {
            for (const term of ast.SELECT) {
                if (typeof term.subQuery !== 'undefined' && term.subQuery !== null) {
                    this.extractAstTables(term.subQuery, tableSet);
                }
            }
        }
    }

    /**
     * Search a property of AST for table alias name.
     * @param {String} tableName - Table name to find in AST.
     * @param {Object} ast - AST of SELECT.
     * @param {String} astBlock - AST property to search.
     * @returns {String} - Alias name or "" if not found.
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
     * @param {Object} selectAst - Abstract Syntax Tree of SELECT
     * @returns {any[][]} - double array useable by Google Sheet in custom function return value.
     * * First row of data will be column name if column title output was requested.
     * * First Array Index - ROW
     * * Second Array Index - COLUMN
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

        const view = new SelectTables(ast, this.tables, this.bindData);

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

        //  Remove fields referenced but not included in SELECT field list.
        view.removeTempColumns(viewTableData);

        if (typeof ast.LIMIT !== 'undefined') {
            const maxItems = ast.LIMIT.nb;
            if (viewTableData.length > maxItems)
                viewTableData.splice(maxItems);
        }

        //  Apply SET rules for various union types.
        viewTableData = this.unionSets(ast, viewTableData);

        if (this.columnTitle) {
            viewTableData.unshift(view.getColumnTitles());
        }

        if (viewTableData.length === 0) {
            viewTableData.push([""]);
        }

        if (viewTableData.length === 1 && viewTableData[0].length === 0) {
            viewTableData[0] = [""];
        }

        return viewTableData;
    }

    /**
     * If 'GROUP BY' is not set and 'DISTINCT' column is specified, update AST to add 'GROUP BY'.
     * @param {Object} ast - Abstract Syntax Tree for SELECT.
     * @returns {Object} - Updated AST to include GROUP BY when DISTINCT field used.
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
     * @param {Object} ast - AST which is checked to see if a PIVOT is used.
     * @returns {Object} - Updated AST containing SELECT FIELDS for the pivot data OR original AST if no pivot.
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
     * @param {Object} ast - Abstract Syntax Tree containing the PIVOT option.
     * @returns {any[][]} - All unique data points found in the PIVOT field for the given SELECT.
     */
    getUniquePivotData(ast) {
        const pivotAST = {};

        pivotAST.SELECT = ast.PIVOT;
        pivotAST.SELECT[0].name = `DISTINCT ${pivotAST.SELECT[0].name}`;
        pivotAST.FROM = ast.FROM;
        pivotAST.WHERE = ast.WHERE;

        const pivotSql = new Sql()
            .enableColumnTitle(false)
            .setBindValues(this.bindData)
            .copyTableData(this.getTables());

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
            else
                newPivotAstFields.push(selectField);
        }

        return newPivotAstFields;
    }

    /**
     * If any SET commands are found (like UNION, INTERSECT,...) the additional SELECT is done.  The new
     * data applies the SET rule against the income viewTableData, and the result data set is returned.
     * @param {Object} ast - SELECT AST.
     * @param {any[][]} viewTableData - SELECTED data before UNION.
     * @returns {any[][]} - New data with set rules applied.
     */
    unionSets(ast, viewTableData) {
        const unionTypes = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];
        let unionTableData = viewTableData;

        for (const type of unionTypes) {
            if (typeof ast[type] !== 'undefined') {
                const unionSQL = new Sql()
                    .setBindValues(this.bindData)
                    .copyTableData(this.getTables());
                for (const union of ast[type]) {
                    const unionData = unionSQL.execute(union);
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
     * Appends any row in newData that does not exist in srcData.
     * @param {any[][]} srcData - existing table data
     * @param {any[][]} newData - new table data
     * @returns {any[][]} - srcData rows PLUS any row in newData that is NOT in srcData.
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

        removeRowNum.sort(function (a, b) { return b - a });
        for (rowNum of removeRowNum) {
            srcData.splice(rowNum, 1);
        }

        return srcData;
    }
}

/**
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

