//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { Sql };
import { Table } from './Table.js';
import { sql2ast } from './SimpleParser.js';
import { SelectTables } from './Views.js';
//  *** DEBUG END  ***/

/**
 * 
 * @param {String} tableArr - "[[tableName, sheetRange],[name,range],...]]"
 * @param {String} statement - SQL (e.g.:  'select * from tableName')
 * @param {Boolean} columnTitle - TRUE will add column title to output (default=FALSE)
 * @returns {any[][]}
 * @customfunction
 */
function gsSQL(tableArr, statement, columnTitle = false) {
    //  TODO:  'THEY' say never use EVAL.  Well, who are 'THEY' and I don't care since I
    //          am the only user.
    let tableList = eval(tableArr);

    Logger.log("gsSQL: tableList=" + tableList + ".  Statement=" + statement + ". List Len=" + tableList.length);

    let sqlCmd = new Sql().enableColumnTitle(columnTitle);
    for (let temp of tableList) {
        Logger.log("table: " + temp);
        sqlCmd.addTableData(temp[0], temp[1]);
    }
    return sqlCmd.execute(statement);
}


class Sql {
    /** Loads table data into object.
     * @param {any[][]} tableList - [tableName, sheetRange, tableArray], for as many tables that are used.
     */
    constructor(tableList=[]) {
        /** @type {Map<String,Table>} */
        this.tables = new Map();
        this.columnTitle = false;

        //  All tables that are reference along with sheet ranges.
        for (let table of tableList) {
            let tableInfo = new Table(table[0])
                .loadNamedRangeData(table[1])
                .loadArrayData(table[2]);
            this.tables.set(table[0].toUpperCase(), tableInfo);
        }
    }

    /**
     * 
     * @param {String} tableName 
     * @param {any} tableData 
     * @returns {Sql}
     */
    addTableData(tableName, tableData) {
        let tableInfo;

        if (Array.isArray(tableData)) {
            tableInfo = new Table(tableName)
                .loadArrayData(tableData);    
        }
        else {
            tableInfo = new Table(tableName)
            .loadNamedRangeData(tableData);  
        }

        this.tables.set(tableName.toUpperCase(), tableInfo);  
        
        return this;
    }

    /**
     * Include column headers in return data.
     * @param {Boolean} value 
     * @returns {Sql}
     */
    enableColumnTitle(value) {
        this.columnTitle = value;
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
            throw ("Only SELECT statements are supported.");

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

        for (let i = 0; i < ast[astBlock].length; i++) {
            if (tableName == ast[astBlock][i].table.toUpperCase() && ast[astBlock][i].as != "") {
                return ast[astBlock][i].as;
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

        if (typeof ast['FROM'] != 'undefined') {
            //  Manipulate AST to add GROUP BY if DISTINCT keyword.
            ast = this.distinctField(ast);

            if (typeof ast['PIVOT'] != 'undefined') {
                //  Manipulate AST add pivot fields.
                ast = this.pivotField(ast);
            }

            let view = new SelectTables(ast['FROM'], ast['SELECT'], this.tables);

            if (typeof ast['JOIN'] != 'undefined') {
                view.join(ast['JOIN']);
            }

            if (typeof ast['WHERE'] != 'undefined') {
                recordIDs = view.whereCondition(ast['WHERE']);
            }
            else {
                //  Entire table is selected.  
                let conditions = { operator: "=", left: "\"A\"", right: "\"A\"" };
                recordIDs = view.whereCondition(conditions);
            }

            viewTableData = view.getViewData(recordIDs);

            if (typeof ast['GROUP BY'] != 'undefined') {
                viewTableData = view.groupBy(ast['GROUP BY'], viewTableData);

                if (typeof ast['HAVING'] != 'undefined') {
                    viewTableData = view.having(ast['HAVING'], viewTableData);
                }
            }
            else {
                //  If any conglomerate field functions (SUM, COUNT,...)
                //  we summarize all records into ONE.
                if (view.getConglomerateFieldCount() > 0) {
                    let compressedData = [];
                    compressedData.push(view.conglomerateRecord(viewTableData));
                    viewTableData = compressedData;
                }
            }

            if (typeof ast['ORDER BY'] != 'undefined') {
                view.orderBy(ast['ORDER BY'], viewTableData);
            }

            if (typeof ast['LIMIT'] != 'undefined') {
                let maxItems = ast['LIMIT'].nb;
                if (viewTableData.length > maxItems)
                    viewTableData.splice(maxItems);
            }

            if (typeof ast['UNION'] != 'undefined') {
                let unionSQL = new Sql([]).setTables(this.tables);
                for (let union of ast['UNION']) {
                    let unionData = unionSQL.select(union);
                    if (viewTableData.length > 0 && unionData.length > 0 && viewTableData[0].length != unionData[0].length)
                        throw ("Invalid UNION.  Selected field counts do not match.");

                    //  Remove duplicates.
                    viewTableData = this.appendUniqueRows(viewTableData, unionData);
                }
            }

            if (typeof ast['UNION ALL'] != 'undefined') {
                let unionSQL = new Sql([]).setTables(this.tables);
                for (let union of ast['UNION ALL']) {
                    let unionData = unionSQL.select(union);
                    if (viewTableData.length > 0 && unionData.length > 0 && viewTableData[0].length != unionData[0].length)
                        throw ("Invalid UNION ALL.  Selected field counts do not match.");

                    //  Allow duplicates.
                    viewTableData = viewTableData.concat(unionData);
                }
            }

            if (typeof ast['INTERSECT'] != 'undefined') {
                let unionSQL = new Sql([]).setTables(this.tables);
                for (let union of ast['INTERSECT']) {
                    let unionData = unionSQL.select(union);
                    if (viewTableData.length > 0 && unionData.length > 0 && viewTableData[0].length != unionData[0].length)
                        throw ("Invalid INTERSECT.  Selected field counts do not match.");

                    //  Must exist in BOTH tables.
                    viewTableData = this.intersectRows(viewTableData, unionData);
                }
            }

            if (typeof ast['EXCEPT'] != 'undefined') {
                let unionSQL = new Sql([]).setTables(this.tables);
                for (let union of ast['EXCEPT']) {
                    let unionData = unionSQL.select(union);
                    if (viewTableData.length > 0 && unionData.length > 0 && viewTableData[0].length != unionData[0].length)
                        throw ("Invalid EXCEPT.  Selected field counts do not match.");

                    //  Remove from first table all rows that match in second table.
                    viewTableData = this.exceptRows(viewTableData, unionData);
                }
            }

            if (this.columnTitle)
                viewTableData.unshift(view.getColumnTitles());
        }
        else {
            throw ("Missing keyword FROM");
        }

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

                    for (let i = 0; i < astFields.length; i++) {
                        groupBy.push({ column: astFields[i].name });
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
                throw ("PIVOT requires GROUP BY");
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
        this.columnTitle = false;
        let tableData = this.select(pivotAST);
        this.columnTitle = oldSetting;

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

            const functionNameRegex = /[a-zA-Z]*(?=\()/
            let matches = selectField.name.match(functionNameRegex)
            if (matches != null && matches.length > 0) {
                let args = SelectTables.parseForFunctions(selectField.name, matches[0]);

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



