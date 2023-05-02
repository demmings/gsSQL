/*  *** DEBUG START ***  
//  Remove comments for testing in NODE
import { Sql, GasSql, gsSQL } from './Sql.js';
import { Table } from './Table.js';
import { TableData } from './TableData.js';
export { CacheService };
export { LockService };
export { SpreadsheetApp };
export { Range };
export { Utilities };
export { Logger };
export { PropertiesService };
export { SqlTester };
export { TestSql };

//  GAS Mock Ups.
class CacheService {
    constructor() {
        // @type {Map<String, cacheItem>} 
        this.cacheMap = new Map();
    }
    static cacheObject = null;

    static getScriptCache() {
        if (this.cacheObject === null)
            this.cacheObject = new CacheService();

        return this.cacheObject;
    }

    get(tagName) {
        let cacheValue = this.cacheMap.get(tagName);
        if (typeof cacheValue === 'undefined')
            return null;

        if (cacheValue.isExpired()) {
            this.cacheMap.delete(tagName);
            return null;
        }

        return cacheValue.dataValue;
    }

    put(namedRange, singleData, seconds) {
        let dataItem = new cacheItem(singleData, seconds);
        this.cacheMap.set(namedRange, dataItem);
    }

    putAll(putObject, cacheSeconds) {
        for (let prop in putObject) {
            this.put(prop, putObject[prop], cacheSeconds);
        }
    }

    remove(tagName) {
        if (this.get(tagName) !== null) {
            this.cacheMap.delete(tagName);
        }
    }
}

class cacheItem {
    constructor(dataValue, seconds) {
        this.dataValue = dataValue;
        this.startTime = new Date().getTime();
        this.seconds = seconds;
    }

    isExpired() {
        const endTime = new Date().getTime();
        let timeDiff = endTime - this.startTime; //in ms
        // strip the ms
        timeDiff /= 1000;

        return timeDiff > this.seconds;
    }
}

class PropertiesService {
    constructor() {
        // @type {Map<String, cacheItem>} 
        this.cacheMap = new Map();
    }
    static cacheObject = null;

    static getScriptProperties() {
        if (this.cacheObject === null)
            this.cacheObject = new PropertiesService();

        return this.cacheObject;
    }

    getProperty(tagName) {
        let cacheValue = this.cacheMap.get(tagName);
        if (typeof cacheValue === 'undefined')
            return null;

        if (cacheValue.isExpired()) {
            this.cacheMap.delete(tagName);
            return null;
        }

        return cacheValue.dataValue;
    }

    deleteProperty(tagName) {
        if (this.cacheMap.has(tagName))
            this.cacheMap.delete(tagName);
    }

    setProperty(namedRange, singleData, seconds = 999999) {
        let dataItem = new cacheItem(singleData, seconds);
        this.cacheMap.set(namedRange, dataItem);
    }

    getKeys() {
        return Array.from(this.cacheMap.keys());
    }
}

class LockService {
    static isLocked = false;

    static getScriptLock() {
        return new LockService();
    }

    waitLock(ms) {
        let startTime = new Date().getTime();
        // @ts-ignore
        while (this.isLocked || (new Date().getTime() - startTime) > ms) {
            Utilities.sleep(250);
        }

        // @ts-ignore
        if (this.isLocked) {
            throw new Error("Failed to lock");
        }

        this.isLocked = true;
    }

    releaseLock() {
        this.isLocked = false;
    }
}

class SpreadsheetApp {
    static getActiveSpreadsheet() {
        return new SpreadsheetApp();
    }

    getRangeByName(tableNamedRange) {
        const dataRange = new Range(tableNamedRange);
        return dataRange.getMockData() === null ? null : dataRange;
    }

    getSheetByName(sheetTabName) {
        let sheetObj = new Sheet(sheetTabName);
        if (sheetObj.getSheetValues(1, 1, 1, 1) === null)
            return null;
        return sheetObj;
    }

    static getUi() {
        return new Ui();
    }
}

class Ui {
    createMenu(name) {
        return this;
    }

    addItem(dest, func) {
        return this;
    }

    addToUi() {
        return this;
    }
}

class Sheet {
    constructor(sheetName) {
        this.sheetName = sheetName;
    }

    getLastColumn() {
        let data = this.getSheetValues(-1, -1, -1, -1);
        if (data !== null && data.length > 0)
            return data[0].length;

        return -1
    }

    getLastRow() {
        let data = this.getSheetValues(-1, -1, -1, -1);
        if (data !== null && data.length > 0)
            return data.length;

        return -1;
    }

    getSheetValues(startRow, startCol, lastRow, lastColumn) {
        let tester = new SqlTester();

        switch (this.sheetName.toUpperCase()) {
            case "MASTER TRANSACTIONS":
                return tester.masterTransactionsTable();
            default:
                return null;
        }
    }


    getRange(row, col, numRows, numCols) {
        return new Range();
    }
}

class Range {
    constructor(tableNameRange = "") {
        this.tableNameRange = tableNameRange;
    }

    getValues() {
        return this.getMockData();
    }

    getValue() {
        return this.getMockData()
    }

    clearContent() {
        return this;
    }

    clearFormat() {
        return this;
    }

    clear() {
        return this;
    }

    setValues(values) {
        return this;
    }

    setFontWeight(font) {
        return this;
    }

    setFormula(formula) {
        return this;
    }

    setBackground(background) {
        return this;
    }

    setFormulas(formulas) {
        return this;
    }

    //  Set data to be returned for any named range tested.
    getMockData() {
        let tester = new SqlTester();

        switch (this.tableNameRange.toUpperCase()) {
            case 'STARTINCOMEDATE':
                return '6/7/2019';
            case 'ENDINCOMEDATE':
                return '6/20/2019';
            case "MASTER_TRANSACTIONS":
            case "MASTER TRANSACTIONS!$A$1:$I":
            case "MASTER TRANSACTIONS!$A$1:$I30":
                return tester.masterTransactionsTable();
            case 'ACCOUNTNAMESDATA':
                return tester.bookTable();
            default:
                return null;
        }
    }
}

class Utilities {
    static sleep(seconds) {
        const startTime = new Date().getTime();

        const waitMs = seconds * 1000;
        while (new Date().getTime() - startTime < waitMs) {
            //  waiting...
        }
    }

    static formatDate(srcDate, option, format) {
        return srcDate;
    }
}


class Logger {
    static log(msg) {
        console.log(msg);
    }
}
//  *** DEBUG END ***/

/**
 * Runs all tests and reports back the result of the tests.
 * @customfunction
 */
function SQLselfTest() {
    const success = testerSql() ? "Success" : "Failed";

    return [[success]];
}

function SqlLiveDataTest() {
    let tester = new SqlTester();

    tester.liveTest1();
    tester.liveTest2();
}

/**
 * Function should be commented out when NOT running in a TEST SHEET.
 * It will create a menu option that allows you to create a gsSQL() 
 * statement for every test SQL in TestSQL().
 */
function onOpen() {
    if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName("gsSqlTest") === null) {
        //  Only create menu option on test sheet.
        return true;
    }

    // This line calls the SpreadsheetApp and gets its UI   
    // Or DocumentApp or FormApp.
    const ui = SpreadsheetApp.getUi();

    //These lines create the menu items and 
    // tie them to functions we will write in Apps Script

    ui.createMenu('gsSQL Options')
        .addItem('Generate Tests on TDD SHEET !!!', 'customMenuGenerateTests')
        .addToUi();
}

/**
 * @type {TestedStatements[]}
 */
let sqlTestCases = [];

/**
 * Expected to be run as a menu item.
 * Runs all internal tests, collects the SQL from each test and generates
 * a =gsSQL() string and writes it to the current active screen.
 * Each customfunction is written in column A, starting two rows below the
 * last row in the current sheet.  Room is left after the expected results
 * and the subsequent gsSQL() will be updated 3 rows after.
 */
function customMenuGenerateTests() {
    sqlTestCases = [];      //  Reset collected test case array.
    testerSql();
    TestSql.generateTestCustomFunctions();
}

/**
 * 
 * @param {String} functionName 
 * @param {any[][]} array1 
 * @param {any[][]} array2 
 * @returns {String[][]}
 * @customfunction
 */
function isEqual(functionName, array1, array2) {
    const test = new SqlTester();
    const status = test.isEqual(functionName, array1, array2) ? "Equal" : "Not Equal";

    const results = [];
    results.push([functionName]);
    results.push([status]);

    return results;
}

class TestedStatements {
    /**
     * 
     * @param {String} statement 
     * @param {any[]} bindVariables 
     * @param {any[][]} data 
     * @param {Map<String,Table>} tables
     * @param {Boolean} generateColumnTitles
     */
    constructor(statement, bindVariables, data, tables, generateColumnTitles) {
        this.statement = statement;
        this.bindVariables = bindVariables;
        this.expectedOutputlines = data.length;
        this.data = data;
        this.tables = tables;
        this.generateColumnTitles = generateColumnTitles;
        this.generateTableDefinition = false;

        // @ts-ignore
        for (let tableInfo of this.tables.values()) {
            if (!tableInfo.hasColumnTitle)
                this.generateTableDefinition = true;
        }
    }

    /**
     * 
     * @returns {String}
     */
    getTableDefinitionString() {
        let definition = "{";
        let tabDef = "";

        // @ts-ignore
        for (let table of this.tables.values()) {
            let rangeName = table.tableName;
            if (table.tableData.length > 0) {
                const tableUtil = new Table("");
                rangeName += "!A2:" + tableUtil.numberToSheetColumnLetter(table.tableData[0].length)
            }

            if (tabDef !== "") {
                tabDef += ";";
            }

            tabDef += "{";

            tabDef += '"' + table.tableName + '",';
            tabDef += '"' + rangeName + '",';
            tabDef += "60, " + table.hasColumnTitle.toString();

            tabDef += "}";
        }

        definition += tabDef + "}";
        return definition;
    }
}

class TestSql extends Sql {
    constructor() {
        super();
    }

    /**
     * 
     * @param {String} stmt 
     * @returns {any[][]}
     */
    execute(stmt) {
        let bindings = [...super.getBindData()];
        let tables = super.getTables();
        let generateColumnTitles = super.areColumnTitlesOutput();

        const data = super.execute(stmt);

        let test = new TestedStatements(stmt, bindings, data, tables, generateColumnTitles);

        sqlTestCases.push(test);

        return data;
    }

    static generateTestCustomFunctions() {
        let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TDD");

        if (sheet === null) {
            Logger.log("Invalid SHEET.  'TDD' not found.");
            return;
        }

        const SUMMARY_ITEMS_PER_ROW = 10;
        const SHEET_HEADER_ROWS = 6;

        //  Clear out old tests.
        sheet.getRange(SHEET_HEADER_ROWS, 1, sheet.getLastRow(), sheet.getLastColumn()).clearContent().clearFormat().clear();

        const rowsForSummary = Math.ceil(sqlTestCases.length / SUMMARY_ITEMS_PER_ROW) * 3;
        const summaryTestResults = [];
        let summaryTestResultRow = [];
        let blankRow = [];

        let testCount = 1;

        let lastRow = sheet.getLastRow() + 3 + rowsForSummary;

        for (const testCase of sqlTestCases) {
            let descriptionRange = sheet.getRange(lastRow - 1, 1, 1, 2);
            let testNumber = "Test  #" + testCount;

            let descriptionRow = [[testNumber, testCase.statement]];
            descriptionRange.setValues(descriptionRow);
            descriptionRange.setFontWeight("bold");

            let formula = TestSql.makeCustomFormulaString(testCase);

            let formulaRange = sheet.getRange(lastRow, 1);
            formulaRange.setFormula(formula);

            //  Write out expected results.
            if (testCase.data.length > 0) {
                let expectedRange = sheet.getRange(lastRow, 3 + testCase.data[0].length, testCase.data.length, testCase.data[0].length);
                // expectedRange.setNumberFormat("@");
                expectedRange.setValues(testCase.data);
                expectedRange.setFontWeight("bold").setBackground("yellow");

                let resultsRange = sheet.getRange(lastRow, 1, testCase.data.length, testCase.data[0].length);
                resultsRange.setBackground("cyan");
                let resultFormula = TestSql.makeTestResultFormulaString(testCount, resultsRange, expectedRange);
                summaryTestResultRow.push(resultFormula);
                blankRow.push("");
                if (summaryTestResultRow.length >= SUMMARY_ITEMS_PER_ROW) {
                    summaryTestResults.push(summaryTestResultRow);
                    summaryTestResults.push(blankRow);
                    summaryTestResults.push(blankRow);
                    summaryTestResultRow = [];
                    blankRow = [];
                }
            }

            lastRow = lastRow + testCase.expectedOutputlines + 3;
            testCount++;
        }

        if (summaryTestResultRow.length > 0) {
            while (summaryTestResultRow.length < SUMMARY_ITEMS_PER_ROW) {
                summaryTestResultRow.push("");
            }
            summaryTestResults.push(summaryTestResultRow);
        }

        if (summaryTestResults.length > 0) {
            Logger.log(`Items=${summaryTestResults.length}. Cols=${summaryTestResults[0].length}`);
            let summaryRange = sheet.getRange(SHEET_HEADER_ROWS, 1, summaryTestResults.length, summaryTestResults[0].length);
            summaryRange.setFormulas(summaryTestResults);
        }
    }

    /**
     * 
     * @param {TestedStatements} testCase 
     * @returns {String}
     */
    static makeCustomFormulaString(testCase) {
        let tableDefinitionString = "";
        if (testCase.generateTableDefinition) {
            tableDefinitionString = testCase.getTableDefinitionString();
        }

        let formula = '=gsSQL("' + testCase.statement + '"';

        if (testCase.bindVariables.length > 0 || !testCase.generateColumnTitles) {
            formula += "," + tableDefinitionString + ", " + testCase.generateColumnTitles.toString();
            for (const bindData of testCase.bindVariables) {
                formula += ", ";
                if (typeof bindData === 'string') {
                    formula += '"' + bindData + '"';
                }
                else if (bindData instanceof Date) {
                    formula += '"' + Utilities.formatDate(bindData, "GMT+1", "MM/dd/yyyy") + '"';
                }
                else {
                    formula += bindData;
                }
            }
        }
        else if (tableDefinitionString !== "") {
            formula += "," + tableDefinitionString + ", true";
        }

        formula += ')';

        return formula;
    }

    static makeTestResultFormulaString(testNumber, rangeResults, rangeExpected) {
        let formula = '=isEqual("Test #' + testNumber.toString() + '"';

        formula += "," + rangeResults.getA1Notation();
        formula += "," + rangeExpected.getA1Notation();
        formula += ")";

        return formula;
    }
}

class SqlTester {
    /*
    LOAD DATA INFILE '/home/cdemmings/Projects/Sheets/CanadianRetirementPlanner/SQL/csv/books.csv'
    INTO TABLE books
    FIELDS 
        TERMINATED BY ', '
        ENCLOSED BY '\"'
        ESCAPED BY ''
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
    */

    /* CREATE TABLE books (id CHAR(6), title VARCHAR(200),
        type VARCHAR(20), author_id CHAR(6), editor_id CHAR(6), translator_id CHAR(6));
    */
    bookTable(extraRecords = 0) {
        let recs = [
            ["id", "title", "type", "author id", "editor id", "translator id"],
            ["1", "Time to Grow Up!", "original", "11", "21", ""],
            ["2", "Your Trip", "translated", "15", "22", "32"],
            ["3", "Lovely Love", "original", "14", "24", ""],
            ["4", "Dream Your Life", "original", "11", "24", ""],
            ["5", "Oranges", "translated", "12", "25", "31"],
            ["6", "Your Happy Life", "translated", "15", "22", "33"],
            ["7", "Applied AI", "translated", "13", "23", "34"],
            ["9", "Book with Mysterious Author", "translated", "1", "23", "34"],
            ["8", "My Last Book", "original", "11", "28", ""]
        ];

        for (let i = 0; i < extraRecords; i++) {
            let newRecord = [];

            newRecord.push((10 + i).toString());
            newRecord.push("Great Boook volume " + (1 + i).toString());
            newRecord.push(i % 2 === 0 ? "original" : "translated");
            newRecord.push((11 + i).toString());
            newRecord.push((12 + i).toString());
            newRecord.push((13 + i).toString());

            recs.push(newRecord);
        }

        return recs;
    }

    /*
    LOAD DATA INFILE '/home/cdemmings/Projects/Sheets/CanadianRetirementPlanner/SQL/csv/booksales.csv'
    INTO TABLE booksales
    FIELDS 
        TERMINATED BY ', '
        ENCLOSED BY '\"'
        ESCAPED BY ''
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
    */

    /* CREATE TABLE booksales (invoice CHAR(6), book_id CHAR(6),
        customer_id CHAR(6), quantity integer, price double, date date);
    */
    bookSalesTable(extraRecords = 0) {
        let recs = [
            ["Invoice", "Book Id", "Customer ID", "Quantity", "Price", "Date"],
            ["I7200", "9", "C1", 10, 34.95, "05/01/2022"],
            ["I7201", "8", "C2", 3, 29.95, "05/01/2022"],
            ["I7201", "7", "C2", 5, 18.99, "05/01/2022"],
            ["I7202", "9", "C3", 1, 59.99, "05/02/2022"],
            ["I7203", "1", "", 1, 90, "05/02/2022"],
            ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
            ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
            ["I7204", "4", "C4", 50, 19.99, "05/03/2022"],
            ["I7205", "7", "C1", 1, 33.97, "05/04/2022"],
            ["I7206", "7", "C2", 100, 17.99, "05/04/2022"]
        ];

        for (let i = 0; i < extraRecords; i++) {
            let newRecord = [];

            newRecord.push("I" + (707 + i).toString());
            newRecord.push((10 + i).toString());
            newRecord.push("C" + (5 + i).toString());
            newRecord.push(i % 100);
            newRecord.push(i % 100 + 1 / (i % 99 === 0 ? 99 : i % 99));
            newRecord.push((1 + i % 12).toString() + "/" + (i % 28).toString() + "/" + (2022 + i % 50).toString());

            recs.push(newRecord);
        }

        return recs;
    }

    /*
    LOAD DATA INFILE '/home/cdemmings/Projects/Sheets/CanadianRetirementPlanner/SQL/csv/bookreturns.csv'
    INTO TABLE bookreturns
    FIELDS 
        TERMINATED BY ', '
        ENCLOSED BY '\"'
        ESCAPED BY ''
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
    */

    /* CREATE TABLE bookreturns (rma CHAR(7), book_id CHAR(6),
        customer_id CHAR(6), quantity integer, price double, date date);
    */
    bookReturnsTable() {
        return [
            ["RMA", "Book Id", "Customer ID", "Quantity", "Price", "Date"],
            ["Rma001", "9", "c1", 10, 34.95, "05/01/2022"],
            ["rma020", "8", "c2", 3, 29.95, "05/01/2022"],
            ["rmA030", "7", "c2", 5, 18.99, "05/01/2022"],
            ["RMA040", "9", "c3", 1, 59.99, "05/02/2022"],
            ["rma005", "1", "c1", 1, 90, "05/02/2022"],
            ["RMA600", "2", "c4", 100, 65.49, "05/03/2022"],
            ["Rma701", "3", "c4", 150, 24.95, "05/03/2022"],
            ["RmA800", "4", "c4", 50, 19.99, "05/03/2022"],
            ["RMA900", "7", "c1", 1, 33.97, "05/04/2022"],
            ["rma1010", "7", "c2", 100, 17.99, "05/04/2022"]
        ];

    }

    /*
    LOAD DATA INFILE '/home/cdemmings/Projects/Sheets/CanadianRetirementPlanner/SQL/csv/customers.csv'
    INTO TABLE customers
    FIELDS 
        TERMINATED BY ', '
        ENCLOSED BY '\"'
        ESCAPED BY ''
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
    */

