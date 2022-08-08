//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { Sql };
import { Table } from './Table.js';
import { TableData } from './TableData.js';
import { sql2ast } from './SimpleParser.js';
import { SelectTables } from './Views.js';
//  *** DEBUG END  ***/

/**
 * 
 * @param {String} tableArr - "[tableName, sheetRange, cacheSeconds=60],[name,range,cache],..."
 * @param {String} statement - SQL (e.g.:  'select * from tableName')
 * @param {Boolean} columnTitle - TRUE will add column title to output (default=FALSE)
 * @param {...any} bindings - Bind variables to match '?' in SQL statement.
 * @returns {any[][]}
 * @customfunction
 */
function gsSQL(tableArr, statement, columnTitle = false, ...bindings) {
    let tableList = parseTableSettings(tableArr);

    Logger.log("gsSQL: tableList=" + tableList + ".  Statement=" + statement + ". List Len=" + tableList.length);

    let sqlCmd = new Sql().enableColumnTitle(columnTitle);
    for (let bind of bindings) {
        sqlCmd.addBindParameter(bind);
    }
    for (let tableDef of tableList) {
        sqlCmd.addTableData(tableDef[0], tableDef[1], tableDef[2]);
    }
    return sqlCmd.execute(statement);
}

/**
 * 
 * @param {String} tableStr 
 * @returns {any[][]}
 */
