//  Remove comments for testing in NODE
/*
export {Sql};
import {Table} from './Table.js';
import {sql2ast} from './SimpleParser.js';
import {SelectView} from './Views.js';
*/

function testSql() {

    let sqlStatement = new Sql([["trades", "'Trades'!$A$1:$I"], ["accounts", "accountNamesData"], ["stocks", "'Stocks'!$A$6:$N"]],
    "SELECT accounts.account_name, trades.date, trades.symbol, trades.quantity, stocks.price from accounts  " + 
    "RIGHT JOIN trades ON accounts.Brokerage_Account_Holder = trades.account " +
    "LEFT JOIN stocks on trades.symbol = stocks.symbol " +
    "WHERE stocks.inventory = 0", true); 

    /*
let sqlStatement = new Sql([["masterTransactions", "'Master Transactions'!$A$1:$I"], ["accounts", "accountNamesData"]],
    'SELECT Transaction_Date, Description_1, Amount, accounts.registration, accounts.Account_Name ' +
    'FROM masterTransactions ' +
    'JOIN accounts ON masterTransactions.Name_of_Institution = accounts.Account_Name ' +
    'WHERE accounts.type = "Bank" ' +
    'AND Amount < 10 ');
    */

    /*
    let sqlStatement = new Sql([["masterTransactions", "'Master Transactions'!$A$1:$I"], ["accounts", "accountNamesData"]],
        'SELECT masterTransactions.Transaction_Date, Description_1, Amount, Accounts.Registration FROM masterTransactions ' +
        'JOIN accounts ON masterTransactions.Name_of_Institution = accounts.Account_Name ' +
        'WHERE Name_of_Institution = "RBC - Margin - ****2066" ' + 
        'AND accounts.Registration IN (SELECT Registration FROM accounts WHERE type = "Bank") ' +
        'ORDER BY Amount');
    */

    let selectData = sqlStatement.execute();
}

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
            let astTables = ast['FROM'];
            let astFields = ast['SELECT'];

            //  Manipulate AST to add GROUP BY if DISTINCT keyword.
            ast = this.distinctField(ast);

            let view = new SelectView(astTables, astFields, this.tables);

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
                viewTableData.unshift(view.getTitleRow());
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