    /* CREATE TABLE customers (id CHAR(6), name VARCHAR(100),
        address VARCHAR(200), city VARCHAR(50), phone CHAR(20), email VARCHAR(200));
    */
    customerTable() {
        return [
            ["ID", "Name", "Address", "City", "Phone", "eMail"],
            ["C1", "Numereo Uno", "101 One Way", "One Point City", "9051112111", "bigOne@gmail.com"],
            ["C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com"],
            ["C3", "Tres Buon Goods", "3 Way St", "Tres City", "5193133303", "thrice@hotmail.com"],
            ["C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com"],
            ["C5", "Fe Fi Fo Giant Tiger", "5 ohFive St.", "FifthDom", "4165551234", "   fiver@gmail.com"],
            ["C6", "Sx in Cars", "6 Seventh St", "Sx City", "6661116666", "gotyourSix@hotmail.com   "],
            ["C7", "7th Heaven", "7 Eight Crt.", "Lucky City", "5551117777", " timesAcharm@gmail.com "]
        ];

    }

    /*
    LOAD DATA INFILE '/home/cdemmings/Projects/Sheets/CanadianRetirementPlanner/SQL/csv/authors.csv'
    INTO TABLE authors
    FIELDS 
        TERMINATED BY ', '
        ENCLOSED BY '\"'
        ESCAPED BY ''
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
    */

    /* CREATE TABLE authors (id CHAR(6), first_name VARCHAR(100),
        last_name VARCHAR(200));
    */
    authorsTable() {
        return [
            ["id", "first_name", "last_name"],
            ["11", "Ellen", "Writer"],
            ["12", "Olga", "Savelieva"],
            ["13", "Jack", "Smart"],
            ["14", "Donald", "Brain"],
            ["15", "Yao", "Dou"]
        ];
    }

    /*
    LOAD DATA INFILE '/home/cdemmings/Projects/Sheets/CanadianRetirementPlanner/SQL/csv/editors.csv'
    INTO TABLE editors
    FIELDS 
        TERMINATED BY ', '
        ENCLOSED BY '\"'
        ESCAPED BY ''
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
    */

    /* CREATE TABLE editors (id CHAR(6), first_name VARCHAR(100),
        last_name VARCHAR(200));
    */
    editorsTable() {
        return [
            ["id", "first name", "last name"],
            ["13", "Jack", "Smart"],
            ["21", "Daniel", "Brown"],
            ["22", "Mark", "Johnson"],
            ["23", "Maria", "Evans"],
            ["24", "Cathrine", "Roberts"],
            ["25", "Sebastian", "Wright"],
            ["26", "Barbara", "Jones"],
            ["27", "Matthew", "Smith"],
            ["50", "Jack", "Dumb"],
            ["51", "Daniel", "Smart"]
        ];
    }


    /*
    LOAD DATA INFILE '/home/cdemmings/Projects/Sheets/CanadianRetirementPlanner/SQL/csv/translators.csv'
    INTO TABLE translators
    FIELDS 
        TERMINATED BY ', '
        ENCLOSED BY '\"'
        ESCAPED BY ''
    LINES TERMINATED BY '\n'
    IGNORE 1 ROWS;
    */

    /* CREATE TABLE translators (id CHAR(6), first_name VARCHAR(100),
        last_name VARCHAR(200));
    */
    translatorsTable() {
        return [
            ["id", "first_name", "last_name"],
            ["31", "Ira", "Davies"],
            ["32", "Ling", "Weng"],
            ["33", "Kristian", "Green"],
            ["34", "Roman", "Edwards"]
        ];

    }

    masterTransactionsTable() {
        return [
            ["Name of Institution", "Transaction Date", "Description 1", "Description 2", "Amount", "Expense Category", "Account", "Gross", "Balance"],
            ["Royal Bank of Canada", new Date("6/7/2019"), "Interac purchase - 3707 NADIM'S NO FRIL", "", -47.85, "Food & Dining - Groceries", "", "", ""],
            ["Royal Bank of Canada", new Date("6/7/2019"), "Interac purchase - 2357 FRESHCO 3826", "", -130.36, "Food & Dining - Groceries", "", "", ""],
            ["Royal Bank of Canada", new Date("6/7/2019"), "Payroll Deposit WEST UNIFIED CO", "", 2343.48, "Income - Paycheck", "", "", ""],
            ["Royal Bank of Canada", new Date("6/7/2019"), "MBNA-MASTERCARD", "", -500, "Transfer - CC", "", "", ""],
            ["Royal Bank of Canada", new Date("6/7/2019"), "e-Transfer sent S.E", "", -575, "Utilities - Rent", "", "", ""],
            ["Royal Bank of Canada", new Date("6/11/2019"), "Insurance ADMIN.BY GWL", "", 122.4, "Health & Fitness - Health Insurance", "", "", ""],
            ["Royal Bank of Canada", new Date("6/13/2019"), "Misc Payment GOODLIFE CLUBS", "", -24.85, "Health & Fitness - Gym", "", "", ""],
            ["Royal Bank of Canada", new Date("6/13/2019"), "WHITBY TAXES", "", -100, "Taxes - Property Tax", "", "", ""],
            ["Royal Bank of Canada", new Date("6/13/2019"), "Online Transfer to Deposit Account-***9", "", -15, "Transfer - Savings acct", "", "", ""],
            ["Royal Bank of Canada", new Date("6/14/2019"), "Interac purchase - 8727 NADIM'S NO FRIL", "", -86.73, "Food & Dining - Groceries", "", "", ""],
            ["Royal Bank of Canada", new Date("6/14/2019"), "Insurance ADMIN.BY GWL", "", 300, "Health & Fitness - Dentist", "", "", ""],
            ["Royal Bank of Canada", new Date("6/17/2019"), "Interac purchase - 0238 BAMIYAN KABOB", "", -12.98, "Food & Dining - Restaurants", "", "", ""],
            ["Royal Bank of Canada", new Date("6/17/2019"), "Interac purchase - 1236 NADIM'S NO FRIL", "", -33.32, "Food & Dining - Groceries", "", "", ""],
            ["Royal Bank of Canada", new Date("6/17/2019"), "Deposit ONLINE TRANSFER", "", 12000, "Transfer - Savings acct", "", "", ""],
            ["Royal Bank of Canada", new Date("6/18/2019"), "MBNA-MASTERCARD", "", -1100, "Transfer - CC", "", "", ""],
            ["MBNA Mastercard", new Date("6/19/2019"), "PAYMENT", "", 1100, "Transfer - Savings acct", "", "", ""],
            ["Royal Bank of Canada", new Date("6/19/2019"), "Utility Bill Pmt Enbridge Gas", "", -108, "Utilities - Heating (Gas)", "", "", ""],
            ["MBNA Mastercard", new Date("6/20/2019"), "JOE'S NO FRILLS 3141 WHITBY ON", "", -41.77, "Food & Dining - Groceries", "", "", ""],
            ["MBNA Mastercard", new Date("6/20/2019"), "PIONEER STN#200 WHITBY ON", "", -28.17, "Auto - Fuel", "", "", ""],
            ["MBNA Mastercard", new Date("6/20/2019"), "AVIVA GENERAL INSURANC MARKHAM ON", "", -137.93, "Utilities - Insurance", "", "", ""],
            ["MBNA Mastercard", new Date("6/20/2019"), "AVIVA GENERAL INSURANC MARKHAM ON", "", -307.73, "Auto - Insurance", "", "", ""],
            ["Royal Bank of Canada", new Date("6/20/2019"), "Misc Payment Archdiocese TO", "", -22, "Gifts & Donations - Donations", "", "", ""],
            ["Royal Bank of Canada", new Date("6/20/2019"), "ELEXICON-WHITBY", "", -95, "Utilities - Electricity", "", "", ""],
            ["Royal Bank of Canada", new Date("6/20/2019"), "WHITBY TAXES", "", -100, "Taxes - Property Tax", "", "", ""]
        ];
    }

    yearlySalesTable() {
        return [
            ["Name", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            ["Chris", 50, "", "", "", 60, "", "", "", "", "", "", ""],
            ["Fred", "", "", "", "", "", "", 20, 30, "", "", "", ""],
            ["Dan", "", "", "", "", "", 10, 20, 31, "", "", "", ""],
            ["Kev", "", 10, 20, "", 60, "", "", "", "", "", "", ""],
            ["Dori", "", "", "", "", "", "", "", "", "", "", "", 50],
            ["Gab", 50, "", "", "", 60, "", "", 10, "20", "", "", ""]
        ]
    }

    selectAll1() {
        return this.selectAllAuthors("selectAll1", "select * from authors");
    }

    selectAllCase1() {
        return this.selectAllAuthors("selectAllCase1", "Select * from authors");
    }

    selectIsNotNull1() {
        return this.selectAllAuthors("selectIsNotNull1", "select * from authors where id is not null");
    }

    selectAllAuthors(functionName, stmt) {
        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["AUTHORS.ID", "AUTHORS.FIRST_NAME", "AUTHORS.LAST_NAME"],
        ["11", "Ellen", "Writer"],
        ["12", "Olga", "Savelieva"],
        ["13", "Jack", "Smart"],
        ["14", "Donald", "Brain"],
        ["15", "Yao", "Dou"]];

        return this.isEqual(functionName, data, expected);
    }

    selectIsNull1() {
        let stmt = "select * from authors where id is null";

        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["AUTHORS.ID", "AUTHORS.FIRST_NAME", "AUTHORS.LAST_NAME"]];