function parseTableSettings(tableStr) {
    let tableList = [];

    let tableGroup = SelectTables.parseForParams(tableStr, "[", "]");
    if (tableGroup.length == 0)
        throw new Error("Missing table definition [name,range,cache]");

    for (let table of tableGroup) {
        let indexOfOpenBracket = table.indexOf("[");
        let indexOfLastBracket = table.lastIndexOf("]");
        
        let params = table.substring(indexOfOpenBracket+1, indexOfLastBracket);

        /** @type {any[]} */
        let items = params.split(",");
        for (let i = 0; i < items.length; i++)
            items[i] = items[i].replace(/['"]+/g, '').trim();

        if (items.length == 2)
            items.push(0);      //  default 0 second cache.
        if (items.length != 3)
            throw new Error ("Invalid table definition [name,range,cache]");

        tableList.push(items);
    }

    //  If called at the same time, loading similar tables in similar order - all processes
    //  just wait for table - but if loaded in different order, each process could be loading something.
    tableList = tableList.sort(() => Math.random() - 0.5);

    return tableList;
}


class Sql {
    constructor() {
        /** @type {Map<String,Table>} */
        this.tables = new Map();
        this.columnTitle = false;
        this.bindParameters = [];
    }

    /**
     * 
     * @param {String} tableName - Name of table referenced in SELECT.
     * @param {any} tableData - Either double array or a named range.
     * @param {Number} cacheSeconds - How long should loaded data be cached (default=0)
     * @returns {Sql}
     */
    addTableData(tableName, tableData, cacheSeconds = 0) {
        let tableInfo;

        if (Array.isArray(tableData)) {
            tableInfo = new Table(tableName)
                .loadArrayData(tableData);
        }
        else {
            tableInfo = new Table(tableName)
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

    /**
     * 
     * @param {String} value 
     * @returns {Sql}
     */
    addBindNamedRangeParameter(value) {
        let tableData = new TableData();
        let namedValue = tableData.getValueCached(value, 30);
        this.bindParameters.push(namedValue);
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

        this.ast = sql2ast(statement);

        // @ts-ignore
        for (let table of this.tables.keys()) {
            let tableAlias = this.getTableAlias(table, this.ast);
            let tableInfo = this.tables.get(table.toUpperCase());
            tableInfo
                .setTableAlias(tableAlias)
                .loadSchema();
        }

        if (typeof this.ast['SELECT'] != 'undefined')
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
    * Find table alias name (if any) for input actual table name.
    * @param {String} tableName - Actual table name.
    * @param {Object} ast - Abstract Syntax Tree for SQL.
    * @returns {String}
    */
    getTableAlias(tableName, ast) {
        let tableAlias = "";
        tableName = tableName.toUpperCase();
        let astTableBlocks = ['FROM', 'JOIN'];
        let astRecursiveTableBlocks = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];
        let i = 0;
        while (tableAlias == "" && i < astTableBlocks.length) {
            tableAlias = this.locateAstTableAlias(tableName, ast, astTableBlocks[i]);
            i++;
        }

        i = 0;
        while (tableAlias == "" && i < astRecursiveTableBlocks.length) {
            if (typeof ast[astRecursiveTableBlocks[i]] != 'undefined')
                tableAlias = this.getTableAlias(tableName, ast[astRecursiveTableBlocks[i]]);
            i++;
        }

        return tableAlias;
    }

    /**
     * 
     * @param {String} tableName 
     * @param {Object} ast 
     * @param {String} astBlock 
     * @returns {String}
     */
    locateAstTableAlias(tableName, ast, astBlock) {
        if (typeof ast[astBlock] == 'undefined')
            return "";

        for (let astItem of ast[astBlock]) {
            if (tableName == astItem.table.toUpperCase() && astItem.as != "") {
                return astItem.as;
            }
        }

        return "";
    }

    /**
     * Load SELECT data and return in double array.
     * @param {*} ast 
     * @returns {any[][]}
     */
    select(ast) {
        let recordIDs = [];
        let viewTableData = [];

        if (typeof ast['FROM'] == 'undefined')
            throw new Error("Missing keyword FROM");

        //  Manipulate AST to add GROUP BY if DISTINCT keyword.
        ast = this.distinctField(ast);

        //  Manipulate AST add pivot fields.
        ast = this.pivotField(ast);

        let view = new SelectTables(ast['FROM'], ast['SELECT'], this.tables, this.bindParameters);

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

        if (typeof ast['LIMIT'] != 'undefined') {
            let maxItems = ast['LIMIT'].nb;
            if (viewTableData.length > maxItems)
                viewTableData.splice(maxItems);
        }

        //  Apply SET rules for various union types.
        viewTableData = this.unionSets(ast, viewTableData);

        if (this.columnTitle)
            viewTableData.unshift(view.getColumnTitles());
        else if (viewTableData.length == 1 && viewTableData[0].length == 0)
            viewTableData[0] = [""];

        return viewTableData;
    }

    /**
     * If 'GROUP BY' is not set and 'DISTINCT' column is specified, update AST to add 'GROUP BY'.
     * @param {Object} ast 
     * @returns {Object}
     */
    distinctField(ast) {
        let astFields = ast['SELECT'];

        if (astFields.length > 0) {
            let firstField = astFields[0].name.toUpperCase();
            if (firstField.startsWith("DISTINCT")) {
                astFields[0].name = firstField.replace("DISTINCT", "").trim();

                if (typeof ast['GROUP BY'] == 'undefined') {
                    let groupBy = [];

                    for (let astItem of astFields) {
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
        if (typeof ast['PIVOT'] != 'undefined') {
            if (typeof ast['GROUP BY'] == 'undefined')
                throw new Error("PIVOT requires GROUP BY");
        }
        else
            return ast;

        // These are all of the unique PIVOT field data points.
        let pivotFieldData = this.getUniquePivotData(ast);

        ast['SELECT'] = this.addCalculatedPivotFieldsToAst(ast, pivotFieldData);

        return ast;
    }

    /**
     * Find distinct pivot column data.
     * @param {Object} ast 
     * @returns {any[][]}
     */
    getUniquePivotData(ast) {
        let pivotAST = {};

        pivotAST['SELECT'] = ast['PIVOT'];
        pivotAST['SELECT'][0].name = "DISTINCT " + pivotAST['SELECT'][0].name;
        pivotAST['FROM'] = ast['FROM'];
        pivotAST['WHERE'] = ast['WHERE'];

        // These are all of the unique PIVOT field data points.
        let oldSetting = this.columnTitle;
        let oldBindVariables = [...this.bindParameters];
        this.columnTitle = false;
        let tableData = this.select(pivotAST);
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
    addCalculatedPivotFieldsToAst(ast, pivotFieldData) {
        let newPivotAstFields = [];

        for (let selectField of ast['SELECT']) {
            //  If this is an aggregrate function, we will add one for every pivotFieldData item
            const functionNameRegex = /^\w+\s*(?=\()/;
            let matches = selectField.name.match(functionNameRegex)
            if (matches != null && matches.length > 0) {
                let args = SelectTables.parseForFunctions(selectField.name, matches[0].trim());

                for (let fld of pivotFieldData) {
                    let caseTxt = matches[0] + "(CASE WHEN " + ast['PIVOT'][0].name + " = '" + fld + "' THEN " + args[1] + " ELSE 'null' END)";
                    let asField = fld[0] + " " + (typeof selectField.as != 'undefined' && selectField.as != "" ? selectField.as : selectField.name);
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
        let unionTypes = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];

        for (let type of unionTypes) {
            if (typeof ast[type] != 'undefined') {
                let unionSQL = new Sql()
                .setBindValues(this.bindParameters)
                .setTables(this.tables);
                for (let union of ast[type]) {
                    let unionData = unionSQL.select(union);
                    if (viewTableData.length > 0 && unionData.length > 0 && viewTableData[0].length != unionData[0].length)
                        throw new Error("Invalid " + type +  ".  Selected field counts do not match.");
    
                    switch (type)
                    {
                        case "UNION":
                            //  Remove duplicates.
                            viewTableData = this.appendUniqueRows(viewTableData, unionData);
                            break;

                        case "UNION ALL":
                            //  Allow duplicates.
                            viewTableData = viewTableData.concat(unionData);
                            break;

                        case "INTERSECT":
                            //  Must exist in BOTH tables.
                            viewTableData = this.intersectRows(viewTableData, unionData);
                            break;

                        case "EXCEPT":
                            //  Remove from first table all rows that match in second table.
                            viewTableData = this.exceptRows(viewTableData, unionData);
                            break;                                               
                    }
                }
            }            
        }

        return viewTableData;
    }

    /**
     * 
     * @param {any[][]} srcData 
     * @param {any[][]} newData
     * @returns {any[][]} 
     */
    appendUniqueRows(srcData, newData) {
        let srcMap = new Map();

        for (let srcRow of srcData) {
            srcMap.set(srcRow.join("::"), true);
        }

        for (let newRow of newData) {
            let key = newRow.join("::");
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
    intersectRows(srcData, newData) {
        let srcMap = new Map();
        let intersectTable = [];

        for (let srcRow of srcData) {
            srcMap.set(srcRow.join("::"), true);
        }

        for (let newRow of newData) {
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
    exceptRows(srcData, newData) {
        let srcMap = new Map();
        let rowNum = 0;
        for (let srcRow of srcData) {
            srcMap.set(srcRow.join("::"), rowNum);
            rowNum++;
        }

        let removeRowNum = [];
        for (let newRow of newData) {
            let key = newRow.join("::");
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



