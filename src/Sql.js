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
 *   d)  has column title - (optional) first row of data is a title (for field name).  default=true 
 * Parameter 3. (optional) Output result column title (true/false). default=true.   
 * Parameter 4... (optional) Bind variables.  List as many as required to match ? in SELECT.
 * @param {String} statement - SQL (e.g.:  'select * from expenses')
 * @param {any[][]} tableArr - {{"tableName", "sheetRange", cacheSeconds, hasColumnTitle}; {"name","range",cache,true};...}"
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
        sqlCmd.addTableData(tableDef[0], tableDef[1], tableDef[2], tableDef[3]);
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


class Sql {
    constructor() {
        /** @type {Map<String,Table>} */
        this.tables = new Map();
        this.columnTitle = false;
        /** @type {any[]} */
        this.bindParameters = [];
    }

    /**
     * 
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

    getBindData() {
        return this.bindParameters;
    }

    /**
     * The BIND data is a sheet named range that will be read and used for bind data.
     * @param {String} value 
     * @returns {Sql}
     */
    addBindNamedRangeParameter(value) {
        const namedValue = TableData.getValueCached(value, 30);
        this.bindParameters.push(namedValue);
        Logger.log(`BIND=${value} = ${namedValue}`);
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
     * 
     * @returns {Map<String,Table>} 
     */
    getTables() {
        return this.tables;
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
     * @param {String} tableAlias - Extracted alias name
     * @param {String} tableName 
     * @param {Object} ast 
     * @returns {String}
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
     * 
     * @param {String} tableAlias 
     * @param {String} tableName 
     * @param {Object} ast 
     * @returns {String}
     */
    getTableAliasUnion(tableAlias, tableName, ast) {
        const astRecursiveTableBlocks = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];
        let extractedAlias = tableAlias;

        let i = 0;
        while (extractedAlias === "" && i < astRecursiveTableBlocks.length) {
            if (typeof ast[astRecursiveTableBlocks[i]] !== 'undefined') {
                for (const unionAst of ast[astRecursiveTableBlocks[i]]) {
                    extractedAlias = this.getTableAlias(tableName, unionAst);

                    if (extractedAlias !== "")
                        break;
                }
            }
            i++;
        }

        return extractedAlias;
    }

    /**
     * 
     * @param {String} tableAlias 
     * @param {String} tableName 
     * @param {Object} ast 
     * @returns {String}
     */
    getTableAliasWhereIn(tableAlias, tableName, ast) {
        let extractedAlias = tableAlias;
        if (tableAlias === "" && typeof ast.WHERE !== 'undefined' && ast.WHERE.operator === "IN") {
            extractedAlias = this.getTableAlias(tableName, ast.WHERE.right);
        }

        if (extractedAlias === "" && ast.operator === "IN") {
            extractedAlias = this.getTableAlias(tableName, ast.right);
        }

        return extractedAlias;
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
        const DEFAULT_CACHE_SECONDS = 60;
        const DEFAULT_COLUMNS_OUTPUT = true;
        const tableSet = new Map();
        const ast = SqlParse.sql2ast(statement);

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
     * 
     * @param {Object} ast 
     * @param {Map<String,String>} tableSet 
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
     * @param {Map<String,String>} tableSet 
     */
    static getTableNamesFromOrJoin(ast, tableSet) {
        const astTableBlocks = ['FROM', 'JOIN'];

        for (const astBlock of astTableBlocks) {
            if (typeof ast[astBlock] === 'undefined')
                continue;

            const blockData = ast[astBlock];
            for (const astItem of blockData) {
                tableSet.set(astItem.table.toUpperCase(), astItem.as.toUpperCase());
            }
        }
    }

    /**
     * 
     * @param {Object} ast 
     * @param {Map<String,String>} tableSet 
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
     * @param {Map<String,String>} tableSet 
     */
    static getTableNamesWhereIn(ast, tableSet) {
        //  where IN ().
        if (typeof ast.WHERE !== 'undefined' && (ast.WHERE.operator === "IN" || ast.WHERE.operator === "NOT IN")) {
            this.extractAstTables(ast.WHERE.right, tableSet);
        }

        if (ast.operator === "IN" || ast.operator === "NOT IN") {
            this.extractAstTables(ast.right, tableSet);
        }
    }
    
    /**
     * 
     * @param {Object} ast 
     * @param {Map<String,String>} tableSet 
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