        return this.isEqual("selectIsNull1", data, expected);
    }


    innerJoin1a() {
        let stmt = "SELECT books.id, books.title, authors.first_name, authors.last_name " +
            "FROM books " +
            "INNER JOIN authors " +
            "ON books.author_id = authors.id " +
            "ORDER BY books.id";

        return this.innerJoin1(stmt, "innerJoin1a");
    }

    innerJoin1case() {
        let stmt = "SELECT books.id, books.title, authors.first_name, authors.last_name " +
            "FROM books " +
            "Inner Join authors " +
            "ON books.author_id = authors.id " +
            "ORDER BY books.id";

        return this.innerJoin1(stmt, "innerJoin1case");
    }

    innerJoin1(stmt, funcName) {
        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "authors.first_name", "authors.last_name"],
        ["1", "Time to Grow Up!", "Ellen", "Writer"],
        ["2", "Your Trip", "Yao", "Dou"],
        ["3", "Lovely Love", "Donald", "Brain"],
        ["4", "Dream Your Life", "Ellen", "Writer"],
        ["5", "Oranges", "Olga", "Savelieva"],
        ["6", "Your Happy Life", "Yao", "Dou"],
        ["7", "Applied AI", "Jack", "Smart"],
        ["8", "My Last Book", "Ellen", "Writer"]];

        return this.isEqual(funcName, data, expected);
    }

    innerJoin2() {
        let stmt = "SELECT books.id, books.title, books.type, authors.last_name, " +
            "translators.last_name " +
            "FROM books " +
            "INNER JOIN authors " +
            "ON books.author_id = authors.id " +
            "INNER JOIN translators " +
            "ON books.translator_id = translators.id " +
            "ORDER BY books.id";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("translators", this.translatorsTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "books.type", "authors.last_name", "translators.last_name"],
        ["2", "Your Trip", "translated", "Dou", "Weng"],
        ["5", "Oranges", "translated", "Savelieva", "Davies"],
        ["6", "Your Happy Life", "translated", "Dou", "Green"],
        ["7", "Applied AI", "translated", "Smart", "Edwards"]];

        return this.isEqual("innerJoin2", data, expected);
    }

    innerJoinAlias1() {
        let stmt = "SELECT b.id, b.title, a.first_name, a.last_name " +
            "FROM books as b " +
            "INNER JOIN authors as a " +
            "ON b.author_id = a.id " +
            "ORDER BY books.id";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["b.id", "b.title", "a.first_name", "a.last_name"],
        ["1", "Time to Grow Up!", "Ellen", "Writer"],
        ["2", "Your Trip", "Yao", "Dou"],
        ["3", "Lovely Love", "Donald", "Brain"],
        ["4", "Dream Your Life", "Ellen", "Writer"],
        ["5", "Oranges", "Olga", "Savelieva"],
        ["6", "Your Happy Life", "Yao", "Dou"],
        ["7", "Applied AI", "Jack", "Smart"],
        ["8", "My Last Book", "Ellen", "Writer"]];

        return this.isEqual("innerJoinAlias1", data, expected);
    }

    innerJoinAlias2() {
        let stmt = "SELECT b.id, b.title, a.first_name, a.last_name " +
            "FROM books as b " +
            "INNER JOIN authors as a " +
            "ON b.author_id = a.id " +
            "ORDER BY books.id";

        let testSQL = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true);

        let data = testSQL.execute(stmt);

        let expected = [["b.id", "b.title", "a.first_name", "a.last_name"],
        ["1", "Time to Grow Up!", "Ellen", "Writer"],
        ["2", "Your Trip", "Yao", "Dou"],
        ["3", "Lovely Love", "Donald", "Brain"],
        ["4", "Dream Your Life", "Ellen", "Writer"],
        ["5", "Oranges", "Olga", "Savelieva"],
        ["6", "Your Happy Life", "Yao", "Dou"],
        ["7", "Applied AI", "Jack", "Smart"],
        ["8", "My Last Book", "Ellen", "Writer"]];

        this.isEqual("innerJoinAlias2a", data, expected);

        stmt = "SELECT b1.id, b1.title, a2.first_name, a2.last_name " +
            "FROM books as b1 " +
            "INNER JOIN authors as a2 " +
            "ON b1.author_id = a2.id " +
            "ORDER BY books.id";
        data = testSQL.execute(stmt);

        expected = [["b1.id", "b1.title", "a2.first_name", "a2.last_name"],
        ["1", "Time to Grow Up!", "Ellen", "Writer"],
        ["2", "Your Trip", "Yao", "Dou"],
        ["3", "Lovely Love", "Donald", "Brain"],
        ["4", "Dream Your Life", "Ellen", "Writer"],
        ["5", "Oranges", "Olga", "Savelieva"],
        ["6", "Your Happy Life", "Yao", "Dou"],
        ["7", "Applied AI", "Jack", "Smart"],
        ["8", "My Last Book", "Ellen", "Writer"]];

        return this.isEqual("innerJoinAlias2b", data, expected);
    }

    join2a() {
        let stmt = "SELECT books.id, books.title, books.type, translators.last_name  " +
            "FROM books " +
            "JOIN translators " +
            "ON books.translator_id = translators.id " +
            "ORDER BY books.id";

        return this.join2(stmt, "join2a");
    }
    join2b() {
        let stmt = "sElEcT books.id, books.title, books.type, translators.last_name  " +
            "froM books " +
            "Join translators " +
            "On books.translator_id = translators.id " +
            "ORDEr  By books.id";

        return this.join2(stmt, "join2b");
    }

    join2(stmt, funcName) {

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("translators", this.translatorsTable())
            .enableColumnTitle(true)
            .execute(stmt)

        let expected = [["books.id", "books.title", "books.type", "translators.last_name"],
        ["2", "Your Trip", "translated", "Weng"],
        ["5", "Oranges", "translated", "Davies"],
        ["6", "Your Happy Life", "translated", "Green"],
        ["7", "Applied AI", "translated", "Edwards"],
        ["9", "Book with Mysterious Author", "translated", "Edwards"]];

        return this.isEqual(funcName, data, expected);
    }

    join3() {
        let stmt = "SELECT books.id, books.title, editors.last_name " +
            "FROM books " +
            "LEFT JOIN editors " +
            "ON books.editor_id = editors.id " +
            "ORDER BY books.id";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "editors.last_name"],
        ["1", "Time to Grow Up!", "Brown"],
        ["2", "Your Trip", "Johnson"],
        ["3", "Lovely Love", "Roberts"],
        ["4", "Dream Your Life", "Roberts"],
        ["5", "Oranges", "Wright"],
        ["6", "Your Happy Life", "Johnson"],
        ["7", "Applied AI", "Evans"],
        ["8", "My Last Book", null],
        ["9", "Book with Mysterious Author", "Evans"]];

        return this.isEqual("join3", data, expected);
    }

    joinLimit1() {
        let stmt = "SELECT books.id, books.title, editors.last_name " +
            "FROM books " +
            "LEFT JOIN editors " +
            "ON books.editor_id = editors.id " +
            "ORDER BY books.id " +
            "LIMIT 5";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "editors.last_name"],
        ["1", "Time to Grow Up!", "Brown"],
        ["2", "Your Trip", "Johnson"],
        ["3", "Lovely Love", "Roberts"],
        ["4", "Dream Your Life", "Roberts"],
        ["5", "Oranges", "Wright"]];

        return this.isEqual("joinLimit1", data, expected);
    }

    leftJoin1() {
        let stmt = "SELECT books.id, books.title, books.type, authors.last_name, " +
            "translators.last_name " +
            "FROM books " +
            "LEFT JOIN authors " +
            "ON books.author_id = authors.id " +
            "LEFT JOIN translators " +
            "ON books.translator_id = translators.id " +
            "ORDER BY books.id";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("translators", this.translatorsTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "books.type", "authors.last_name", "translators.last_name"],
        ["1", "Time to Grow Up!", "original", "Writer", null],
        ["2", "Your Trip", "translated", "Dou", "Weng"],
        ["3", "Lovely Love", "original", "Brain", null],
        ["4", "Dream Your Life", "original", "Writer", null],
        ["5", "Oranges", "translated", "Savelieva", "Davies"],
        ["6", "Your Happy Life", "translated", "Dou", "Green"],
        ["7", "Applied AI", "translated", "Smart", "Edwards"],
        ["8", "My Last Book", "original", "Writer", null],
        ["9", "Book with Mysterious Author", "translated", null, "Edwards"]];

        return this.isEqual("leftJoin1", data, expected);
    }

    rightJoin1() {
        let stmt = "SELECT books.id, books.title, editors.last_name, editors.id  " +
            "FROM books " +
            "RIGHT JOIN editors " +
            "ON books.editor_id = editors.id " +
            "ORDER BY books.id";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "editors.last_name", "editors.id"],
        [null, null, "Smart", "13"],
        [null, null, "Jones", "26"],
        [null, null, "Smith", "27"],
        [null, null, "Dumb", "50"],
        [null, null, "Smart", "51"],
        ["1", "Time to Grow Up!", "Brown", "21"],
        ["2", "Your Trip", "Johnson", "22"],
        ["3", "Lovely Love", "Roberts", "24"],
        ["4", "Dream Your Life", "Roberts", "24"],
        ["5", "Oranges", "Wright", "25"],
        ["6", "Your Happy Life", "Johnson", "22"],
        ["7", "Applied AI", "Evans", "23"],
        ["9", "Book with Mysterious Author", "Evans", "23"]];

        return this.isEqual("rightJoin1", data, expected);
    }

    rightJoin1a() {
        let stmt = "SELECT books.id, books.title, editors.last_name, editors.id  " +
            "FROM books " +
            "right join editors on  editors.id = books.editor_id " +
            "ORDER BY books.id";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "editors.last_name", "editors.id"],
        [null, null, "Smart", "13"],
        [null, null, "Jones", "26"],
        [null, null, "Smith", "27"],
        [null, null, "Dumb", "50"],
        [null, null, "Smart", "51"],
        ["1", "Time to Grow Up!", "Brown", "21"],
        ["2", "Your Trip", "Johnson", "22"],
        ["3", "Lovely Love", "Roberts", "24"],
        ["4", "Dream Your Life", "Roberts", "24"],
        ["5", "Oranges", "Wright", "25"],
        ["6", "Your Happy Life", "Johnson", "22"],
        ["7", "Applied AI", "Evans", "23"],
        ["9", "Book with Mysterious Author", "Evans", "23"]];

        return this.isEqual("rightJoin1a", data, expected);
    }

    rightJoin2() {
        let stmt = "SELECT books.id, books.title, books.translator_id, " +
            "editors.last_name, editors.id,  " +
            "translators.last_name " +
            "FROM books " +
            "RIGHT JOIN editors " +
            "ON books.editor_id = editors.id " +
            "RIGHT JOIN translators " +
            "ON books.translator_id = translators.id " +
            "ORDER BY books.id";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("translators", this.translatorsTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "books.translator_id", "editors.last_name", "editors.id", "translators.last_name"],
        ["2", "Your Trip", "32", "Johnson", "22", "Weng"],
        ["5", "Oranges", "31", "Wright", "25", "Davies"],
        ["6", "Your Happy Life", "33", "Johnson", "22", "Green"],
        ["7", "Applied AI", "34", "Evans", "23", "Edwards"],
        ["9", "Book with Mysterious Author", "34", "Evans", "23", "Edwards"]];

        return this.isEqual("rightJoin2", data, expected);
    }

    fullJoin1() {
        let stmt = "SELECT authors.id, authors.last_name, editors.id, editors.last_name " +
            "FROM authors " +
            "FULL JOIN editors " +
            "ON authors.id = editors.id ";

        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["authors.id", "authors.last_name", "editors.id", "editors.last_name"],
        ["11", "Writer", null, null],
        ["12", "Savelieva", null, null],
        ["13", "Smart", "13", "Smart"],
        ["14", "Brain", null, null],
        ["15", "Dou", null, null],
        [null, null, "21", "Brown"],
        [null, null, "22", "Johnson"],
        [null, null, "23", "Evans"],
        [null, null, "24", "Roberts"],
        [null, null, "25", "Wright"],
        [null, null, "26", "Jones"],
        [null, null, "27", "Smith"],
        [null, null, "50", "Dumb"],
        [null, null, "51", "Smart"]];

        return this.isEqual("fullJoin1", data, expected);
    }

    //  FULL JOIN not supported in mySQL - so no comparison is possible.
    fullJoin2() {
        let stmt = "SELECT *, customers.address, customers.id, customers.name " +
            "FROM booksales " +
            "FULL JOIN customers " +
            "ON customer_id = customers.id ";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE", "CUSTOMERS.ID", "CUSTOMERS.NAME", "CUSTOMERS.ADDRESS", "CUSTOMERS.CITY", "CUSTOMERS.PHONE", "CUSTOMERS.EMAIL", "customers.address", "customers.id", "customers.name"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022", "C1", "Numereo Uno", "101 One Way", "One Point City", "9051112111", "bigOne@gmail.com", "101 One Way", "C1", "Numereo Uno"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022", "C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com", "202 Second St.", "C2", "Dewy Tuesdays"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022", "C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com", "202 Second St.", "C2", "Dewy Tuesdays"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022", "C3", "Tres Buon Goods", "3 Way St", "Tres City", "5193133303", "thrice@hotmail.com", "3 Way St", "C3", "Tres Buon Goods"],
        ["I7203", "1", "", 1, 90, "05/02/2022", null, null, null, null, null, null, null, null, null],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com", "40 Four St", "C4", "ForMe Resellers"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com", "40 Four St", "C4", "ForMe Resellers"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com", "40 Four St", "C4", "ForMe Resellers"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022", "C1", "Numereo Uno", "101 One Way", "One Point City", "9051112111", "bigOne@gmail.com", "101 One Way", "C1", "Numereo Uno"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", "C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com", "202 Second St.", "C2", "Dewy Tuesdays"],
        [null, null, null, null, null, null, "C5", "Fe Fi Fo Giant Tiger", "5 ohFive St.", "FifthDom", "4165551234", "   fiver@gmail.com", "5 ohFive St.", "C5", "Fe Fi Fo Giant Tiger"],
        [null, null, null, null, null, null, "C6", "Sx in Cars", "6 Seventh St", "Sx City", "6661116666", "gotyourSix@hotmail.com   ", "6 Seventh St", "C6", "Sx in Cars"],
        [null, null, null, null, null, null, "C7", "7th Heaven", "7 Eight Crt.", "Lucky City", "5551117777", " timesAcharm@gmail.com ", "7 Eight Crt.", "C7", "7th Heaven"]];

        return this.isEqual("fullJoin2", data, expected);
    }

    fullJoin3() {
        let stmt = "SELECT * " +
            "FROM booksales " +
            "FULL JOIN customers " +
            "ON booksales.customer_id = customers.id " +
            "FULL JOIN books " +
            "ON booksales.Book_Id = books.id";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .addTableData("books", this.bookTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE", "CUSTOMERS.ID", "CUSTOMERS.NAME", "CUSTOMERS.ADDRESS", "CUSTOMERS.CITY", "CUSTOMERS.PHONE", "CUSTOMERS.EMAIL", "BOOKS.ID", "BOOKS.TITLE", "BOOKS.TYPE", "BOOKS.AUTHOR_ID", "BOOKS.EDITOR_ID", "BOOKS.TRANSLATOR_ID"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022", "C1", "Numereo Uno", "101 One Way", "One Point City", "9051112111", "bigOne@gmail.com", "9", "Book with Mysterious Author", "translated", "1", "23", "34"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022", "C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com", "8", "My Last Book", "original", "11", "28", ""],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022", "C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com", "7", "Applied AI", "translated", "13", "23", "34"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022", "C3", "Tres Buon Goods", "3 Way St", "Tres City", "5193133303", "thrice@hotmail.com", "9", "Book with Mysterious Author", "translated", "1", "23", "34"],
        ["I7203", "1", "", 1, 90, "05/02/2022", null, null, null, null, null, null, "1", "Time to Grow Up!", "original", "11", "21", ""],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com", "2", "Your Trip", "translated", "15", "22", "32"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com", "3", "Lovely Love", "original", "14", "24", ""],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com", "4", "Dream Your Life", "original", "11", "24", ""],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022", "C1", "Numereo Uno", "101 One Way", "One Point City", "9051112111", "bigOne@gmail.com", "7", "Applied AI", "translated", "13", "23", "34"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", "C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com", "7", "Applied AI", "translated", "13", "23", "34"],
        [null, null, null, null, null, null, "C5", "Fe Fi Fo Giant Tiger", "5 ohFive St.", "FifthDom", "4165551234", "   fiver@gmail.com", null, null, null, null, null, null],
        [null, null, null, null, null, null, "C6", "Sx in Cars", "6 Seventh St", "Sx City", "6661116666", "gotyourSix@hotmail.com   ", null, null, null, null, null, null],
        [null, null, null, null, null, null, "C7", "7th Heaven", "7 Eight Crt.", "Lucky City", "5551117777", " timesAcharm@gmail.com ", null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null, "5", "Oranges", "translated", "12", "25", "31"],
        [null, null, null, null, null, null, null, null, null, null, null, null, "6", "Your Happy Life", "translated", "15", "22", "33"]];

        return this.isEqual("fullJoin3", data, expected);
    }

    whereIn1() {
        let stmt = "SELECT books.id, books.title, books.author_id " +
            "FROM books " +
            "WHERE books.author_id IN (SELECT id from authors)" +
            "ORDER BY books.title";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "books.author_id"],
        ["7", "Applied AI", "13"],
        ["4", "Dream Your Life", "11"],
        ["3", "Lovely Love", "14"],
        ["8", "My Last Book", "11"],
        ["5", "Oranges", "12"],
        ["1", "Time to Grow Up!", "11"],
        ["6", "Your Happy Life", "15"],
        ["2", "Your Trip", "15"]];

        return this.isEqual("whereIn1", data, expected);
    }

    whereIn2() {
        let stmt = "SELECT books.id, books.title, books.author_id " +
            "FROM books " +
            "WHERE books.author_id IN ('11','12') " +
            "ORDER BY books.title";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "books.author_id"],
        ["4", "Dream Your Life", "11"],
        ["8", "My Last Book", "11"],
        ["5", "Oranges", "12"],
        ["1", "Time to Grow Up!", "11"]];

        return this.isEqual("whereIn2", data, expected);
    }

    whereIn3() {
        let stmt = "SELECT id, title, author_id " +
            "FROM books " +
            "WHERE author_id IN (select id from authors where first_name like '%ald') " +
            "ORDER BY title";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["id", "title", "author_id"],
        ["3", "Lovely Love", "14"]];

        return this.isEqual("whereIn3", data, expected);
    }

    whereIn4() {
        let stmt = "SELECT * " +
            "FROM books " +
            "WHERE author_id IN (select id from authors where first_name = ?1) " +
            "or editor_id in (select id from editors where last_name = ?2) " +
            "or title = ?3 " +
            "ORDER BY title";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .addBindParameter('Donald')
            .addBindParameter('Roberts')
            .addBindParameter('Oranges')
            .execute(stmt);

        let expected = [["BOOKS.ID", "BOOKS.TITLE", "BOOKS.TYPE", "BOOKS.AUTHOR_ID", "BOOKS.EDITOR_ID", "BOOKS.TRANSLATOR_ID"],
        ["4", "Dream Your Life", "original", "11", "24", ""],
        ["3", "Lovely Love", "original", "14", "24", ""],
        ["5", "Oranges", "translated", "12", "25", "31"]];

        return this.isEqual("whereIn4", data, expected);
    }

    whereIn5() {
        let stmt = "SELECT * " +
            "FROM books " +
            "WHERE author_id IN (select a.id from authors as a where first_name = ?1) " +
            "or editor_id in (select e.id from editors as e where last_name = ?2) " +
            "or title = ?3 " +
            "ORDER BY title";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .addBindParameter('Donald')
            .addBindParameter('Roberts')
            .addBindParameter('Oranges')
            .execute(stmt);

        let expected = [["BOOKS.ID", "BOOKS.TITLE", "BOOKS.TYPE", "BOOKS.AUTHOR_ID", "BOOKS.EDITOR_ID", "BOOKS.TRANSLATOR_ID"],
        ["4", "Dream Your Life", "original", "11", "24", ""],
        ["3", "Lovely Love", "original", "14", "24", ""],
        ["5", "Oranges", "translated", "12", "25", "31"]];

        return this.isEqual("whereIn5", data, expected);
    }

    whereIn6() {
        let stmt = "SELECT * " +
            "FROM editors " +
            "WHERE first_name IN (' Mark ', 'Maria    ', 'CATHRINE  ', '  jacK') ";

        let data = new TestSql()
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["EDITORS.ID", "EDITORS.FIRST_NAME", "EDITORS.LAST_NAME"],
        ["22", "Mark", "Johnson"],
        ["23", "Maria", "Evans"]];

        return this.isEqual("whereIn6", data, expected);
    }


    whereIn7() {
        let stmt = "select * from booksales where quantity in (select quantity from booksales where price < 30)";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022"]];

        return this.isEqual("whereIn7", data, expected);
    }

    whereNotIn1() {
        let stmt = "SELECT books.id, books.title, books.author_id " +
            "FROM books " +
            "WHERE books.author_id NOT IN (SELECT id from authors)" +
            "ORDER BY books.title";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "books.author_id"],
        ["9", "Book with Mysterious Author", "1"]];

        return this.isEqual("whereNotIn1", data, expected);
    }

    whereAndOr1() {
        let stmt = "select * from bookSales where date > '05/01/2022' AND date < '05/04/2022' OR book_id = '9'";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022"]];

        return this.isEqual("whereAndOr1", data, expected);
    }

    whereAndOr2() {
        let stmt = "select * from bookSales where date > ?1 AND date < ?2 OR book_id = ?3";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .addBindParameter('05/01/2022')
            .addBindParameter('05/04/2022')
            .addBindParameter('9')
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022"]];

        return this.isEqual("whereAndOr2", data, expected);
    }

    whereAndOr3() {
        let stmt = "select * from bookSales where date > ?1 AND date < ?2 OR book_id = ?3";

        let startDate = new Date();
        startDate.setDate(1);
        startDate.setMonth(4);
        startDate.setFullYear(2022);

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .addBindParameter(startDate)
            .addBindParameter('05/04/2022')
            .addBindParameter('9')
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022"]];

        return this.isEqual("whereAndOr3", data, expected);
    }

    whereAndNotEqual2() {
        let stmt = "select * from bookSales where date >= ?1 AND date <= ?2 And book_id <> ?3";
        let func = "whereAndNotEqual2";
        return this.whereAndNotEqual2base(stmt, func);
    }

    whereAndNotEqual3() {
        let stmt = "select * from bookSales where date>=?1 AND date<=?2 And book_id<>?3";
        let func = "whereAndNotEqual3";
        return this.whereAndNotEqual2base(stmt, func);
    }
    whereAndNotEqual2base(stmt, func) {

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .addBindParameter('05/01/2022')
            .addBindParameter('05/04/2022')
            .addBindParameter('9')
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022"]];

        return this.isEqual(func, data, expected);
    }

    selectAgainNewBinds1() {
        let stmt = "select * from bookSales where date > ?1 AND date < ?2 OR book_id = ?3";

        let sqlObj = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .addBindParameter('05/01/2022')
            .addBindParameter('05/04/2022')
            .addBindParameter('9');

        let data = sqlObj.execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022"]];

        let result = this.isEqual("selectAgainNewBinds1a", data, expected);

        data = sqlObj.clearBindParameters()
            .addBindParameter('05/02/2022')
            .addBindParameter('05/04/2022')
            .addBindParameter('9')
            .execute(stmt);

        expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022"]];

        return result && this.isEqual("selectAgainNewBinds1b", data, expected);
    }

    groupBy1() {
        let stmt = "select bookSales.book_id, SUM(bookSales.Quantity) from bookSales group by book_id";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["bookSales.book_id", "SUM(bookSales.Quantity)"],
        ["1", 1],
        ["2", 100],
        ["3", 150],
        ["4", 50],
        ["7", 106],
        ["8", 3],
        ["9", 11]];

        return this.isEqual("groupBy1", data, expected);
    }

    groupBy2() {
        let stmt =
            "select bookSales.customer_id, SUM(bookSales.quantity) FROM booksales " +
            "GROUP BY booksales.customer_id HAVING SUM(bookSales.quantity) > 11";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["bookSales.customer_id", "SUM(bookSales.quantity)"],
        ["C2", 108],
        ["C4", 300]];

        return this.isEqual("groupBy2", data, expected);
    }

    groupBy3() {
        let stmt =
            "select bookSales.customer_id, date, SUM(bookSales.quantity) FROM booksales " +
            "GROUP BY customer_id, date";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["bookSales.customer_id", "date", "SUM(bookSales.quantity)"],
        ["", "05/02/2022", 1],
        ["C1", "05/01/2022", 10],
        ["C1", "05/04/2022", 1],
        ["C2", "05/01/2022", 8],
        ["C2", "05/04/2022", 100],
        ["C3", "05/02/2022", 1],
        ["C4", "05/03/2022", 300]];

        return this.isEqual("groupBy3", data, expected);
    }

    groupBy4() {
        let stmt =
            "select bookSales.customer_id, date, count(customer_id), count(date) FROM booksales " +
            "GROUP BY customer_id, date";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["bookSales.customer_id", "date", "count(customer_id)", "count(date)"],
        ["", "05/02/2022", 1, 1],
        ["C1", "05/01/2022", 1, 1],
        ["C1", "05/04/2022", 1, 1],
        ["C2", "05/01/2022", 2, 2],
        ["C2", "05/04/2022", 1, 1],
        ["C3", "05/02/2022", 1, 1],
        ["C4", "05/03/2022", 3, 3]];

        return this.isEqual("groupBy4", data, expected);
    }


    avgSelect1() {
        let stmt = "select AVG(quantity) from booksales";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["AVG(quantity)"], [42.1]];

        return this.isEqual("avgSelect1", data, expected);
    }

    funcsSelect2() {
        let stmt = "select AVG(quantity), MIN(quantity), MAX(quantity), SUM(quantity), COUNT(quantity) from booksales";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["AVG(quantity)", "MIN(quantity)", "MAX(quantity)", "SUM(quantity)", "COUNT(quantity)"],
        [42.1, 1, 150, 421, 10]];

        return this.isEqual("funcsSelect2", data, expected);
    }

    innerSelect1() {
        let stmt = "SELECT *, customers.name FROM bookSales " +
            "LEFT JOIN customers ON bookSales.customer_ID = customers.ID " +
            "WHERE bookSales.quantity > (select AVG(quantity) from booksales)";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE", "CUSTOMERS.ID", "CUSTOMERS.NAME", "CUSTOMERS.ADDRESS", "CUSTOMERS.CITY", "CUSTOMERS.PHONE", "CUSTOMERS.EMAIL", "customers.name"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com", "ForMe Resellers"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com", "ForMe Resellers"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com", "ForMe Resellers"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", "C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com", "Dewy Tuesdays"]];

        return this.isEqual("innerSelect1", data, expected);
    }

    whereLike1() {
        let stmt = "select * from bookSales " +
            "LEFT JOIN books ON booksales.book_id = books.id " +
            "LEFT JOIN authors on books.author_id = authors.id " +
            "LEFT JOIN editors on books.editor_id = editors.id " +
            "LEFT JOIN customers on bookSales.customer_id = customers.id " +
            "WHERE customers.email LIKE '%gmail.com'";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .addTableData("books", this.bookTable())
            .addTableData("editors", this.editorsTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE", "BOOKS.ID", "BOOKS.TITLE", "BOOKS.TYPE", "BOOKS.AUTHOR_ID", "BOOKS.EDITOR_ID", "BOOKS.TRANSLATOR_ID", "AUTHORS.ID", "AUTHORS.FIRST_NAME", "AUTHORS.LAST_NAME", "EDITORS.ID", "EDITORS.FIRST_NAME", "EDITORS.LAST_NAME", "CUSTOMERS.ID", "CUSTOMERS.NAME", "CUSTOMERS.ADDRESS", "CUSTOMERS.CITY", "CUSTOMERS.PHONE", "CUSTOMERS.EMAIL"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022", "9", "Book with Mysterious Author", "translated", "1", "23", "34", null, null, null, "23", "Maria", "Evans", "C1", "Numereo Uno", "101 One Way", "One Point City", "9051112111", "bigOne@gmail.com"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022", "8", "My Last Book", "original", "11", "28", "", "11", "Ellen", "Writer", null, null, null, "C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022", "7", "Applied AI", "translated", "13", "23", "34", "13", "Jack", "Smart", "23", "Maria", "Evans", "C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022", "7", "Applied AI", "translated", "13", "23", "34", "13", "Jack", "Smart", "23", "Maria", "Evans", "C1", "Numereo Uno", "101 One Way", "One Point City", "9051112111", "bigOne@gmail.com"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", "7", "Applied AI", "translated", "13", "23", "34", "13", "Jack", "Smart", "23", "Maria", "Evans", "C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com"]];

        return this.isEqual("whereLike1", data, expected);
    }

    whereLike2() {
        let stmt = "select books.title as Title, auth.first_name as [First Name], editors.first_name, customers.name, customers.email, booksales.quantity from bookSales as sale" +
            "LEFT JOIN books as bk ON sale.book_id = bk.id " +
            "LEFT JOIN authors as auth on books.author_id = authors.id " +
            "LEFT JOIN editors as ed on books.editor_id = ed.id " +
            "LEFT JOIN customers on bookSales.customer_id = customers.id " +
            "WHERE customers.email LIKE '%gmail.com'";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .addTableData("books", this.bookTable())
            .addTableData("editors", this.editorsTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["Title", "First Name", "editors.first_name", "customers.name", "customers.email", "booksales.quantity"],
        ["Book with Mysterious Author", null, "Maria", "Numereo Uno", "bigOne@gmail.com", 10],
        ["My Last Book", "Ellen", null, "Dewy Tuesdays", "twoguys@gmail.com", 3],
        ["Applied AI", "Jack", "Maria", "Dewy Tuesdays", "twoguys@gmail.com", 5],
        ["Applied AI", "Jack", "Maria", "Numereo Uno", "bigOne@gmail.com", 1],
        ["Applied AI", "Jack", "Maria", "Dewy Tuesdays", "twoguys@gmail.com", 100]];

        return this.isEqual("whereLike2", data, expected);
    }

    whereNotLike1() {
        let stmt = "select * from bookSales " +
            "LEFT JOIN books ON booksales.book_id = books.id " +
            "LEFT JOIN authors on books.author_id = authors.id " +
            "LEFT JOIN editors on books.editor_id = editors.id " +
            "LEFT JOIN customers on bookSales.customer_id = customers.id " +
            "WHERE customers.email NOT LIKE '%gmail.com'";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .addTableData("books", this.bookTable())
            .addTableData("editors", this.editorsTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE", "BOOKS.ID", "BOOKS.TITLE", "BOOKS.TYPE", "BOOKS.AUTHOR_ID", "BOOKS.EDITOR_ID", "BOOKS.TRANSLATOR_ID", "AUTHORS.ID", "AUTHORS.FIRST_NAME", "AUTHORS.LAST_NAME", "EDITORS.ID", "EDITORS.FIRST_NAME", "EDITORS.LAST_NAME", "CUSTOMERS.ID", "CUSTOMERS.NAME", "CUSTOMERS.ADDRESS", "CUSTOMERS.CITY", "CUSTOMERS.PHONE", "CUSTOMERS.EMAIL"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022", "9", "Book with Mysterious Author", "translated", "1", "23", "34", null, null, null, "23", "Maria", "Evans", "C3", "Tres Buon Goods", "3 Way St", "Tres City", "5193133303", "thrice@hotmail.com"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022", "2", "Your Trip", "translated", "15", "22", "32", "15", "Yao", "Dou", "22", "Mark", "Johnson", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022", "3", "Lovely Love", "original", "14", "24", "", "14", "Donald", "Brain", "24", "Cathrine", "Roberts", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022", "4", "Dream Your Life", "original", "11", "24", "", "11", "Ellen", "Writer", "24", "Cathrine", "Roberts", "C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com"]];

        return this.isEqual("whereNotLike1", data, expected);
    }

    union1() {
        let stmt = "select * from authors UNION select * from editors";

        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["AUTHORS.ID", "AUTHORS.FIRST_NAME", "AUTHORS.LAST_NAME"],
        ["11", "Ellen", "Writer"],
        ["12", "Olga", "Savelieva"],
        ["13", "Jack", "Smart"],
        ["14", "Donald", "Brain"],
        ["15", "Yao", "Dou"],
        ["21", "Daniel", "Brown"],
        ["22", "Mark", "Johnson"],
        ["23", "Maria", "Evans"],
        ["24", "Cathrine", "Roberts"],
        ["25", "Sebastian", "Wright"],
        ["26", "Barbara", "Jones"],
        ["27", "Matthew", "Smith"],
        ["50", "Jack", "Dumb"],
        ["51", "Daniel", "Smart"]];

        return this.isEqual("union1", data, expected);
    }

    unionAlias1() {
        let stmt = "select a.id, a.first_name, a.last_name from authors as a UNION select e.id, e.first_name, e.last_name from editors as e";

        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["a.id", "a.first_name", "a.last_name"],
        ["11", "Ellen", "Writer"],
        ["12", "Olga", "Savelieva"],
        ["13", "Jack", "Smart"],
        ["14", "Donald", "Brain"],
        ["15", "Yao", "Dou"],
        ["21", "Daniel", "Brown"],
        ["22", "Mark", "Johnson"],
        ["23", "Maria", "Evans"],
        ["24", "Cathrine", "Roberts"],
        ["25", "Sebastian", "Wright"],
        ["26", "Barbara", "Jones"],
        ["27", "Matthew", "Smith"],
        ["50", "Jack", "Dumb"],
        ["51", "Daniel", "Smart"]];

        return this.isEqual("unionAlias1", data, expected);
    }

    unionBind1() {
        let stmt = "select * from authors where id = ?1 UNION select * from editors where id = ?2 UNION select * from translators where id = ?3";

        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .addTableData("translators", this.translatorsTable())
            .enableColumnTitle(true)
            .addBindParameter('15')
            .addBindParameter('51')
            .addBindParameter('31')
            .execute(stmt);

        let expected = [["AUTHORS.ID", "AUTHORS.FIRST_NAME", "AUTHORS.LAST_NAME"],
        ["15", "Yao", "Dou"],
        ["51", "Daniel", "Smart"],
        ["31", "Ira", "Davies"]];

        return this.isEqual("unionBind1", data, expected);
    }

    unionAll1() {
        let stmt = "select * from authors UNION ALL select * from editors";

        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["AUTHORS.ID", "AUTHORS.FIRST_NAME", "AUTHORS.LAST_NAME"],
        ["11", "Ellen", "Writer"],
        ["12", "Olga", "Savelieva"],
        ["13", "Jack", "Smart"],
        ["14", "Donald", "Brain"],
        ["15", "Yao", "Dou"],
        ["13", "Jack", "Smart"],
        ["21", "Daniel", "Brown"],
        ["22", "Mark", "Johnson"],
        ["23", "Maria", "Evans"],
        ["24", "Cathrine", "Roberts"],
        ["25", "Sebastian", "Wright"],
        ["26", "Barbara", "Jones"],
        ["27", "Matthew", "Smith"],
        ["50", "Jack", "Dumb"],
        ["51", "Daniel", "Smart"]];

        return this.isEqual("unionAll1", data, expected);
    }

    unionAll2() {
        let stmt = "select * from authors UNION ALL select * from editors UNION ALL select * from translators";

        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .addTableData("translators", this.translatorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["AUTHORS.ID", "AUTHORS.FIRST_NAME", "AUTHORS.LAST_NAME"],
        ["11", "Ellen", "Writer"],
        ["12", "Olga", "Savelieva"],
        ["13", "Jack", "Smart"],
        ["14", "Donald", "Brain"],
        ["15", "Yao", "Dou"],
        ["13", "Jack", "Smart"],
        ["21", "Daniel", "Brown"],
        ["22", "Mark", "Johnson"],
        ["23", "Maria", "Evans"],
        ["24", "Cathrine", "Roberts"],
        ["25", "Sebastian", "Wright"],
        ["26", "Barbara", "Jones"],
        ["27", "Matthew", "Smith"],
        ["50", "Jack", "Dumb"],
        ["51", "Daniel", "Smart"],
        ["31", "Ira", "Davies"],
        ["32", "Ling", "Weng"],
        ["33", "Kristian", "Green"],
        ["34", "Roman", "Edwards"]];

        return this.isEqual("unionAll2", data, expected);
    }

    unionJoin1() {
        let stmt = "select booksales.invoice as 'Invoice', booksales.quantity as 'Quantity', booksales.price as 'Price', booksales.quantity * booksales.price as 'Sales', booksales.date, books.title, customers.name, authors.first_name + ' ' + authors.last_name as 'Author', translators.first_name + ' ' + translators.last_name as 'Translator', editors.first_name + ' ' + editors.last_name as 'Editor' " +
            "from booksales left join books on booksales.book_id = books.id " +
            "left join customers on booksales.customer_id = customers.id " +
            "left join authors on books.author_id = authors.id " +
            "left join translators on books.translator_id = translators.id " +
            "left join editors on books.editor_id = editors.id " +
            "where booksales.date >= ?1 and booksales.date <= ?2 " +
            "union all select 'Total', SUM(booksales.quantity), avg(booksales.price), SUM(booksales.price * booksales.quantity), '' ,'', '', '', '', '' from booksales " +
            "where booksales.date >= ?3 and booksales.date <= ?4 ";

        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .addTableData("translators", this.translatorsTable())
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .addTableData("editors", this.editorsTable())
            .addTableData("books", this.bookTable())
            .addBindParameter("05/01/2022")
            .addBindParameter("05/02/2022")
            .addBindParameter("05/01/2022")
            .addBindParameter("05/02/2022")
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["Invoice", "Quantity", "Price", "Sales", "booksales.date", "books.title", "customers.name", "Author", "Translator", "Editor"],
        ["I7200", 10, 34.95, 349.5, "05/01/2022", "Book with Mysterious Author", "Numereo Uno", "null null", "Roman Edwards", "Maria Evans"],
        ["I7201", 3, 29.95, 89.85, "05/01/2022", "My Last Book", "Dewy Tuesdays", "Ellen Writer", "null null", "null null"],
        ["I7201", 5, 18.99, 94.94999999999999, "05/01/2022", "Applied AI", "Dewy Tuesdays", "Jack Smart", "Roman Edwards", "Maria Evans"],
        ["I7202", 1, 59.99, 59.99, "05/02/2022", "Book with Mysterious Author", "Tres Buon Goods", "null null", "Roman Edwards", "Maria Evans"],
        ["I7203", 1, 90, 90, "05/02/2022", "Time to Grow Up!", null, "Ellen Writer", "null null", "Daniel Brown"],
        ["Total", 20, 46.775999999999996, 684.29, "", "", "", "", "", ""]];

        return this.isEqual("unionJoin1", data, expected);

    }

    except1() {
        let stmt = "select * from authors EXCEPT select * from authors where last_name like 'S%'";

        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["AUTHORS.ID", "AUTHORS.FIRST_NAME", "AUTHORS.LAST_NAME"],
        ["11", "Ellen", "Writer"],
        ["14", "Donald", "Brain"],
        ["15", "Yao", "Dou"]];

        return this.isEqual("except1", data, expected);
    }

    intersect1() {
        let stmt = "select * from editors INTERSECT select * from authors";

        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["EDITORS.ID", "EDITORS.FIRST_NAME", "EDITORS.LAST_NAME"],
        ["13", "Jack", "Smart"]];

        return this.isEqual("intersect1", data, expected);
    }

    orderByDesc1() {
        let stmt = "select * from bookSales order by DATE DESC";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022"]];

        return this.isEqual("orderByDesc1", data, expected);
    }

    orderByDesc2() {
        let stmt = "select * from bookSales order by DATE DESC, PRICE ASC";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022"]];

        return this.isEqual("orderByDesc2", data, expected);
    }

    orderByDesc3() {
        let stmt = "select * from customers where lower(city) like '%city%' order by email desc";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["CUSTOMERS.ID", "CUSTOMERS.NAME", "CUSTOMERS.ADDRESS", "CUSTOMERS.CITY", "CUSTOMERS.PHONE", "CUSTOMERS.EMAIL"],
        ["C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com"],
        ["C3", "Tres Buon Goods", "3 Way St", "Tres City", "5193133303", "thrice@hotmail.com"],
        ["C6", "Sx in Cars", "6 Seventh St", "Sx City", "6661116666", "gotyourSix@hotmail.com   "],
        ["C4", "ForMe Resellers", "40 Four St", "FourtNight City", "2894441234", "fourtimes@hotmail.com"],
        ["C1", "Numereo Uno", "101 One Way", "One Point City", "9051112111", "bigOne@gmail.com"],
        ["C7", "7th Heaven", "7 Eight Crt.", "Lucky City", "5551117777", " timesAcharm@gmail.com "]];

        return this.isEqual("orderByDesc3", data, expected);
    }

    distinct1() {
        let stmt = "select distinct last_name from editors";

        let data = new TestSql()
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["LAST_NAME"],
        ["Brown"],
        ["Dumb"],
        ["Evans"],
        ["Johnson"],
        ["Jones"],
        ["Roberts"],
        ["Smart"],
        ["Smith"],
        ["Wright"]];

        return this.isEqual("distinct1", data, expected);
    }

    selectMath1() {
        let stmt = "select book_id, -(quantity), price, Quantity * Price, booksales.quantity * booksales.price * 0.13, quantity % 2, ((quantity + 1) * price)/100  from bookSales";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["book_id", "-(quantity)", "price", "Quantity * Price", "booksales.quantity * booksales.price * 0.13", "quantity % 2", "((quantity + 1) * price)/100"],
        ["9", -10, 34.95, 349.5, 45.435, 0, 3.8445000000000005],
        ["8", -3, 29.95, 89.85, 11.6805, 1, 1.198],
        ["7", -5, 18.99, 94.94999999999999, 12.343499999999999, 1, 1.1394],
        ["9", -1, 59.99, 59.99, 7.7987, 1, 1.1998],
        ["1", -1, 90, 90, 11.700000000000001, 1, 1.8],
        ["2", -100, 65.49, 6548.999999999999, 851.3699999999999, 0, 66.14489999999999],
        ["3", -150, 24.95, 3742.5, 486.52500000000003, 0, 37.674499999999995],
        ["4", -50, 19.99, 999.4999999999999, 129.935, 0, 10.194899999999999],
        ["7", -1, 33.97, 33.97, 4.4161, 1, 0.6794],
        ["7", -100, 17.99, 1798.9999999999998, 233.86999999999998, 0, 18.1699]];

        return this.isEqual("selectMath1", data, expected);
    }

    selectMathFunc1() {
        let stmt = "select book_id, quantity, price, round(((quantity + 1) * price)/100), LEFT(invoice,3), RIGHT(invoice,4)  from bookSales";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["book_id", "quantity", "price", "round(((quantity + 1) * price)/100)", "LEFT(invoice,3)", "RIGHT(invoice,4)"],
        ["9", 10, 34.95, 4, "I72", "7200"],
        ["8", 3, 29.95, 1, "I72", "7201"],
        ["7", 5, 18.99, 1, "I72", "7201"],
        ["9", 1, 59.99, 1, "I72", "7202"],
        ["1", 1, 90, 2, "I72", "7203"],
        ["2", 100, 65.49, 66, "I72", "7204"],
        ["3", 150, 24.95, 38, "I72", "7204"],
        ["4", 50, 19.99, 10, "I72", "7204"],
        ["7", 1, 33.97, 1, "I72", "7205"],
        ["7", 100, 17.99, 18, "I72", "7206"]];

        return this.isEqual("selectMathFunc1", data, expected);
    }

    selectMathFunc2() {
        let stmt = "select book_id, quantity, price, ABS(quantity-10), CEILING(price), floor(price), log(quantity), log10(quantity), power(quantity, 2), sqrt(quantity)  from bookSales";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["book_id", "quantity", "price", "ABS(quantity-10)", "CEILING(price)", "floor(price)", "log(quantity)", "log10(quantity)", "power(quantity, 2)", "sqrt(quantity)"],
        ["9", 10, 34.95, 0, 35, 34, 3.321928094887362, 1, 100, 3.1622776601683795],
        ["8", 3, 29.95, 7, 30, 29, 1.584962500721156, 0.47712125471966244, 9, 1.7320508075688772],
        ["7", 5, 18.99, 5, 19, 18, 2.321928094887362, 0.6989700043360189, 25, 2.23606797749979],
        ["9", 1, 59.99, 9, 60, 59, 0, 0, 1, 1],
        ["1", 1, 90, 9, 90, 90, 0, 0, 1, 1],
        ["2", 100, 65.49, 90, 66, 65, 6.643856189774724, 2, 10000, 10],
        ["3", 150, 24.95, 140, 25, 24, 7.22881869049588, 2.1760912590556813, 22500, 12.24744871391589],
        ["4", 50, 19.99, 40, 20, 19, 5.643856189774724, 1.6989700043360187, 2500, 7.0710678118654755],
        ["7", 1, 33.97, 9, 34, 33, 0, 0, 1, 1], ["7", 100, 17.99, 90, 18, 17, 6.643856189774724, 2, 10000, 10]];

        return this.isEqual("selectMathFunc2", data, expected);
    }

    selectFuncs2() {
        let stmt = "select name, address, LEN(name), LENGTH(address), lower(name), upper(address), trim(email), ltrim(email), rtrim(email) from customers";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["name", "address", "LEN(name)", "LENGTH(address)", "lower(name)", "upper(address)", "trim(email)", "ltrim(email)", "rtrim(email)"],
        ["Numereo Uno", "101 One Way", 11, 11, "numereo uno", "101 ONE WAY", "bigOne@gmail.com", "bigOne@gmail.com", "bigOne@gmail.com"],
        ["Dewy Tuesdays", "202 Second St.", 13, 14, "dewy tuesdays", "202 SECOND ST.", "twoguys@gmail.com", "twoguys@gmail.com", "twoguys@gmail.com"],
        ["Tres Buon Goods", "3 Way St", 15, 8, "tres buon goods", "3 WAY ST", "thrice@hotmail.com", "thrice@hotmail.com", "thrice@hotmail.com"],
        ["ForMe Resellers", "40 Four St", 15, 10, "forme resellers", "40 FOUR ST", "fourtimes@hotmail.com", "fourtimes@hotmail.com", "fourtimes@hotmail.com"],
        ["Fe Fi Fo Giant Tiger", "5 ohFive St.", 20, 12, "fe fi fo giant tiger", "5 OHFIVE ST.", "fiver@gmail.com", "fiver@gmail.com", "   fiver@gmail.com"],
        ["Sx in Cars", "6 Seventh St", 10, 12, "sx in cars", "6 SEVENTH ST", "gotyourSix@hotmail.com", "gotyourSix@hotmail.com   ", "gotyourSix@hotmail.com"],
        ["7th Heaven", "7 Eight Crt.", 10, 12, "7th heaven", "7 EIGHT CRT.", "timesAcharm@gmail.com", "timesAcharm@gmail.com ", " timesAcharm@gmail.com"]];

        return this.isEqual("selectFuncs2", data, expected);
    }

    selectFuncs3() {
        let stmt = "select name + ' = ' + upper(email), reverse(name), replicate(name,2) from customers";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["name + ' = ' + upper(email)", "reverse(name)", "replicate(name,2)"],
        ["Numereo Uno = BIGONE@GMAIL.COM", "onU oeremuN", "Numereo UnoNumereo Uno"],
        ["Dewy Tuesdays = TWOGUYS@GMAIL.COM", "syadseuT yweD", "Dewy TuesdaysDewy Tuesdays"],
        ["Tres Buon Goods = THRICE@HOTMAIL.COM", "sdooG nouB serT", "Tres Buon GoodsTres Buon Goods"],
        ["ForMe Resellers = FOURTIMES@HOTMAIL.COM", "srelleseR eMroF", "ForMe ResellersForMe Resellers"],
        ["Fe Fi Fo Giant Tiger =    FIVER@GMAIL.COM", "regiT tnaiG oF iF eF", "Fe Fi Fo Giant TigerFe Fi Fo Giant Tiger"],
        ["Sx in Cars = GOTYOURSIX@HOTMAIL.COM   ", "sraC ni xS", "Sx in CarsSx in Cars"],
        ["7th Heaven =  TIMESACHARM@GMAIL.COM ", "nevaeH ht7", "7th Heaven7th Heaven"]];

        return this.isEqual("selectFuncs3", data, expected);
    }

    selectFuncs4() {
        let stmt = "select space(5), email, stuff(email, 2, 3, 'CJD'), substring(email, 5, 5) from customers";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["space(5)", "email", "stuff(email, 2, 3, 'CJD')", "substring(email, 5, 5)"],
        ["     ", "bigOne@gmail.com", "bCJDne@gmail.com", "ne@gm"],
        ["     ", "twoguys@gmail.com", "tCJDuys@gmail.com", "uys@g"],
        ["     ", "thrice@hotmail.com", "tCJDce@hotmail.com", "ce@ho"],
        ["     ", "fourtimes@hotmail.com", "fCJDtimes@hotmail.com", "times"],
        ["     ", "   fiver@gmail.com", " CJDiver@gmail.com", "iver@"],
        ["     ", "gotyourSix@hotmail.com   ", "gCJDourSix@hotmail.com   ", "ourSi"],
        ["     ", " timesAcharm@gmail.com ", " CJDesAcharm@gmail.com ", "esAch"]];

        return this.isEqual("selectFuncs4", data, expected);
    }

    selectFuncs5() {
        let stmt = "select now(), email, stuff(email, 2, 3, 'CJD'), substring(email, 5, 5) from customers limit 1";

        let testSQL = new TestSql()
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true);

        Logger.log("NOTE:  selectFuncs5(), Test is attempted multiple times on failure (matching current time).")
        //  NOW() is always changing, so try our test a few times.
        let attempts = 0;
        let success = false;
        while (attempts < 5 && !success) {
            let data = testSQL.execute(stmt);

            let expected = [["now()", "email", "stuff(email, 2, 3, 'CJD')", "substring(email, 5, 5)"],
            ["%1", "bigOne@gmail.com", "bCJDne@gmail.com", "ne@gm"]];

            for (let row of expected) {
                let nowPos = row.indexOf("%1");
                if (nowPos != -1)
                    row[nowPos] = new Date().toLocaleString();
            }

            success = this.isEqual("selectFuncs5", data, expected);
            attempts++;
        }

        return success;
    }

    selectFuncs6() {
        let stmt = "select date, year(date), month(date), day(date) from booksales";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["date", "year(date)", "month(date)", "day(date)"],
        ["05/01/2022", 2022, 5, 1],
        ["05/01/2022", 2022, 5, 1],
        ["05/01/2022", 2022, 5, 1],
        ["05/02/2022", 2022, 5, 2],
        ["05/02/2022", 2022, 5, 2],
        ["05/03/2022", 2022, 5, 3],
        ["05/03/2022", 2022, 5, 3],
        ["05/03/2022", 2022, 5, 3],
        ["05/04/2022", 2022, 5, 4],
        ["05/04/2022", 2022, 5, 4]];

        return this.isEqual("selectFuncs6", data, expected);
    }

    selectFuncs7() {
        let stmt = "select name, charindex(' ', name, 2), charindex(' ', name, 4), charindex(' ', name, 6) from customers";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["name", "charindex(' ', name, 2)", "charindex(' ', name, 4)", "charindex(' ', name, 6)"],
        ["Numereo Uno", 8, 8, 8],
        ["Dewy Tuesdays", 5, 5, 0],
        ["Tres Buon Goods", 5, 5, 10],
        ["ForMe Resellers", 6, 6, 6],
        ["Fe Fi Fo Giant Tiger", 3, 6, 6],
        ["Sx in Cars", 3, 6, 6],
        ["7th Heaven", 4, 4, 0]];

        return this.isEqual("selectFuncs7", data, expected);
    }

    selectFuncInFunc1() {
        let stmt = "select email, upper(substring(email, 5, 5)), trim(upper(email)) from customers";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["email", "upper(substring(email, 5, 5))", "trim(upper(email))"],
        ["bigOne@gmail.com", "NE@GM", "BIGONE@GMAIL.COM"],
        ["twoguys@gmail.com", "UYS@G", "TWOGUYS@GMAIL.COM"],
        ["thrice@hotmail.com", "CE@HO", "THRICE@HOTMAIL.COM"],
        ["fourtimes@hotmail.com", "TIMES", "FOURTIMES@HOTMAIL.COM"],
        ["   fiver@gmail.com", "IVER@", "FIVER@GMAIL.COM"],
        ["gotyourSix@hotmail.com   ", "OURSI", "GOTYOURSIX@HOTMAIL.COM"],
        [" timesAcharm@gmail.com ", "ESACH", "TIMESACHARM@GMAIL.COM"]];

        return this.isEqual("selectFuncInFunc1", data, expected);
    }

    selectFuncInFunc2() {
        let stmt = "select email,charindex('@', email), if(charindex('@', email) > 0, trim(substring(email, 1, charindex('@', email) - 1)), email) from customers";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["email", "charindex('@', email)", "if(charindex('@', email) > 0, trim(substring(email, 1, charindex('@', email) - 1)), email)"],
        ["bigOne@gmail.com", 7, "bigOne"],
        ["twoguys@gmail.com", 8, "twoguys"],
        ["thrice@hotmail.com", 7, "thrice"],
        ["fourtimes@hotmail.com", 10, "fourtimes"],
        ["   fiver@gmail.com", 9, "fiver"],
        ["gotyourSix@hotmail.com   ", 11, "gotyourSix"],
        [" timesAcharm@gmail.com ", 13, "timesAcharm"]];

        return this.isEqual("selectFuncInFunc2", data, expected);
    }

    selectIF1() {
        let stmt = "SELECT IF(authors.id = '', 'MISSING AUTHOR', authors.id), authors.last_name, IF(editors.id = '', 'MISSING EDITOR', editors.id), editors.last_name " +
            "FROM authors " +
            "FULL JOIN editors " +
            "ON authors.id = editors.id ";

        let data = new TestSql()
            .addTableData("authors", this.authorsTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["IF(authors.id = '', 'MISSING AUTHOR', authors.id)", "authors.last_name", "IF(editors.id = '', 'MISSING EDITOR', editors.id)", "editors.last_name"],
        ["11", "Writer", null, null],
        ["12", "Savelieva", null, null],
        ["13", "Smart", "13", "Smart"],
        ["14", "Brain", null, null],
        ["15", "Dou", null, null],
        [null, null, "21", "Brown"],
        [null, null, "22", "Johnson"],
        [null, null, "23", "Evans"],
        [null, null, "24", "Roberts"],
        [null, null, "25", "Wright"],
        [null, null, "26", "Jones"],
        [null, null, "27", "Smith"],
        [null, null, "50", "Dumb"],
        [null, null, "51", "Smart"]]
            ;

        return this.isEqual("selectIF1", data, expected);
    }

    selectIF2() {
        let stmt = "SELECT quantity, price, if(price > 25, 'OVER $25', 'UNDER $25') " +
            "FROM booksales ";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["quantity", "price", "if(price > 25, 'OVER $25', 'UNDER $25')"],
        [10, 34.95, "OVER $25"],
        [3, 29.95, "OVER $25"],
        [5, 18.99, "UNDER $25"],
        [1, 59.99, "OVER $25"],
        [1, 90, "OVER $25"],
        [100, 65.49, "OVER $25"],
        [150, 24.95, "UNDER $25"],
        [50, 19.99, "UNDER $25"],
        [1, 33.97, "OVER $25"],
        [100, 17.99, "UNDER $25"]];

        return this.isEqual("selectIF2", data, expected);
    }

    selectIF3() {
        let stmt = "SELECT quantity, price, if(quantity + price > 100, 'OVER $100', 'UNDER $100') " +
            "FROM booksales ";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["quantity", "price", "if(quantity + price > 100, 'OVER $100', 'UNDER $100')"],
        [10, 34.95, "UNDER $100"],
        [3, 29.95, "UNDER $100"],
        [5, 18.99, "UNDER $100"],
        [1, 59.99, "UNDER $100"],
        [1, 90, "UNDER $100"],
        [100, 65.49, "OVER $100"],
        [150, 24.95, "OVER $100"],
        [50, 19.99, "UNDER $100"],
        [1, 33.97, "UNDER $100"]
            , [100, 17.99, "OVER $100"]];

        return this.isEqual("selectIF3", data, expected);
    }

    selectIF4() {
        let stmt = "SELECT quantity, price, if(quantity * price > 100, 'OVER $100', 'UNDER $100') " +
            "FROM booksales ";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["quantity", "price", "if(quantity * price > 100, 'OVER $100', 'UNDER $100')"],
        [10, 34.95, "OVER $100"],
        [3, 29.95, "UNDER $100"],
        [5, 18.99, "UNDER $100"],
        [1, 59.99, "UNDER $100"],
        [1, 90, "UNDER $100"],
        [100, 65.49, "OVER $100"],
        [150, 24.95, "OVER $100"],
        [50, 19.99, "OVER $100"],
        [1, 33.97, "UNDER $100"],
        [100, 17.99, "OVER $100"]];

        return this.isEqual("selectIF4", data, expected);
    }

    selectWhereCalc1() {
        let stmt = "SELECT quantity, price, price + quantity from booksales where (price + quantity > 100)";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["quantity", "price", "price + quantity"],
        [100, 65.49, 165.49],
        [150, 24.95, 174.95],
        [100, 17.99, 117.99]];

        return this.isEqual("selectWhereCalc1", data, expected);
    }

    selectWhereCalc2() {
        let stmt = "SELECT quantity, price, quantity * price from booksales where price * quantity > 100";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["quantity", "price", "quantity * price"],
        [10, 34.95, 349.5],
        [100, 65.49, 6548.999999999999],
        [150, 24.95, 3742.5],
        [50, 19.99, 999.4999999999999],
        [100, 17.99, 1798.9999999999998]];

        return this.isEqual("selectWhereCalc2", data, expected);
    }

    selectCase1() {
        let stmt = "SELECT quantity, price, " +
            "CASE " +
            "WHEN quantity = 1 THEN 'One Sold' " +
            "WHEN quantity = 2 THEN 'Two Sold' " +
            "WHEN quantity = 3 THEN 'Three Sold' " +
            "WHEN quantity < 100 THEN 'Up to 100 Sold' " +
            "ELSE quantity + ' items sold' " +
            "END " +
            "from booksales";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["quantity", "price", "CASE WHEN quantity = 1 THEN 'One Sold' WHEN quantity = 2 THEN 'Two Sold' WHEN quantity = 3 THEN 'Three Sold' WHEN quantity < 100 THEN 'Up to 100 Sold' ELSE quantity + ' items sold' END"],
        [10, 34.95, "Up to 100 Sold"],
        [3, 29.95, "Three Sold"],
        [5, 18.99, "Up to 100 Sold"],
        [1, 59.99, "One Sold"],
        [1, 90, "One Sold"],
        [100, 65.49, "100 items sold"],
        [150, 24.95, "150 items sold"],
        [50, 19.99, "Up to 100 Sold"],
        [1, 33.97, "One Sold"],
        [100, 17.99, "100 items sold"]];

        return this.isEqual("selectCase1", data, expected);
    }

    selectCase2() {
        let stmt = "SELECT quantity, price, " +
            "'Invoice=' + substring(invoice,2,4) + ' ' + " +
            "CASE " +
            "WHEN quantity > 1 and quantity <= 5 THEN 'Low Volume ' + quantity * price " +
            "WHEN quantity > 5 and quantity < 10 THEN 'Moderate Volume' + quantity " +
            "WHEN quantity = 100 or quantity = 150 THEN '100 or 150' " +
            "WHEN quantity * price = 90 THEN '$90, ka ching.'   " +
            "ELSE quantity + ' items sold. ID=' + lower(customer_id) " +
            "END as summary" +
            "from booksales";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["quantity", "price", "summary"],
        [10, 34.95, "Invoice=7200 10 items sold. ID=c1"],
        [3, 29.95, "Invoice=7201 Low Volume 89.85"],
        [5, 18.99, "Invoice=7201 Low Volume 94.94999999999999"],
        [1, 59.99, "Invoice=7202 1 items sold. ID=c3"],
        [1, 90, "Invoice=7203 $90, ka ching."],
        [100, 65.49, "Invoice=7204 100 or 150"],
        [150, 24.95, "Invoice=7204 100 or 150"],
        [50, 19.99, "Invoice=7204 50 items sold. ID=c4"],
        [1, 33.97, "Invoice=7205 1 items sold. ID=c1"],
        [100, 17.99, "Invoice=7206 100 or 150"]];

        return this.isEqual("selectCase2", data, expected);
    }

    selectAlias1() {
        let stmt = "SELECT quantity as QTY, price as Pricing,  round(quantity * price) as Money from booksales where price * quantity > 100";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["QTY", "Pricing", "Money"],
        [10, 34.95, 350],
        [100, 65.49, 6549],
        [150, 24.95, 3743],
        [50, 19.99, 999],
        [100, 17.99, 1799]];

        return this.isEqual("selectAlias1", data, expected);
    }

    liveTest1() {
        let stmt = "select mastertransactions.transaction_date, sum(mastertransactions.gross), sum(mastertransactions.amount) from mastertransactions inner join budgetCategories on mastertransactions.Expense_Category = budgetCategories.Income where mastertransactions.transaction_date >=  '01/01/2022' and mastertransactions.transaction_date <= '05/19/2022' group by mastertransactions.transaction_date pivot mastertransactions.account";

        let data = new TestSql()
            .addTableData('mastertransactions', 'Master Transactions!$A$1:$I')
            .addTableData('budgetCategories', 'budgetIncomeCategories')
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["QTY", "Pricing", "Money"],
        [10, 34.95, 350],
        [100, 65.49, 6549],
        [150, 24.95, 3743],
        [50, 19.99, 999],
        [100, 17.99, 1799]];

        return this.isEqual("liveTest1", data, expected);

    }

    liveTest2() {
        let stmt = "select name_of_institution, transaction_date, balance from 'master transactions' where name_of_institution in (select account_name from accounts where type = 'Bank') and balance is not null and transaction_date >= ? and transaction_date <= ?";

        let data = gsSQL(stmt, [], false, 'startBankingDate', 'endBankingDate');

        let expected = [["QTY", "Pricing", "Money"],
        [10, 34.95, 350],
        [100, 65.49, 6549],
        [150, 24.95, 3743],
        [50, 19.99, 999],
        [100, 17.99, 1799]];

        return this.isEqual("liveTest2", data, expected);

    }

    groupPivot1() {
        let stmt = "select bookSales.date, SUM(bookSales.Quantity) from bookSales where customer_id != '' group by date pivot customer_id";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["bookSales.date", "C1 SUM(bookSales.Quantity)", "C2 SUM(bookSales.Quantity)", "C3 SUM(bookSales.Quantity)", "C4 SUM(bookSales.Quantity)"],
        ["05/01/2022", 10, 8, 0, 0],
        ["05/02/2022", 0, 0, 1, 0],
        ["05/03/2022", 0, 0, 0, 300],
        ["05/04/2022", 1, 100, 0, 0]];

        return this.isEqual("groupPivot1", data, expected);
    }

    groupPivot2() {
        let stmt = "select date, sum(quantity) from bookReturns group by date pivot customer_id";

        let data = new TestSql()
            .addTableData("bookReturns", this.bookReturnsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["date", "c1 sum(quantity)", "c2 sum(quantity)", "c3 sum(quantity)", "c4 sum(quantity)"],
        ["05/01/2022", 10, 8, 0, 0],
        ["05/02/2022", 1, 0, 1, 0],
        ["05/03/2022", 0, 0, 0, 300],
        ["05/04/2022", 1, 100, 0, 0]];

        return this.isEqual("groupPivot2", data, expected);
    }

    groupPivot3() {
        let stmt = "select date, sum(quantity) from bookReturns where date >= ?1 and date <= ?2 group by date pivot customer_id";

        let data = new TestSql()
            .addTableData("bookReturns", this.bookReturnsTable())
            .enableColumnTitle(true)
            .addBindParameter("05/01/2022")
            .addBindParameter("05/04/2022")
            .execute(stmt);

        let expected = [["date", "c1 sum(quantity)", "c2 sum(quantity)", "c3 sum(quantity)", "c4 sum(quantity)"],
        ["05/01/2022", 10, 8, 0, 0],
        ["05/02/2022", 1, 0, 1, 0],
        ["05/03/2022", 0, 0, 0, 300],
        ["05/04/2022", 1, 100, 0, 0]];

        return this.isEqual("groupPivot3", data, expected);
    }


    groupFunc1() {
        let stmt = "select bookSales.date, SUM(if(customer_id = 'C1', bookSales.Quantity,0)), SUM(if(customer_id = 'C2', bookSales.Quantity,0)) from bookSales where customer_id != '' group by date";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["bookSales.date", "SUM(if(customer_id = 'C1', bookSales.Quantity,0))", "SUM(if(customer_id = 'C2', bookSales.Quantity,0))"],
        ["05/01/2022", 10, 8],
        ["05/02/2022", 0, 0],
        ["05/03/2022", 0, 0],
        ["05/04/2022", 1, 100]];

        return this.isEqual("groupFunc1", data, expected);
    }

    groupFunc2() {
        let stmt = "select bookSales.date, SUM(if(customer_id = 'C1', bookSales.Quantity,0)), SUM(if(customer_id = 'C2', bookSales.Quantity,0)) from bookSales where customer_id = '1010' group by date";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(false)
            .execute(stmt);

        let expected = [['']];

        return this.isEqual("groupFunc2", data, expected);
    }

    selectInGroupByPivot1() {
        let stmt = "select bookSales.date, SUM(bookSales.Quantity) from bookSales where customer_id in (select id from customers)  group by date pivot customer_id";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["bookSales.date", "C1 SUM(bookSales.Quantity)", "C2 SUM(bookSales.Quantity)", "C3 SUM(bookSales.Quantity)", "C4 SUM(bookSales.Quantity)"],
        ["05/01/2022", 10, 8, 0, 0],
        ["05/02/2022", 0, 0, 1, 0],
        ["05/03/2022", 0, 0, 0, 300],
        ["05/04/2022", 1, 100, 0, 0]];

        return this.isEqual("selectInGroupByPivot1", data, expected);
    }

    selectInGroupByPivot2() {
        let stmt = "select bookSales.date as 'Transaction Date', SUM(bookSales.Quantity) as [ as Much Quantity], Max(price) as Maximum from bookSales where customer_id in (select id from customers)  group by date pivot customer_id";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["Transaction Date", "C1  as Much Quantity", "C2  as Much Quantity", "C3  as Much Quantity", "C4  as Much Quantity", "C1 Maximum", "C2 Maximum", "C3 Maximum", "C4 Maximum"],
        ["05/01/2022", 10, 8, 0, 0, 34.95, 29.95, 0, 0],
        ["05/02/2022", 0, 0, 1, 0, 0, 0, 59.99, 0],
        ["05/03/2022", 0, 0, 0, 300, 0, 0, 0, 65.49],
        ["05/04/2022", 1, 100, 0, 0, 33.97, 17.99, 0, 0]];

        return this.isEqual("selectInGroupByPivot2", data, expected);
    }

    selectInGroupByPivot3() {
        let stmt = "select bookSales.date as 'Date', SUM(bookSales.Quantity) as [Quantity], Max(price) as Maximum, min(price) as Min, avg(price) as avg, count(date) from bookSales where customer_id in (select id from customers)  group by date pivot customer_id";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["Date", "C1 Quantity", "C2 Quantity", "C3 Quantity", "C4 Quantity", "C1 Maximum", "C2 Maximum", "C3 Maximum", "C4 Maximum", "C1 Min", "C2 Min", "C3 Min", "C4 Min", "C1 avg", "C2 avg", "C3 avg", "C4 avg", "C1 count(date)", "C2 count(date)", "C3 count(date)", "C4 count(date)"],
        ["05/01/2022", 10, 8, 0, 0, 34.95, 29.95, 0, 0, 34.95, 18.99, 0, 0, 34.95, 24.47, null, null, 1, 2, 0, 0],
        ["05/02/2022", 0, 0, 1, 0, 0, 0, 59.99, 0, 0, 0, 59.99, 0, null, null, 59.99, null, 0, 0, 1, 0],
        ["05/03/2022", 0, 0, 0, 300, 0, 0, 0, 65.49, 0, 0, 0, 19.99, null, null, null, 36.809999999999995, 0, 0, 0, 3],
        ["05/04/2022", 1, 100, 0, 0, 33.97, 17.99, 0, 0, 33.97, 17.99, 0, 0, 33.97, 17.99, null, null, 1, 1, 0, 0]];

        return this.isEqual("selectInGroupByPivot3", data, expected);
    }

    selectCount1() {
        let stmt = "select count(*) from booksales";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["count(*)"],
        [10]];

        return this.isEqual("selectCount1", data, expected);
    }

    selectCount2() {
        let stmt = "select customer_id, count(*) from booksales group by customer_id having count(*) > 1";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["customer_id", "count(*)"],
        ["C1", 2],
        ["C2", 3],
        ["C4", 3]];

        return this.isEqual("selectCount2", data, expected);
    }

    selectCount3() {
        let stmt = "select count(distinct customer_id), count(distinct invoice) from booksales where customer_id <> ''";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["count(distinct customer_id)", "count(distinct invoice)"],
        [4, 6]];

        return this.isEqual("selectCount3", data, expected);
    }

    selectCount4() {
        let stmt = "select count(distinct customer_id), count(distinct invoice) from booksales";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["count(distinct customer_id)", "count(distinct invoice)"],
        [5, 7]];

        return this.isEqual("selectCount4", data, expected);
    }

    selectCount5() {
        let stmt = "select count(all customer_id), count(all invoice) from booksales";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["count(all customer_id)", "count(all invoice)"],
        [10, 10]];

        return this.isEqual("selectCount5", data, expected);
    }

    selectCount6() {
        let stmt = "select avg(price), max(quantity), count(customer_id) from booksales group by customer_id";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["avg(price)", "max(quantity)", "count(customer_id)"],
        [90, 1, 1],
        [34.46, 10, 2],
        [22.31, 100, 3],
        [59.99, 1, 1],
        [36.809999999999995, 150, 3]];

        return this.isEqual("selectCount6", data, expected);
    }

    selectGroupByNotInSelect() {
        let stmt = "select avg(price), max(quantity)  from booksales group by customer_id";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["avg(price)", "max(quantity)"],
        [90, 1],
        [34.46, 10],
        [22.31, 100],
        [59.99, 1],
        [36.809999999999995, 150]];

        return this.isEqual("selectGroupByNotInSelect", data, expected);
    }

    selectGroupByNotInSelect2() {
        let stmt = "select avg(price), max(quantity)  from booksales group by customer_id, date";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["avg(price)", "max(quantity)"],
        [90, 1],
        [34.95, 10],
        [33.97, 1],
        [24.47, 5],
        [17.99, 100],
        [59.99, 1],
        [36.809999999999995, 150]];

        return this.isEqual("selectGroupByNotInSelect2", data, expected);
    }

    selectOrderByNotInSelect() {
        let stmt = "select price, quantity from booksales order by customer_id";

        let data = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["price", "quantity"],
        [90, 1],
        [34.95, 10],
        [33.97, 1],
        [29.95, 3],
        [18.99, 5],
        [17.99, 100],
        [59.99, 1],
        [65.49, 100],
        [24.95, 150],
        [19.99, 50]];

        return this.isEqual("selectOrderByNotInSelect", data, expected);
    }

    selectCoalesce() {
        let stmt = "select name, coalesce(dec, nov, oct, sep, aug, jul, jun, may, apr, mar, feb, jan) from yearlysales";

        let data = new TestSql()
            .addTableData("yearlysales", this.yearlySalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["name", "coalesce(dec, nov, oct, sep, aug, jul, jun, may, apr, mar, feb, jan)"],
        ["Chris", 60],
        ["Fred", 30],
        ["Dan", 31],
        ["Kev", 60],
        ["Dori", 50],
        ["Gab", "20"]];

        return this.isEqual("selectCoalesce", data, expected);
    }

    selectConcat_Ws() {
        let stmt = "select concat_ws('-', *) as concatenated from customers " +
            "where concat_ws('-', *) like '%Way%'";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["concatenated"],
        ["C1-Numereo Uno-101 One Way-One Point City-9051112111-bigOne@gmail.com"],
        ["C3-Tres Buon Goods-3 Way St-Tres City-5193133303-thrice@hotmail.com"]];

        return this.isEqual("selectConcat_Ws", data, expected);
    }

    selectConcat_Ws2() {
        let stmt = "select concat_ws('-', *) as concatenated from booksales " +
            "left join customers on booksales.customer_id = customers.id " +
            "where concat_ws('-', *) like '%Way%'";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["concatenated"],
        ["I7200-9-C1-10-34.95-05/01/2022-C1-Numereo Uno-101 One Way-One Point City-9051112111-bigOne@gmail.com"],
        ["I7202-9-C3-1-59.99-05/02/2022-C3-Tres Buon Goods-3 Way St-Tres City-5193133303-thrice@hotmail.com"],
        ["I7205-7-C1-1-33.97-05/04/2022-C1-Numereo Uno-101 One Way-One Point City-9051112111-bigOne@gmail.com"]];

        return this.isEqual("selectConcat_Ws2", data, expected);
    }

    selectNoTitle1() {
        let stmt = "SELECT booksales.A as 'Invoice', booksales.B as 'Book ID', CUST.A, CUST.B FROM booksales " +
            "LEFT JOIN customers as CUST on booksales.C = customers.A ";

        let customers = this.customerTable();
        let bookSales = this.bookSalesTable();

        //  Get rid of current column titles.
        customers.shift();
        bookSales.shift();

        let data = new TestSql()
            .addTableData("customers", customers, 0, false)
            .addTableData("booksales", bookSales, 0, false)
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["Invoice", "Book ID", "CUST.A", "CUST.B"],
        ["I7200", "9", "C1", "Numereo Uno"],
        ["I7201", "8", "C2", "Dewy Tuesdays"],
        ["I7201", "7", "C2", "Dewy Tuesdays"],
        ["I7202", "9", "C3", "Tres Buon Goods"],
        ["I7203", "1", null, null],
        ["I7204", "2", "C4", "ForMe Resellers"],
        ["I7204", "3", "C4", "ForMe Resellers"],
        ["I7204", "4", "C4", "ForMe Resellers"],
        ["I7205", "7", "C1", "Numereo Uno"],
        ["I7206", "7", "C2", "Dewy Tuesdays"]];

        return this.isEqual("selectNoTitle1", data, expected);
    }


    selectNested() {
        let stmt = "select * from books where id in (select book_id from booksales where price > (select avg(price) from booksales))";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKS.ID", "BOOKS.TITLE", "BOOKS.TYPE", "BOOKS.AUTHOR_ID", "BOOKS.EDITOR_ID", "BOOKS.TRANSLATOR_ID"],
        ["1", "Time to Grow Up!", "original", "11", "21", ""],
        ["2", "Your Trip", "translated", "15", "22", "32"],
        ["9", "Book with Mysterious Author", "translated", "1", "23", "34"]];

        return this.isEqual("selectNested", data, expected);
    }

    selectNested2() {
        let stmt = "select last_name from authors where id in (select author_id from books where id in (select book_id from booksales where price > (select avg(price) from booksales)))";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["last_name"],
        ["Writer"],
        ["Dou"]];

        return this.isEqual("selectNested2", data, expected);
    }

    selectCorrelatedSubQuery1() {
        let stmt = "select id, title, (select count(*) from booksales where books.id = booksales.book_id) from books";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["id", "title", "(select count(*) from booksales where books.id = booksales.book_id)"],
        ["1", "Time to Grow Up!", 1],
        ["2", "Your Trip", 1],
        ["3", "Lovely Love", 1],
        ["4", "Dream Your Life", 1],
        ["5", "Oranges", ""],
        ["6", "Your Happy Life", ""],
        ["7", "Applied AI", 3],
        ["9", "Book with Mysterious Author", 2],
        ["8", "My Last Book", 1]];

        return this.isEqual("selectCorrelatedSubQuery1", data, expected);
    }

    selectCorrelatedSubQuery2() {
        let stmt = "select id, title, (select count(*) from booksales where books.id = booksales.book_id) as 'Sold' from books where (select count(*)  from booksales where books.id = booksales.book_id) > 1";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["id", "title", "Sold"],
        ["7", "Applied AI", 3],
        ["9", "Book with Mysterious Author", 2]];

        return this.isEqual("selectCorrelatedSubQuery2", data, expected);
    }


    selectCorrelatedSubQuery3() {
        let stmt = "select * from customers where exists (SELECT * FROM booksales WHERE booksales.customer_id = customers.id) and email like '%gmail.com' ";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["CUSTOMERS.ID", "CUSTOMERS.NAME", "CUSTOMERS.ADDRESS", "CUSTOMERS.CITY", "CUSTOMERS.PHONE", "CUSTOMERS.EMAIL"],
        ["C1", "Numereo Uno", "101 One Way", "One Point City", "9051112111", "bigOne@gmail.com"],
        ["C2", "Dewy Tuesdays", "202 Second St.", "Second City", "4162022222", "twoguys@gmail.com"]];

        return this.isEqual("selectCorrelatedSubQuery3", data, expected);
    }

    selectCorrelatedSubQuery4() {
        let stmt = "select * from customers where not exists (SELECT * FROM booksales WHERE booksales.customer_id = customers.id)";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["CUSTOMERS.ID", "CUSTOMERS.NAME", "CUSTOMERS.ADDRESS", "CUSTOMERS.CITY", "CUSTOMERS.PHONE", "CUSTOMERS.EMAIL"],
        ["C5", "Fe Fi Fo Giant Tiger", "5 ohFive St.", "FifthDom", "4165551234", "   fiver@gmail.com"],
        ["C6", "Sx in Cars", "6 Seventh St", "Sx City", "6661116666", "gotyourSix@hotmail.com   "],
        ["C7", "7th Heaven", "7 Eight Crt.", "Lucky City", "5551117777", " timesAcharm@gmail.com "]];

        return this.isEqual("selectCorrelatedSubQuery4", data, expected);
    }

    selectCorrelatedSubQuery5() {
        let stmt = "SELECT * FROM booksales as b1 where price = (select max(booksales.price) from booksales where booksales.customer_id = b1.customer_id)";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"]];

        return this.isEqual("selectCorrelatedSubQuery5", data, expected);
    }

    selectCorrelatedSubQuery6() {
        let stmt = "select * from bookreturns as br where price < (select max(price) from bookreturns  where br.customer_id = customer_id) and price > (select min(price) from bookreturns  where br.customer_id = customer_id)";

        let data = new TestSql()
            .addTableData("bookreturns", this.bookReturnsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKRETURNS.RMA", "BOOKRETURNS.BOOK_ID", "BOOKRETURNS.CUSTOMER_ID", "BOOKRETURNS.QUANTITY", "BOOKRETURNS.PRICE", "BOOKRETURNS.DATE"],
        ["Rma001", "9", "c1", 10, 34.95, "05/01/2022"],
        ["rmA030", "7", "c2", 5, 18.99, "05/01/2022"],
        ["Rma701", "3", "c4", 150, 24.95, "05/03/2022"]];

        return this.isEqual("selectCorrelatedSubQuery6", data, expected);
    }

    selectCorrelatedSubQuery7() {
        let stmt = "select * from bookreturns as br where price < (select max(sub.price) from bookreturns as sub where br.customer_id = sub.customer_id) and price > (select min(price) from bookreturns  where br.customer_id = customer_id)";

        let data = new TestSql()
            .addTableData("bookreturns", this.bookReturnsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKRETURNS.RMA", "BOOKRETURNS.BOOK_ID", "BOOKRETURNS.CUSTOMER_ID", "BOOKRETURNS.QUANTITY", "BOOKRETURNS.PRICE", "BOOKRETURNS.DATE"],
        ["Rma001", "9", "c1", 10, 34.95, "05/01/2022"],
        ["rmA030", "7", "c2", 5, 18.99, "05/01/2022"],
        ["Rma701", "3", "c4", 150, 24.95, "05/03/2022"]];

        return this.isEqual("selectCorrelatedSubQuery7", data, expected);
    }

    selectCorrelatedSubQuery8() {
        let stmt = "select * from booksales as b1 where price in (select max(price) from booksales where b1.customer_id = customer_id)";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"]];

        return this.isEqual("selectCorrelatedSubQuery8", data, expected);
    }

    selectCorrelatedSubQuery9() {
        let stmt = "select id, name, (select max(quantity) from booksales where customers.id = booksales.customer_id) as 'max sold' from customers";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["id", "name", "max sold"],
        ["C1", "Numereo Uno", 10],
        ["C2", "Dewy Tuesdays", 100],
        ["C3", "Tres Buon Goods", 1],
        ["C4", "ForMe Resellers", 150],
        ["C5", "Fe Fi Fo Giant Tiger", ""],
        ["C6", "Sx in Cars", ""],
        ["C7", "7th Heaven", ""]];

        return this.isEqual("selectCorrelatedSubQuery9", data, expected);
    }

    selectCorrelatedSubQuery10() {
        let stmt = "select * from booksales as b1 where price in (select max(price) from booksales where b1.customer_id = customer_id and book_id <> '9')";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022"]];

        return this.isEqual("selectCorrelatedSubQuery10", data, expected);
    }

    selectCorrelatedSubQuery11() {
        let stmt = "select *, (select sum(quantity) from booksales where b1.customer_id = customer_id) as 'Total for Customer' from booksales as b1 where customer_id = ?1";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .addBindParameter("C4")
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE", "Total for Customer"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022", 300],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022", 300],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022", 300]];

        return this.isEqual("selectCorrelatedSubQuery11", data, expected);
    }

    selectFromSubQuery1() {
        let stmt = "select score.customer_id, score.wins, score.loss, (score.wins / (score.wins+score.loss)) as rate from (select customer_id, sum(case when quantity < 100 then 1 else 0 end) as wins, sum(case when quantity >= 100 then 1 else 0 end) as loss from booksales group by customer_id) as score";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["score.customer_id", "score.wins", "score.loss", "rate"],
        ["", 1, 0, 1],
        ["C1", 2, 0, 1],
        ["C2", 2, 1, 0.6666666666666666],
        ["C3", 1, 0, 1],
        ["C4", 1, 2, 0.3333333333333333]];

        return this.isEqual("selectFromSubQuery1", data, expected);
    }

    selectFromSubQuery2() {
        let stmt = "select customer_id, wins, loss, (wins / (wins+loss)) as rate from (select customer_id, sum(case when quantity < 100 then 1 else 0 end) as wins, sum(case when quantity >= 100 then 1 else 0 end) as loss from booksales group by customer_id) as score";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["customer_id", "wins", "loss", "rate"],
        ["", 1, 0, 1],
        ["C1", 2, 0, 1],
        ["C2", 2, 1, 0.6666666666666666],
        ["C3", 1, 0, 1],
        ["C4", 1, 2, 0.3333333333333333]];

        return this.isEqual("selectFromSubQuery2", data, expected);
    }

    selectFromSubQuery3() {
        let stmt = "select invoice from (select invoice from booksales where customer_id = 'C1') as mysales";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["invoice"],
        ["I7200"],
        ["I7205"]];

        return this.isEqual("selectFromSubQuery3", data, expected);
    }

    selectFromSubQuery4() {
        let stmt = "select table3.invoice from " +
            "(select invoice, quantity from " +
            "(select invoice, table1.QTY as quantity from " +
            "(select invoice, quantity as QTY, customer_id from booksales where quantity <= 10) as table1 "
            + "where customer_id = 'C1') as table2) "
            + "as table3";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["table3.invoice"],
        ["I7200"],
        ["I7205"]];

        return this.isEqual("selectFromSubQuery4", data, expected);
    }

    selectFromSubQuery5() {
        let stmt = "select table3.invoice from " +
            "(select * from " +
            "(select invoice, table1.QTY as quantity from " +
            "(select invoice, quantity as QTY, customer_id from booksales where quantity <= 10) as table1 "
            + "where customer_id = 'C1') as table2) "
            + "as table3";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["table3.invoice"],
        ["I7200"],
        ["I7205"]];

        return this.isEqual("selectFromSubQuery5", data, expected);
    }

    selectFromSubQuery6() {
        let stmt = "select table3.invoice, table3.name from (select * from (select invoice, table1.QTY as quantity, customers.name from (select invoice, quantity as QTY, customer_id from booksales where quantity <= 10) as table1 join customers on table1.customer_id = customers.id where customer_id = 'C1') as table2) as table3";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["table3.invoice", "table3.name"],
        ["I7200", "Numereo Uno"],
        ["I7205", "Numereo Uno"]];

        return this.isEqual("selectFromSubQuery6", data, expected);
    }


    selectFromSubQuery7() {
        let stmt = "select * from booksales join (select * from booksales where customer_id = 'C1') as subsales on booksales.book_id = subsales.book_id";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE", "SUBSALES.INVOICE", "SUBSALES.BOOK_ID", "SUBSALES.CUSTOMER_ID", "SUBSALES.QUANTITY", "SUBSALES.PRICE", "SUBSALES.DATE"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022", "I7200", "9", "C1", 10, 34.95, "05/01/2022"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022", "I7205", "7", "C1", 1, 33.97, "05/04/2022"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022", "I7200", "9", "C1", 10, 34.95, "05/01/2022"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022", "I7205", "7", "C1", 1, 33.97, "05/04/2022"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", "I7205", "7", "C1", 1, 33.97, "05/04/2022"]];

        return this.isEqual("selectFromSubQuery7", data, expected);
    }

    selectConvertFunction() {
        let stmt = "select convert(address, signed), convert(address, char), convert(name, signed), convert(id, signed), convert(phone, char), convert(phone, decimal) from customers";

        let data = new TestSql()
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["convert(address, signed)", "convert(address, char)", "convert(name, signed)", "convert(id, signed)", "convert(phone, char)", "convert(phone, decimal)"],
        [101, "101 One Way", 0, 0, "9051112111", 9051112111],
        [202, "202 Second St.", 0, 0, "4162022222", 4162022222],
        [3, "3 Way St", 0, 0, "5193133303", 5193133303],
        [40, "40 Four St", 0, 0, "2894441234", 2894441234],
        [5, "5 ohFive St.", 0, 0, "4165551234", 4165551234],
        [6, "6 Seventh St", 0, 0, "6661116666", 6661116666],
        [7, "7 Eight Crt.", 7, 0, "5551117777", 5551117777]];

        return this.isEqual("selectConvertFunction", data, expected);
    }

    selectJoinMultipleConditions() {
        let stmt = "select * from booksales join bookreturns on booksales.quantity = bookreturns.quantity and booksales.date = bookreturns.date or booksales.book_id = bookreturns.book_id";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("bookreturns", this.bookReturnsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE", "BOOKRETURNS.RMA", "BOOKRETURNS.BOOK_ID", "BOOKRETURNS.CUSTOMER_ID", "BOOKRETURNS.QUANTITY", "BOOKRETURNS.PRICE", "BOOKRETURNS.DATE"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022", "Rma001", "9", "c1", 10, 34.95, "05/01/2022"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022", "RMA040", "9", "c3", 1, 59.99, "05/02/2022"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022", "rma020", "8", "c2", 3, 29.95, "05/01/2022"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022", "rmA030", "7", "c2", 5, 18.99, "05/01/2022"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022", "RMA900", "7", "c1", 1, 33.97, "05/04/2022"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022", "rma1010", "7", "c2", 100, 17.99, "05/04/2022"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022", "RMA040", "9", "c3", 1, 59.99, "05/02/2022"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022", "rma005", "1", "c1", 1, 90, "05/02/2022"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022", "Rma001", "9", "c1", 10, 34.95, "05/01/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022", "RMA040", "9", "c3", 1, 59.99, "05/02/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022", "rma005", "1", "c1", 1, 90, "05/02/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022", "RMA600", "2", "c4", 100, 65.49, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022", "Rma701", "3", "c4", 150, 24.95, "05/03/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022", "RmA800", "4", "c4", 50, 19.99, "05/03/2022"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022", "RMA900", "7", "c1", 1, 33.97, "05/04/2022"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022", "rmA030", "7", "c2", 5, 18.99, "05/01/2022"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022", "rma1010", "7", "c2", 100, 17.99, "05/04/2022"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", "rma1010", "7", "c2", 100, 17.99, "05/04/2022"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", "rmA030", "7", "c2", 5, 18.99, "05/01/2022"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", "RMA900", "7", "c1", 1, 33.97, "05/04/2022"]];

        return this.isEqual("selectJoinMultipleConditions", data, expected);
    }

    selectJoinOnExpression1() {
        let stmt = "select invoice, name from booksales inner join customers on substr(booksales.customer_id, 2, 1) = substr(customers.id, 2, 1)";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["invoice", "name"],
        ["I7200", "Numereo Uno"],
        ["I7201", "Dewy Tuesdays"],
        ["I7201", "Dewy Tuesdays"],
        ["I7202", "Tres Buon Goods"],
        ["I7204", "ForMe Resellers"],
        ["I7204", "ForMe Resellers"],
        ["I7204", "ForMe Resellers"],
        ["I7205", "Numereo Uno"],
        ["I7206", "Dewy Tuesdays"]];

        return this.isEqual("selectJoinOnExpression1", data, expected);
    }


    selectJoinMultipleConditions2() {
        let stmt = "select invoice, name, title from customers inner join booksales on booksales.customer_id = customers.id join books on books.id = booksales.book_id";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .addTableData("books", this.bookTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["invoice", "name", "title"],
        ["I7200", "Numereo Uno", "Book with Mysterious Author"],
        ["I7205", "Numereo Uno", "Applied AI"],
        ["I7201", "Dewy Tuesdays", "My Last Book"],
        ["I7201", "Dewy Tuesdays", "Applied AI"],
        ["I7206", "Dewy Tuesdays", "Applied AI"],
        ["I7202", "Tres Buon Goods", "Book with Mysterious Author"],
        ["I7204", "ForMe Resellers", "Your Trip"],
        ["I7204", "ForMe Resellers", "Lovely Love"],
        ["I7204", "ForMe Resellers", "Dream Your Life"]];

        return this.isEqual("selectJoinMultipleConditions2", data, expected);
    }

    selectJoinOnExpression2() {
        let stmt = "select invoice, name, title from customers inner join booksales on substr(booksales.customer_id, 2, 1) = substr(customers.id, 2, 1) join books on books.id = booksales.book_id";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .addTableData("books", this.bookTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["invoice", "name", "title"],
        ["I7200", "Numereo Uno", "Book with Mysterious Author"],
        ["I7205", "Numereo Uno", "Applied AI"],
        ["I7201", "Dewy Tuesdays", "My Last Book"],
        ["I7201", "Dewy Tuesdays", "Applied AI"],
        ["I7206", "Dewy Tuesdays", "Applied AI"],
        ["I7202", "Tres Buon Goods", "Book with Mysterious Author"],
        ["I7204", "ForMe Resellers", "Your Trip"],
        ["I7204", "ForMe Resellers", "Lovely Love"],
        ["I7204", "ForMe Resellers", "Dream Your Life"]];

        return this.isEqual("selectJoinOnExpression2", data, expected);
    }


    selectJoinOnExpression3() {
        let stmt = "select invoice, name, title from customers inner join booksales on 'BB' + substr(booksales.customer_id, 2, 1) = 'BB' + substr(customers.id, 2, 1) join books on 'CC' + books.id = 'CC' + booksales.book_id";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .addTableData("books", this.bookTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["invoice", "name", "title"],
        ["I7200", "Numereo Uno", "Book with Mysterious Author"],
        ["I7205", "Numereo Uno", "Applied AI"],
        ["I7201", "Dewy Tuesdays", "My Last Book"],
        ["I7201", "Dewy Tuesdays", "Applied AI"],
        ["I7206", "Dewy Tuesdays", "Applied AI"],
        ["I7202", "Tres Buon Goods", "Book with Mysterious Author"],
        ["I7204", "ForMe Resellers", "Your Trip"],
        ["I7204", "ForMe Resellers", "Lovely Love"],
        ["I7204", "ForMe Resellers", "Dream Your Life"]];

        return this.isEqual("selectJoinOnExpression3", data, expected);
    }

    selectJoinLeftRightSwitchedInCondition() {
        let stmt = "select * from books left join authors on authors.id = books.author_id";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKS.ID", "BOOKS.TITLE", "BOOKS.TYPE", "BOOKS.AUTHOR_ID", "BOOKS.EDITOR_ID", "BOOKS.TRANSLATOR_ID", "AUTHORS.ID", "AUTHORS.FIRST_NAME", "AUTHORS.LAST_NAME"],
        ["1", "Time to Grow Up!", "original", "11", "21", "", "11", "Ellen", "Writer"],
        ["2", "Your Trip", "translated", "15", "22", "32", "15", "Yao", "Dou"],
        ["3", "Lovely Love", "original", "14", "24", "", "14", "Donald", "Brain"],
        ["4", "Dream Your Life", "original", "11", "24", "", "11", "Ellen", "Writer"],
        ["5", "Oranges", "translated", "12", "25", "31", "12", "Olga", "Savelieva"],
        ["6", "Your Happy Life", "translated", "15", "22", "33", "15", "Yao", "Dou"],
        ["7", "Applied AI", "translated", "13", "23", "34", "13", "Jack", "Smart"],
        ["9", "Book with Mysterious Author", "translated", "1", "23", "34", null, null, null],
        ["8", "My Last Book", "original", "11", "28", "", "11", "Ellen", "Writer"]];

        return this.isEqual("selectJoinLeftRightSwitchedInCondition", data, expected);
    }

    selectJoinMultipleConditions3() {
        let stmt = "select * from booksales inner join bookreturns on booksales.book_id = bookreturns.book_id and booksales.invoice = bookreturns.rma";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("bookreturns", this.bookReturnsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE", "BOOKRETURNS.RMA", "BOOKRETURNS.BOOK_ID", "BOOKRETURNS.CUSTOMER_ID", "BOOKRETURNS.QUANTITY", "BOOKRETURNS.PRICE", "BOOKRETURNS.DATE"]];

        return this.isEqual("selectJoinMultipleConditions3", data, expected);
    }

    selectSingleQuoteDataWithCalculation() {
        let stmt = "select sum(amount), avg(amount), max(transaction_date), min(transaction_date) from master";

        let data = new TestSql()
            .addTableData("master", this.masterTransactionsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["sum(amount)", "avg(amount)", "max(transaction_date)", "min(transaction_date)"],
        [12399.19, 516.6329166666667, "2019-06-20T04:00:00.000Z", "2019-06-07T04:00:00.000Z"]];

        return this.isEqual("selectSingleQuoteDataWithCalculation", data, expected);
    }

    selectGroupByCalculatedField() {
        let stmt = "select convert(day(date), char) + convert(year(date), char),  count(*) from booksales group by convert(day(date), char) + convert(year(date), char)";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["convert(day(date), char) + convert(year(date), char)", "count(*)"],
        ["12022", 3],
        ["22022", 2],
        ["32022", 3],
        ["42022", 2]];

        return this.isEqual("selectGroupByCalculatedField", data, expected);
    }

    selectGroupByCalculatedFieldNotInSelectFieldList() {
        let stmt = "select count(*) from booksales group by convert(day(date), char) + convert(year(date), char)";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["count(*)"],
        [3],
        [2],
        [3],
        [2]];

        return this.isEqual("selectGroupByCalculatedFieldNotInSelectFieldList", data, expected);
    }

    selectGroupByCalculatedField2() {
        let stmt = "select concat(convert(substr(customers.phone,1,3),char), booksales.date), count(*)from booksales join customers on booksales.customer_id = customers.id group by concat(convert(substr(customers.phone,1,3),char), booksales.date)";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["concat(convert(substr(customers.phone,1,3),char), booksales.date)", "count(*)"],
        ["28905/03/2022", 3],
        ["41605/01/2022", 2],
        ["41605/04/2022", 1],
        ["51905/02/2022", 1],
        ["90505/01/2022", 1],
        ["90505/04/2022", 1]];

        return this.isEqual("selectGroupByCalculatedField2", data, expected);
    }

    selectOrderByCalculated() {
        let stmt = "select * from booksales order by customer_id asc, convert(day(date), char) + convert(year(date), char) desc";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022"]];

        return this.isEqual("selectOrderByCalculated", data, expected);
    }

    selectOrderByCalculated2() {
        let stmt = "select *, quantity*price from booksales order by convert(day(date), char) + convert(year(date), char) desc, quantity*price asc";

        let data = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["BOOKSALES.INVOICE", "BOOKSALES.BOOK_ID", "BOOKSALES.CUSTOMER_ID", "BOOKSALES.QUANTITY", "BOOKSALES.PRICE", "BOOKSALES.DATE", "quantity*price"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022", 33.97],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", 1798.9999999999998],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022", 999.4999999999999],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022", 3742.5],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022", 6548.999999999999],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022", 59.99],
        ["I7203", "1", "", 1, 90, "05/02/2022", 90],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022", 89.85],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022", 94.94999999999999],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022", 349.5]];

        return this.isEqual("selectOrderByCalculated2", data, expected);
    }


    joinBigTables1() {
        let recCount = 100000;
        let stmt = "select * from booksales join books on booksales.book_id = books.id order by booksales.invoice desc";

        const bigBookSalesTable = this.bookSalesTable(recCount);
        const bigBookTable = this.bookTable(recCount);

        //const startTime = performance.now();
        let data = new TestSql()
            .addTableData("booksales", bigBookSalesTable)
            .addTableData("books", bigBookTable)
            .enableColumnTitle(true)
            .execute(stmt);
        //const endtime = performance.now();
        //Logger.log(`Big Table Join.  ms=${(endtime - startTime).toString()}`);

        let expected = recCount + 11;

        return this.isEqual("joinBigTables1", data.length, expected);
    }

    selectWhereLike3() {
        let stmt = "select id, title, author_id from books where title like 'Your%'";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["id", "title", "author_id"],
        ["2", "Your Trip", "15"],
        ["6", "Your Happy Life", "15"]];

        return this.isEqual("selectWhereLike3", data, expected);
    }

    selectWhereLike4() {
        let stmt = "select id, title, author_id from books where title like '%Your%'";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["id", "title", "author_id"],
        ["2", "Your Trip", "15"],
        ["4", "Dream Your Life", "11"],
        ["6", "Your Happy Life", "15"]];

        return this.isEqual("selectWhereLike4", data, expected);
    }

    selectFromSubQuery8() {
        let stmt = "Select * from (select * from books where title like 'Your%') as mybooks";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["MYBOOKS.ID", "MYBOOKS.TITLE", "MYBOOKS.TYPE", "MYBOOKS.AUTHOR_ID", "MYBOOKS.EDITOR_ID", "MYBOOKS.TRANSLATOR_ID"],
        ["2", "Your Trip", "translated", "15", "22", "32"],
        ["6", "Your Happy Life", "translated", "15", "22", "33"]];

        return this.isEqual("selectFromSubQuery8", data, expected);
    }

    selectFromSubQuery9() {
        let stmt = "Select * from (select * from books where title = 'Your Happy Life') as mybooks";

        let data = new TestSql()
            .addTableData("books", this.bookTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["MYBOOKS.ID", "MYBOOKS.TITLE", "MYBOOKS.TYPE", "MYBOOKS.AUTHOR_ID", "MYBOOKS.EDITOR_ID", "MYBOOKS.TRANSLATOR_ID"],
        ["6", "Your Happy Life", "translated", "15", "22", "33"]];

        return this.isEqual("selectFromSubQuery9", data, expected);
    }

    //  S T A R T   O T H E R   T E S T S
    removeTrailingEmptyRecords() {
        let authors = this.authorsTable();

        for (let i = 0; i < 10; i++) {
            authors.push(["", "", ""]);
        }

        let stmt = "select * from authors";

        let data = new TestSql()
            .addTableData("authors", authors)
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["AUTHORS.ID", "AUTHORS.FIRST_NAME", "AUTHORS.LAST_NAME"],
        ["11", "Ellen", "Writer"],
        ["12", "Olga", "Savelieva"],
        ["13", "Jack", "Smart"],
        ["14", "Donald", "Brain"],
        ["15", "Yao", "Dou"]];

        return this.isEqual("removeTrailingEmptyRecords", data, expected);
    }

    parseTableSettings1() {
        let data = GasSql.parseTableSettings([['authors', 'authorsNamedRange', 60, false], ['editors', 'editorsRange', 30], ['people', 'peopleRange']], "", false);
        let expected = [["authors", "authorsNamedRange", 60, false],
        ["editors", "editorsRange", 30, true],
        ["people", "peopleRange", 60, true]];

        return this.isEqual("parseTableSettings1", data, expected);
    }

    parseTableSettings2() {
        let data = GasSql.parseTableSettings([['authors', 'authorsNamedRange', 60], ['editors', 'editorsRange', 30], ['people']], "", false);
        let expected = [["authors", "authorsNamedRange", 60, true],
        ["editors", "editorsRange", 30, true],
        ["people", "people", 60, true]];
        return this.isEqual("parseTableSettings2", data, expected);
    }

    parseTableSettings3() {
        let stmt = "select *, books.title, authors.first_name, editors.first_name, customers.name, customers.email, booksales.quantity from bookSales " +
            "LEFT JOIN books ON booksales.book_id = books.id " +
            "LEFT JOIN authors on books.author_id = authors.id " +
            "LEFT JOIN editors on books.editor_id = editors.id " +
            "LEFT JOIN customers on bookSales.customer_id = customers.id " +
            "WHERE customers.email NOT LIKE '%gmail.com' " +
            "UNION select * from bookSales2";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["BOOKSALES", "BOOKSALES", 60, true],
        ["BOOKS", "BOOKS", 60, true],
        ["AUTHORS", "AUTHORS", 60, true],
        ["EDITORS", "EDITORS", 60, true],
        ["CUSTOMERS", "CUSTOMERS", 60, true],
        ["BOOKSALES2", "BOOKSALES2", 60, true]];
        return this.isEqual("parseTableSettings3", data, expected);
    }

    parseTableSettings4() {
        let stmt = "select * from 'master transactions' where account in (select account_name from accounts) ";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["'MASTER TRANSACTIONS'", "'MASTER TRANSACTIONS'", 60, true],
        ["ACCOUNTS", "ACCOUNTS", 60, true]];
        return this.isEqual("parseTableSettings4", data, expected);
    }

    parseTableSettings5() {
        let stmt = "SELECT * " +
            "FROM books " +
            "WHERE author_id IN (select a.id from authors as a where first_name = ?) " +
            "or editor_id in (select e.id from editors as e where last_name = ?) " +
            "or title = ? " +
            "ORDER BY title";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["BOOKS", "BOOKS", 60, true],
        ["AUTHORS", "AUTHORS", 60, true],
        ["EDITORS", "EDITORS", 60, true]];
        return this.isEqual("parseTableSettings5", data, expected);
    }

    parseTableSettings6() {
        let stmt = "SELECT books.id, books.title, books.author_id " +
            "FROM books " +
            "WHERE books.author_id NOT IN (SELECT id from authors)" +
            "ORDER BY books.title";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["BOOKS", "BOOKS", 60, true],
        ["AUTHORS", "AUTHORS", 60, true]];
        return this.isEqual("parseTableSettings6", data, expected);
    }

    parseTableSettings7() {
        let stmt = "SELECT booksales.A as 'Invoice', booksales.B as 'Book ID', CUST.A, CUST.B FROM booksales " +
            "LEFT JOIN customers as CUST on booksales.C = customers.A ";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["BOOKSALES", "BOOKSALES", 60, true],
        ["CUSTOMERS", "CUSTOMERS", 60, true]];

        return this.isEqual("parseTableSettings7", data, expected);
    }

    parseTableSettings8() {
        let stmt = "select id, title, (select count(*) from booksales where books.id = booksales.book_id) from books";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["BOOKS", "BOOKS", 60, true],
        ["BOOKSALES", "BOOKSALES", 60, true]];

        return this.isEqual("parseTableSettings8", data, expected);
    }

    parseTableSettings9() {
        let stmt = "select concat_ws('-', *) as Concatenated from booksales left join customers on booksales.customer_id = customers.id where concat_ws('-', *) like '%Way%'";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["BOOKSALES", "BOOKSALES", 60, true],
        ["CUSTOMERS", "CUSTOMERS", 60, true]];

        return this.isEqual("parseTableSettings9", data, expected);
    }

    parseTableSettings10() {
        let stmt = "select * from customers where exists (SELECT * FROM booksales WHERE booksales.customer_id = customers.id) and email like '%gmail.com' ";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["CUSTOMERS", "CUSTOMERS", 60, true],
        ["BOOKSALES", "BOOKSALES", 60, true]];

        return this.isEqual("parseTableSettings10", data, expected);
    }

    parseTableSettings11() {
        let stmt = "select customer_id, wins, loss, (wins / (wins+loss)) as rate from (select customer_id, sum(case when quantity < 100 then 1 else 0 end) as wins, sum(case when quantity >= 100 then 1 else 0 end) as loss from booksales group by customer_id) as score";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["BOOKSALES", "BOOKSALES", 60, true]];

        return this.isEqual("parseTableSettings11", data, expected);
    }


    parseTableSettings12() {
        let stmt = "select table3.invoice from " +
            "(select invoice, quantity from " +
            "(select invoice, table1.QTY as quantity from " +
            "(select invoice, quantity as QTY, customer_id from booksales where quantity <= 10) as table1 "
            + "where customer_id = 'C1') as table2) "
            + "as table3";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["BOOKSALES", "BOOKSALES", 60, true]];

        return this.isEqual("parseTableSettings12", data, expected);
    }

    parseTableSettings13() {
        let stmt = "select table3.invoice, table3.name from (select * from (select invoice, table1.QTY as quantity, customers.name from (select invoice, quantity as QTY, customer_id from booksales where quantity <= 10) as table1 join customers on table1.customer_id = customers.id where customer_id = 'C1') as table2) as table3";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["BOOKSALES", "BOOKSALES", 60, true],
        ["CUSTOMERS", "CUSTOMERS", 60, true]];

        return this.isEqual("parseTableSettings13", data, expected);
    }

    parseTableSettings14() {
        let stmt = "select * from booksales join (select * from booksales where customer_id = 'C1') as subsales on booksales.book_id = subsales.book_id";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["BOOKSALES", "BOOKSALES", 60, true]];

        return this.isEqual("parseTableSettings14", data, expected);
    }

    parseTableSettings15() {
        let stmt = "select * from booksales join bookreturns on booksales.quantity = bookreturns.quantity and booksales.date = bookreturns.date or booksales.book_id = bookreturns.book_id";

        let data = GasSql.parseTableSettings([], stmt, false);
        let expected = [["BOOKSALES", "BOOKSALES", 60, true],
        ["BOOKRETURNS", "BOOKRETURNS", 60, true]];

        return this.isEqual("parseTableSettings15", data, expected);
    }

    //  Mock the GAS sheets functions required to load.
    testTableData1() {
        try {
            if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Master Transactions") === null) {
                //  Skip tests if Master Transactions does not exist. (so anybody not CJD)
                //  BUT it will work if test run in NODE.
                return true;
            }
        }
        catch (ex) {
            //  Test will fail running in gas-local.
            return true;
        }

        let [selectTrans, allTrans, allTrans2, allTrans3, allTrans4] = this.testTableData();

        let masterTrans = this.masterTransactionsTable();
        masterTrans.shift();

        let expected = [["Transaction Date", "Gross", "Net"],
        ["2019-06-07T04:00:00.000Z", 0, 12399.19]];

        let result = true;
        result = result && this.isEqual("testTableData1.a", selectTrans, expected);
        result = result && this.isEqual("testTableData1.b", allTrans, masterTrans);
        result = result && this.isEqual("testTableData1.c", allTrans2, masterTrans);
        result = result && this.isEqual("testTableData1.d", allTrans3, masterTrans);
        result = result && this.isEqual("testTableData1.d", allTrans4, masterTrans);

        let data = gsSQL("select Name_of_Institution, Transaction_Date, Description_1, Description_2, Amount, Expense_Category, Account, Gross, Balance " +
            "from 'Master Transactions' " +
            "where transaction_date >= '6/7/2019' and transaction_date <= '6/20/2019'");
        data.shift();

        result = result && this.isEqual("testTableData1.e", data, masterTrans);

        return result;
    }

    testTableData2() {
        let result = true;

        let data = gsSQL("select id, first_name, last_name from authors", "authors", this.authorsTable(), "editors", this.editorsTable(), true);
        result = result && this.isEqual("testTableData2.a", data, this.authorsTable());

        data = gsSQL("select id, first_name, last_name from authors", "authors", this.authorsTable(), "editors", this.editorsTable());
        result = result && this.isEqual("testTableData2.b", data, this.authorsTable());

        return result;
    }

    testTableData() {
        //  Hey CJD, remember to set the startIncomeDate and endIncomeDate - June 7 to June 20 2019
        const itemData = new TestSql()
            .addTableData('mastertransactions', 'Master Transactions!$A$1:$I', 60)
            .enableColumnTitle(true)
            .addBindNamedRangeParameter('startIncomeDate')
            .addBindNamedRangeParameter('endIncomeDate')
            .execute("select transaction_date as 'Transaction Date', sum(gross) as Gross, sum(amount) as Net " +
                "from mastertransactions " +
                "where transaction_date >=  ?1 and transaction_date <= ?2 ");

        //  Load load from sheet.
        let trans = new TestSql()
            .addTableData('mastertransactions', 'Master Transactions!$A$1:$I', .1)
            .enableColumnTitle(false)
            .addBindNamedRangeParameter('startIncomeDate')
            .addBindNamedRangeParameter('endIncomeDate')
            .execute("select * " +
                "from mastertransactions " +
                "where transaction_date >=  ?1 and transaction_date <= ?2 ");

        Utilities.sleep(.12);

        //  Should load from sheet.
        trans = new TestSql()
            .addTableData('mastertransactions', 'Master Transactions!$A$1:$I', 0)
            .enableColumnTitle(false)
            .addBindNamedRangeParameter('startIncomeDate')
            .addBindNamedRangeParameter('endIncomeDate')
            .execute("select * " +
                "from mastertransactions " +
                "where transaction_date >=  ?1 and transaction_date <= ?2 ");

        //  Save to long term cache.
        let trans2 = new TestSql()
            .addTableData('mastertransactions', 'Master Transactions!$A$1:$I30', 25000)
            .enableColumnTitle(false)
            .addBindNamedRangeParameter('startIncomeDate')
            .addBindNamedRangeParameter('endIncomeDate')
            .execute("select * " +
                "from mastertransactions " +
                "where transaction_date >=  ?1 and transaction_date <= ?2 ");

        //  Load from long term cache.
        let trans3 = new TestSql()
            .addTableData('mastertransactions', 'Master Transactions!$A$1:$I30', 25000)
            .enableColumnTitle(false)
            .addBindNamedRangeParameter('startIncomeDate')
            .addBindNamedRangeParameter('endIncomeDate')
            .execute("select * " +
                "from mastertransactions " +
                "where transaction_date >=  ?1 and transaction_date <= ?2 ");

        //  Force the expiry times for all items in long term cache.
        //  It does not remove items from cache, it just forces that check -
        //  which would never happen in testing since the check timeout is 21,000 seconds.
        TableData.forceLongCacheExpiryCheck();
        let trans4 = new TestSql()
            .addTableData('mastertransactions', 'Master Transactions!$A$1:$I30', 25000)
            .enableColumnTitle(false)
            .addBindNamedRangeParameter('startIncomeDate')
            .addBindNamedRangeParameter('endIncomeDate')
            .execute("select * " +
                "from mastertransactions " +
                "where transaction_date >=  ?1 and transaction_date <= ?2 ");

        //  This test is not going to run long enough for long cache to be forceably 
        //  expired, so we should make that long cache expire.

        return [itemData, trans, trans2, trans3, trans4];
    }


    selectBadTable1() {
        let stmt = "SELECT quantity, price, quantity * price from booksail where price * quantity > 100";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("editors", this.editorsTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadTable1", ex);
    }

    selectBadMath1() {
        let stmt = "SELECT quantity, price, quantity # price from booksales where price * quantity > 100";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadMath1", ex);
    }

    selectBadField1() {
        let stmt = "SELECT quantity, prices from booksales ";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadField1", ex);
    }

    selectBadField1a() {
        //  A SELECT you would encounter in the sub-query of a correlated lookup.
        let stmt = "select count(*) from booksales where books.id = booksales.book_id";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadField1a", ex);
    }

    selectBadField2() {
        let stmt = "SELECT sum(quantitys) from booksales ";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadField2", ex);
    }

    selectBadField3() {
        let stmt = "SELECT  quantity, Sumthing(price) from booksales ";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadField3", ex);
    }

    selectBadField4() {
        let stmt = "SELECT invoice, SUMM(quantity) from booksales group by invoice";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadField4", ex);
    }

    selectBadField5() {
        let stmt = "SELECT from booksales group by invoice";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadField5", ex);
    }

    selectBadOp1() {
        let stmt = "SELECT  quantity, Sum(price) from booksales where price >>! 0 ";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadOp1", ex);
    }

    selectBadAs1() {
        let stmt = "SELECT  quantity, price ASE PrIcE from booksales ";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadAs1", ex);
    }

    selectBadConstant1() {
        let stmt = "SELECT  quantity, price AS PrIcE from booksales where invoice = 'I7200 ";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadConstant1", ex);
    }

    selectBadConstant2() {
        let stmt = "SELECT  quantity, price AS PrIcE from booksales where price > 1O0 ";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadConstant2", ex);
    }

    nonSelect1() {
        let stmt = "delete from booksales where price > 1O0 ";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("nonSelect1", ex);
    }

    badJoin1() {
        let stmt = "SELECT books.id, books.title, authors.first_name, authors.last_name " +
            "FROM books " +
            "INNER JOIN authors " +
            "ON books.author_id = authors.di " +
            "ORDER BY books.id";

        let testSQL = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("badJoin1", ex);
    }

    badJoin2() {
        let stmt = "SELECT books.id, books.title, authors.first_name, authors.last_name " +
            "FROM books " +
            "INNER JOIN authors " +
            "ON books.author_di = authors.id " +
            "ORDER BY books.id";

        let testSQL = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("badJoin2", ex);
    }

    badJoin3() {
        let stmt = "SELECT books.id, books.title, authors.first_name, authors.last_name " +
            "FROM books " +
            "INNER JOIN on authors " +
            "books.author_id = authors.id " +
            "ORDER BY books.id";

        let testSQL = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("badJoin3", ex);
    }


    badJoin4() {
        let stmt = "select invoice, name from booksales inner join customers on substr(booksales.nonExistingColumn, 2, 1) = substr(customers.id, 2, 1)";

        let testSQL = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("badJoin4", ex);
    }

    badJoin5() {
        let stmt = "select invoice, name, title from customers inner join booksales on 'BB' + substr(booksales.customer_id, 2, 1) = 'BB' + substr(customers.id, 2, 1) join books on 'CC' + books.badColumnName = 'CC' + booksales.book_id";

        let testSQL = new TestSql()
            .addTableData("books", this.bookTable())
            .addTableData("booksales", this.bookSalesTable())
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("badJoin5", ex);
    }

    badOrderBy1() {
        let stmt = "select * from bookSales order by DATE DSC, customer_id asc";

        let testSQL = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("badOrderBy1", ex);

    }

    badOrderBy2() {
        let stmt = "select * from bookSales order by ORDER_DATE";

        let testSQL = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("badOrderBy2", ex);

    }

    bindVariableMissing() {
        let stmt = "select * from bookSales where date > ?1 AND date < ?2 OR book_id = ?3";

        let testSQL = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .addBindParameter('05/01/2022')
            .addBindParameter('05/04/2022')

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("bindVariableMissing", ex);
    }

    bindVariableMissing1() {
        let stmt = "select * from bookSales where date > ? AND date < ?";

        let testSQL = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .addBindParameter('05/01/2022')
            .addBindParameter('05/04/2022')

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("bindVariableMissing1", ex);
    }

    selectNoFrom() {
        let stmt = "SELECT quantity, prices for booksales ";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectNoFrom", ex);
    }

    selectNoTitles() {
        let stmt = "SELECT quantity, prices from booksales ";
        let dataTable = this.bookSalesTable();
        dataTable.shift();
        let ex = "";

        try {
            let testSQL = new TestSql()
                .addTableData("booksales", dataTable)
                .enableColumnTitle(true);

            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectNoTitles", ex);
    }


    selectFromSubQueryNoAlias() {
        let stmt = "select invoice from (select invoice from booksales where customer_id = 'C1')";
        let ex = "";

        let testSQL = new TestSql()
            .addTableData("booksales", this.bookSalesTable())
            .enableColumnTitle(true);

        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectFromSubQueryNoAlias", ex);
    }

    badParseTableSettings1() {
        let ex = "";
        try {
            GasSql.parseTableSettings([['authors', 'authorsNamedRange', true, 60, true], ['editors', 'editorsRange', 30], ['people']], "", false);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("badParseTableSettings1", ex);
    }

    pivotGroupByMissing() {
        let stmt = "select sum(quantity) from bookSales where date > ?1 AND date < ?2 OR book_id = ?3 pivot customer_id";

        let testSQL = new TestSql()
            .addTableData("bookSales", this.bookSalesTable())
            .enableColumnTitle(true)
            .addBindParameter('05/01/2022')
            .addBindParameter('05/04/2022')

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("pivotGroupByMissing", ex);
    }

    badUnion1() {
        let stmt = "select * from authors UNION select * from customers";

        let testSQL = new TestSql()
            .addTableData("authors", this.authorsTable())
            .addTableData("customers", this.customerTable())
            .enableColumnTitle(true);

        let ex = "";
        try {
            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("badUnion1", ex);
    }

    badFieldNames1() {
        let stmt = "select id from books where author_id is not null";

        let booksTable = this.bookTable();
        booksTable.shift();
        booksTable.unshift(["id", "title", "type", "author id", "author_id", "translator id"]);

        let ex = "";
        try {
            let testSQL = new TestSql()
                .addTableData("books", booksTable)
                .enableColumnTitle(true);

            testSQL.execute(stmt);
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("badFieldNames1", ex);
    }

    isFail(functionName, exceptionErr) {
        if (exceptionErr != "") {
            Logger.log(functionName + "  Captured Error:  " + exceptionErr)
            Logger.log(functionName + "() ***   S U C C E S S   ***");
            return true;
        }
        else {
            Logger.log(functionName + "() ***   F A I L E D   ***");
            Logger.log("Exception was expected !!");
            return false;
        }
    }

    isEqual(functionName, sqlDataArray, expectedArry) {
        let isEqualTest = false;
        let jsonData = JSON.stringify(sqlDataArray);
        let expectedJSON = JSON.stringify(expectedArry);

        let isEqual = jsonData == expectedJSON;

        if (!isEqual) {
            //  May have "10" != 10 and fail.  We should not fail in that case.
            //isEqual = sqlDataArray.toString() === expectedArry.toString();
            Logger.log("JSON comp failed. toString(): " + sqlDataArray.toString() + " === " + expectedArry.toString());
        }

        if (!isEqual) {
            Logger.log(functionName + "() ----------   F A I L E D   ----------");
            Logger.log(jsonData);

            for (let i = 0; i < jsonData.length; i++) {
                if (i >= jsonData.length)
                    break;
                if (jsonData.charAt(i) !== expectedJSON.charAt(i)) {
                    Logger.log("Pos=" + i + ".  DIFF=" + jsonData.substring(i, i + 20) + " != " + expectedJSON.substring(i, i + 20));
                    break;
                }
            }
        }
        else {
            Logger.log(functionName + "() ***   S U C C E S S   ***");
            isEqualTest = true;
        }

        return isEqualTest;
    }
}

/*  *** DEBUG START ***
//  Remove comments for testing in NODE
testerSql();
//  *** DEBUG END ***/

function testerSql() {
    let result = true;
    let tester = new SqlTester();

    result = result && tester.selectAll1();
    result = result && tester.selectAllCase1();
    result = result && tester.selectIsNotNull1();
    result = result && tester.selectIsNull1();
    result = result && tester.innerJoin1a();
    result = result && tester.innerJoin1case();
    result = result && tester.innerJoin2();
    result = result && tester.innerJoinAlias1();
    result = result && tester.innerJoinAlias2();
    result = result && tester.join2a();
    result = result && tester.join2b();
    result = result && tester.join3();
    result = result && tester.joinLimit1();
    result = result && tester.leftJoin1();
    result = result && tester.rightJoin1();
    result = result && tester.rightJoin1a();
    result = result && tester.rightJoin2();
    result = result && tester.fullJoin1();
    result = result && tester.fullJoin2();
    result = result && tester.fullJoin3();
    result = result && tester.whereIn1();
    result = result && tester.whereIn2();
    result = result && tester.whereIn3();
    result = result && tester.whereIn4();
    result = result && tester.whereIn5();
    result = result && tester.whereIn6();
    result = result && tester.whereIn7();
    result = result && tester.whereNotIn1();
    result = result && tester.whereAndOr1();
    result = result && tester.whereAndOr2();
    result = result && tester.whereAndOr3();
    result = result && tester.whereAndNotEqual2();
    result = result && tester.whereAndNotEqual3();
    result = result && tester.groupBy1();
    result = result && tester.selectAgainNewBinds1();
    result = result && tester.groupBy2();
    result = result && tester.groupBy3();
    result = result && tester.groupBy4();
    result = result && tester.avgSelect1();
    result = result && tester.funcsSelect2();
    result = result && tester.innerSelect1();
    result = result && tester.whereLike1();
    result = result && tester.whereLike2();
    result = result && tester.whereNotLike1();
    result = result && tester.union1();
    result = result && tester.unionAlias1();
    result = result && tester.unionBind1();
    result = result && tester.unionAll1();
    result = result && tester.unionAll2();
    result = result && tester.unionJoin1();
    result = result && tester.except1();
    result = result && tester.intersect1();
    result = result && tester.orderByDesc1();
    result = result && tester.orderByDesc2();
    result = result && tester.orderByDesc3();
    result = result && tester.distinct1();
    result = result && tester.selectMath1();
    result = result && tester.selectMathFunc1();
    result = result && tester.selectMathFunc2();
    result = result && tester.selectFuncs2();
    result = result && tester.selectFuncs3();
    result = result && tester.selectFuncs4();
    result = result && tester.selectFuncs5();
    result = result && tester.selectFuncs6();
    result = result && tester.selectFuncs7();
    result = result && tester.selectFuncInFunc1();
    result = result && tester.selectFuncInFunc2();
    result = result && tester.selectIF1();
    result = result && tester.selectIF2();
    result = result && tester.selectIF3();
    result = result && tester.selectIF4();
    result = result && tester.selectWhereCalc1();
    result = result && tester.selectWhereCalc2();
    result = result && tester.selectCase1();
    result = result && tester.selectCase2();
    result = result && tester.selectAlias1();
    result = result && tester.groupPivot1();
    result = result && tester.groupPivot2();
    result = result && tester.groupPivot3();
    result = result && tester.groupFunc1();
    result = result && tester.groupFunc2();
    result = result && tester.selectInGroupByPivot1();
    result = result && tester.selectInGroupByPivot2();
    result = result && tester.selectInGroupByPivot3();
    result = result && tester.selectCount1();
    result = result && tester.selectCount2();
    result = result && tester.selectCount3();
    result = result && tester.selectCount4();
    result = result && tester.selectCount5();
    result = result && tester.selectCount6();
    result = result && tester.selectGroupByNotInSelect();
    result = result && tester.selectGroupByNotInSelect2();
    result = result && tester.selectOrderByNotInSelect();
    result = result && tester.selectCoalesce();
    result = result && tester.selectConcat_Ws();
    result = result && tester.selectConcat_Ws2();
    result = result && tester.selectNoTitle1();
    result = result && tester.selectNested();
    result = result && tester.selectNested2();
    result = result && tester.selectCorrelatedSubQuery1();
    result = result && tester.selectCorrelatedSubQuery2();
    result = result && tester.selectCorrelatedSubQuery3();
    result = result && tester.selectCorrelatedSubQuery4();
    result = result && tester.selectCorrelatedSubQuery5();
    result = result && tester.selectCorrelatedSubQuery6();
    result = result && tester.selectCorrelatedSubQuery7();
    result = result && tester.selectCorrelatedSubQuery8();
    result = result && tester.selectCorrelatedSubQuery9();
    result = result && tester.selectCorrelatedSubQuery10();
    result = result && tester.selectCorrelatedSubQuery11();
    result = result && tester.selectFromSubQuery1();
    result = result && tester.selectFromSubQuery2();
    result = result && tester.selectFromSubQuery3();
    result = result && tester.selectFromSubQuery4();
    result = result && tester.selectFromSubQuery5();
    result = result && tester.selectFromSubQuery6();
    result = result && tester.selectFromSubQuery7();
    result = result && tester.selectConvertFunction();
    result = result && tester.selectJoinMultipleConditions();
    result = result && tester.selectJoinOnExpression1();
    result = result && tester.selectJoinMultipleConditions2();
    result = result && tester.selectJoinOnExpression2();
    result = result && tester.selectJoinOnExpression3();
    result = result && tester.selectJoinLeftRightSwitchedInCondition();
    result = result && tester.selectJoinMultipleConditions3();
    result = result && tester.selectSingleQuoteDataWithCalculation();
    result = result && tester.selectGroupByCalculatedField();
    result = result && tester.selectGroupByCalculatedFieldNotInSelectFieldList();
    result = result && tester.selectGroupByCalculatedField2();
    result = result && tester.selectOrderByCalculated();
    result = result && tester.selectOrderByCalculated2();
    //  This test causes problems on gsSqlTest sheet (too big)
    // result = result && tester.joinBigTables1();
    result = result && tester.removeTrailingEmptyRecords();
    result = result && tester.selectWhereLike3();
    result = result && tester.selectWhereLike4();
    result = result && tester.selectFromSubQuery8();
    result = result && tester.selectFromSubQuery9();

    Logger.log("============================================================================");

    result = result && tester.selectBadTable1();
    result = result && tester.selectBadMath1();
    result = result && tester.selectBadField1();
    result = result && tester.selectBadField1a();
    result = result && tester.selectBadField2();
    result = result && tester.selectBadField3();
    result = result && tester.selectBadField4();
    result = result && tester.selectBadField5();
    result = result && tester.selectBadOp1();
    result = result && tester.selectBadAs1();
    result = result && tester.selectBadConstant1();
    result = result && tester.selectBadConstant2();
    result = result && tester.nonSelect1();
    result = result && tester.badJoin1();
    result = result && tester.badJoin2();
    result = result && tester.badJoin3();
    result = result && tester.badJoin4();
    result = result && tester.badJoin5();
    result = result && tester.badOrderBy1();
    result = result && tester.badOrderBy2();
    result = result && tester.bindVariableMissing();
    result = result && tester.bindVariableMissing1();
    result = result && tester.selectNoFrom();
    result = result && tester.selectNoTitles();
    result = result && tester.selectFromSubQueryNoAlias();
    result = result && tester.pivotGroupByMissing();
    result = result && tester.badUnion1();
    result = result && tester.badFieldNames1();

    //  Sql.js unit tests.
    result = result && tester.parseTableSettings1();
    result = result && tester.parseTableSettings2();
    result = result && tester.parseTableSettings3();
    result = result && tester.parseTableSettings4();
    result = result && tester.parseTableSettings5();
    result = result && tester.parseTableSettings6();
    result = result && tester.parseTableSettings7();
    result = result && tester.parseTableSettings8();
    result = result && tester.parseTableSettings9();
    result = result && tester.parseTableSettings10();
    result = result && tester.parseTableSettings11();
    result = result && tester.parseTableSettings12();
    result = result && tester.parseTableSettings13();
    result = result && tester.parseTableSettings14();
    result = result && tester.parseTableSettings15();

    result = result && tester.testTableData1();
    result = result && tester.testTableData2();
    result = result && tester.badParseTableSettings1();

    tester.isEqual("===  E N D   O F   T E S T S  ===", true, result);

    return result;
}