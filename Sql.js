//  Remove comments for testing in NODE
/*
export {Sql};
import {Table} from './Table.js';
import {sql2ast} from './SimpleParser.js';
import {SelectView, SelectTables} from './Views.js';
*/

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
    for (let temp of tableList) {
        Logger.log("table: " + temp);
    }
    let sql = new Sql(tableList, statement, columnTitle);

    return sql.execute();
}


class Sql {
    /**
     * @param {any[][]} tableList - [tableName, sheetRange, tableArray], for as many tables that are used.
     * @param {String} statement - SQL statement.  All keywords must be UPPER CASE.
     */
    constructor(tableList, statement, columnTitle = false) {
        /** @type {Map<String,Table>} */
        this.tables = new Map();
        this.statement = statement;
        this.columnTitle = columnTitle;

        //  All tables that are reference along with sheet ranges.
        for (let table of tableList) {
            this.tables.set(table[0].toUpperCase(), new Table(table[0], table[1], table[2]));
        }
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
     * After command is parsed, perform SQL function.
     * @returns 
     */
    execute() {
        let sqlData = [];

        let ast = sql2ast(this.statement);

        if (typeof ast['SELECT'] != 'undefined')
            sqlData = this.select(ast);
        else
            throw("Only SELECT statements are supported.");

        return sqlData;
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

            let view = new SelectView(ast['FROM'], ast['SELECT'], this.tables);

            if (typeof ast['JOIN'] != 'undefined') {
                view.join(ast['JOIN']);
            }

            if (typeof ast['WHERE'] != 'undefined') {
                recordIDs = view.selectRecordIDsWhere(ast['WHERE']);
            }
            else {
                //  Entire table is selected.  
                let conditions = { operator: "=", left: "\"A\"", right: "\"A\"" };
                recordIDs = view.selectRecordIDsWhere(conditions);
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

            if (typeof ast['UNION'] != 'undefined' ) {
                let unionSQL = new Sql([], "", false).setTables(this.tables);
                for (let union of ast['UNION']) {
                    let unionData = unionSQL.select(union);
                    if (viewTableData.length > 0 && unionData.length > 0 && viewTableData[0].length != unionData[0].length)
                        throw ("Invalid UNION.  Selected field counts do not match.");

                    //  Remove duplicates.
                    viewTableData = this.appendUniqueRows(viewTableData, unionData);
                }
            }

            if (typeof ast['UNION ALL'] != 'undefined' ) {
                let unionSQL = new Sql([], "", false).setTables(this.tables);
                for (let union of ast['UNION ALL']) {
                    let unionData = unionSQL.select(union);
                    if (viewTableData.length > 0 && unionData.length > 0 && viewTableData[0].length != unionData[0].length)
                        throw ("Invalid UNION ALL.  Selected field counts do not match.");

                    //  Allow duplicates.
                    viewTableData = viewTableData.concat(unionData);
                }
            }

            if (typeof ast['INTERSECT'] != 'undefined' ) {
                let unionSQL = new Sql([], "", false).setTables(this.tables);
                for (let union of ast['INTERSECT']) {
                    let unionData = unionSQL.select(union);
                    if (viewTableData.length > 0 && unionData.length > 0 && viewTableData[0].length != unionData[0].length)
                        throw ("Invalid INTERSECT.  Selected field counts do not match.");

                    //  Must exist in BOTH tables.
                    viewTableData = this.intersectRows(viewTableData, unionData);
                }
            }

            if (typeof ast['EXCEPT'] != 'undefined' ) {
                let unionSQL = new Sql([], "", false).setTables(this.tables);
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
            throw("Missing keyword FROM");
        }

        return viewTableData;
    }

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

    pivotField(ast){
        //  If we are doing a PIVOT, it then requires a GROUP BY.
        if (typeof ast['PIVOT'] != 'undefined') {
            if (typeof ast['GROUP BY'] == 'undefined')
                throw("PIVOT requires GROUP BY");
        }
        else
            return ast;

        // These are all of the unique PIVOT field data points.
        let pivotFieldData = this.getUniquePivotData(ast);

        ast['SELECT'] = this.addCalculatedPivotFieldsToAst(ast, pivotFieldData);

        return ast;
    }

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

        return  tableData;   
    }

    addCalculatedPivotFieldsToAst(ast, pivotFieldData) {
        let newPivotAstFields = [];

        for (let selectField of ast['SELECT']) {
            //  If this is an aggregrate function, we will add one for every pivotFieldData item

            const functionNameRegex = /[a-zA-Z]*(?=\()/
            let matches = selectField.name.match(functionNameRegex)
            if (matches != null && matches.length > 0)
            {
                let args = SelectTables.parseForFunctions(selectField.name, matches[0]);
                
                for (let fld of pivotFieldData) {
                    let caseTxt = matches[0] + "(CASE WHEN " + ast['PIVOT'][0].name + " = '" + fld + "' THEN " + args[1] + " ELSE 'null' END)";
                    let asField = fld[0] + " " + (typeof selectField.as != 'undefined' && selectField.as != "" ? selectField.as : selectField.name); 
                    newPivotAstFields.push({name: caseTxt, as: asField});
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
            if (! srcMap.has(key)) {
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

        removeRowNum.sort(function(a, b){return b-a});
        for (let rowNum of removeRowNum) {
            srcData.splice(rowNum,1);
        }

        return srcData;
    }
}



