![Your Repository’s Stats](https://github-readme-stats.vercel.app/api?username=demmings&show_icons=true)

[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=demmings_gsSQL&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=demmings_gsSQL)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=demmings_gsSQL&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=demmings_gsSQL)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=demmings_gsSQL&metric=bugs)](https://sonarcloud.io/summary/new_code?id=demmings_gsSQL)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=demmings_gsSQL&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=demmings_gsSQL)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=demmings_gsSQL&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=demmings_gsSQL)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=demmings_gsSQL&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=demmings_gsSQL)
[![CodeQL](https://github.com/demmings/gsSQL/actions/workflows/codeql.yml/badge.svg)](https://github.com/demmings/gsSQL/actions/workflows/codeql.yml)
[![DeepSource](https://deepsource.io/gh/demmings/gsSQL.svg/?label=active+issues&show_trend=true&token=uIplDc6IW1XQfmDks0l97l4C)](https://deepsource.io/gh/demmings/gsSQL/?ref=repository-badge)
[![GitHub Super-Linter](https://github.com/demmings/gsSQL/workflows/Lint%20Code%20Base/badge.svg)](https://github.com/marketplace/actions/super-linter)
[![Coverage Status](https://coveralls.io/repos/github/demmings/gsSQL/badge.svg)](https://coveralls.io/github/demmings/gsSQL)

[![NPM](https://nodei.co/npm/@demmings/gssql.png?compact=true)](https://npmjs.org/package/@demmings/gssql)
[![npm version](https://badge.fury.io/js/@demmings%2Fgssql.png)](https://badge.fury.io/js/@demmings%2Fgssql)
<img alt="npm" src="https://img.shields.io/npm/dt/@demmings/gssql?style=plastic">


---

# About

<table>
<tr>
<td>
  
**gsSQL** is a **high-quality** custom function for _Google Sheets_ that aims to **provide standard SQL SELECT syntax** to quickly **filter and summarize data**, using any **sheet or range** as an SQL table.

Easy to learn and understand: the **SQL query** consists mainly of English statements, making it easy to write - rather than the cryptic syntax of the **Google Sheet QUERY** function.

</td>
</tr>
</table>

![gsSQL GIF Demo](img/example1.gif)

> **gsSQL** Demo of SELECT statement using JOIN and calculated fields.

<br/>

---

# Why use gsSQL
- It's easier and less work than using QUERY.
- It is less cryptic when attempting simple things like JOIN and SELECT IN.

<br/>

# Example Data
- See table data that was used below.
- Each table is in its own sheet, where the sheet name is the table name.

---

<br/>

## Inner Join
| gsSQL | QUERY |
| ---   | ---   |
| ```=gsSQL("SELECT books.id, books.title, authors.first_name, authors.last_name FROM books INNER JOIN authors ON books.author_id = authors.id ORDER BY books.id")```  | No easy solution just using QUERY.  Not sure how to make it work 100%.  Book '9' should not be included. <br/> ```=ArrayFormula({Books!A1:B10,vlookup(Books!D1:D10, {Authors!A1:A6, Authors!B1:C6}, {2,3}, false)})```  &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;|

### gsSQL Results
| books.id | books.title | authors.first_name | authors.last_name |
|---|---|---|---|
| 1 | Time to Grow Up! | Ellen | Writer |
| 2 | Your Trip | Yao | Dou |
| 3 | Lovely Love | Donald | Brain |
| 4 | Dream Your Life | Ellen | Writer |
| 5 | Oranges | Olga | Savelieva |
| 6 | Your Happy Life | Yao | Dou |
| 7 | Applied AI | Jack | Smart |
| 8 | My Last Book | Ellen | Writer |

### QUERY Results
|id	|title	|#N/A	|#N/A|
|---|---|---|---|
|1	|Time to Grow Up!	|Ellen	|Writer|
|2	|Your Trip	|Yao	|Dou|
|3	|Lovely Love	|Donald	|Brain|
|4	|Dream Your Life	|Ellen	|Writer|
|5	|Oranges	|Olga	|Savelieva|
|6	|Your Happy Life	|Yao	|Dou|
|7	|Applied AI	|Jack	|Smart|
|9	|Book with Mysterious Author	|#N/A	|#N/A|
|8	|My Last Book	|Ellen	|Writer |

---
<br/>

## Multiple Inner Joins
| gsSQL | QUERY |
| ---   | ---   |
| ```=gsSQL("SELECT books.id, books.title, books.type, authors.last_name, translators.last_name FROM books INNER JOIN authors ON books.author_id = authors.id INNER JOIN translators ON books.translator_id = translators.id ORDER BY books.id")``` | No easy solution just using QUERY &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;|

### Results
| books.id | books.title | books.type | authors.last_name | translators.last_name |
|---|---|---|---|---|
| 2 | Your Trip | translated | Dou | Weng |
| 5 | Oranges | translated | Savelieva | Davies |
| 6 | Your Happy Life | translated | Dou | Green |
| 7 | Applied AI | translated | Smart | Edwards |

---

## Multiple Right Joins
| gsSQL | QUERY |
| ---   | ---   |
| ```=gsSQL("SELECT books.id, books.title, books.translator_id, editors.last_name, editors.id,  translators.last_name FROM books RIGHT JOIN editors ON books.editor_id = editors.id RIGHT JOIN translators ON books.translator_id = translators.id ORDER BY books.id")```| ={query(Books!A1:F10,"Select A,B,F where E matches '"&TEXTJOIN("\|",true,Editors!A1:A11)&"' AND F matches '"&TEXTJOIN("\|",true,Translators!A1:A5)&"' order by A", 1), {"Editors.Last_Name"; ARRAYFORMULA( VLOOKUP(query(Books!A2:F10,"Select E where E matches '"&TEXTJOIN("\|",true,Editors!A2:A11)&"' AND F matches '"&TEXTJOIN("\|",true,Translators!A2:A5)&"' order by A", -1), Editors!A2:C11, 3))}, {"Editors.ID"; ARRAYFORMULA( VLOOKUP(query(Books!A2:F10,"Select E where E matches '"&TEXTJOIN("\|",true,Editors!A2:A11)&"' AND F matches '"&TEXTJOIN("\|",true,Translators!A2:A5)&"' order by A", -1), Editors!A2:C11, 1))}, {"Translators.Last_Name"; ARRAYFORMULA( VLOOKUP(query(Books!A2:F10,"Select F where E matches '"&TEXTJOIN("\|",true,Editors!A2:A11)&"' AND F matches '"&TEXTJOIN("\|",true,Translators!A2:A5)&"' order by A", -1), Translators!A2:C11, 3))} } |

### gsSQL Results

| books.id | books.title | books.translator_id | editors.last_name | editors.id | translators.last_name |
|---|---|---|---|---|---|
| 2 | Your Trip | 32 | Johnson | 22 | Weng |
| 5 | Oranges | 31 | Wright | 25 | Davies |
| 6 | Your Happy Life | 33 | Johnson | 22 | Green |
| 7 | Applied AI | 34 | Evans | 23 | Edwards |
| 9 | Book with Mysterious Author | 34 | Evans | 23 | Edwards |

### QUERY Results
|id	|title	|translator id	|Editors.Last_Name	|Editors.ID	|Translators.Last_Name|
|---|---|---|---|---|---|
|2	|Your Trip	|32	|Johnson	|22	|Weng|
|5	|Oranges	|31	|Wright	|25	|Davies|
|6	|Your Happy Life	|33	|Johnson	|22	|Green|
|7	|Applied AI	|34	|Evans	|23	|Edwards|
|9	|Book with Mysterious Author	|34	|Evans	|23	|Edwards|

---

<br/>

## Full Join
| gsSQL | QUERY |
| ---   | ---   |
| ```=gsSQL("SELECT authors.id, authors.last_name, editors.id, editors.last_name FROM authors FULL JOIN editors ON authors.id = editors.id")``` | Life is too short finding a replacement QUERY.  &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;|

### Results

| authors.id | authors.last_name | editors.id | editors.last_name |
|---|---|---|---|
| 11 | Writer |  |  |
| 12 | Savelieva |  |  |
| 13 | Smart | 13 | Smart |
| 14 | Brain |  |  |
| 15 | Dou |  |  |
|  |  | 21 | Brown |
|  |  | 22 | Johnson |
|  |  | 23 | Evans |
|  |  | 24 | Roberts |
|  |  | 25 | Wright |
|  |  | 26 | Jones |
|  |  | 27 | Smith |
|  |  | 50 | Dumb |
|  |  | 51 | Smart |


## Select Where IN Select
| gsSQL | QUERY |
| ---   | ---   |
|```=gsSQL("SELECT books.id, books.title, books.author_id FROM books WHERE books.author_id IN (SELECT id from authors)ORDER BY books.title")``` | ```=QUERY(Books!A1:F10,"Select A,B,D where D matches '"&TEXTJOIN("\|",true,Authors!A1:A6)&"' order by B", 1)```|

| books.id | books.title | books.author_id |                    
|---|---|---|
| 7 | Applied AI | 13 |
| 4 | Dream Your Life | 11 |
| 3 | Lovely Love | 14 |
| 8 | My Last Book | 11 |
| 5 | Oranges | 12 |
| 1 | Time to Grow Up! | 11 |
| 6 | Your Happy Life | 15 |
| 2 | Your Trip | 15 |

## Select Like
| gsSQL | QUERY |
| ---   | ---   |
| ```=gsSQL("SELECT id, title, author_id FROM books WHERE author_id IN (select id from authors where first_name like '%ald') ORDER BY title")``` | ```=QUERY(Books!A1:F10,"Select A,B,D where D matches '"&TEXTJOIN("\|",true, query(Authors!A1:C5,"Select A where B contains 'ald'"))&"' order by B", 1))``` |

| id | title | author_id |
|---|---|---|
| 3 | Lovely Love | 14 |

---
##  Example Summary
* We could go on with more examples, but in general, using **gsSQL** is easier.
* You can see that most standard SELECT syntax is supported.

---

<br/>

# Example Source Table Data

## Authors
| id | first_name | last_name |
|---|---|---|
| 11 | Ellen | Writer |
| 12 | Olga | Savelieva |
| 13 | Jack | Smart |
| 14 | Donald | Brain |
| 15 | Yao | Dou |
---
## BookReturns
| RMA | Book Id | Customer ID | Quantity | Price | Date |
|---|---|---|---|---|---|
| Rma001 | 9 | c1 | 10 | 34.95 | 05/01/2022 |
| rma020 | 8 | c2 | 3 | 29.95 | 05/01/2022 |
| rmA030 | 7 | c2 | 5 | 18.99 | 05/01/2022 |
| RMA040 | 9 | c3 | 1 | 59.99 | 05/02/2022 |
| rma005 | 1 | c1 | 1 | 90 | 05/02/2022 |
| RMA600 | 2 | c4 | 100 | 65.49 | 05/03/2022 |
| Rma701 | 3 | c4 | 150 | 24.95 | 05/03/2022 |
| RmA800 | 4 | c4 | 50 | 19.99 | 05/03/2022 |
| RMA900 | 7 | c1 | 1 | 33.97 | 05/04/2022 |
| rma1010 | 7 | c2 | 100 | 17.99 | 05/04/2022 |
---
## BookSales
| Invoice | Book Id | Customer ID | Quantity | Price | Date |
|---|---|---|---|---|---|
| I7200 | 9 | C1 | 10 | 34.95 | 05/01/2022 |
| I7201 | 8 | C2 | 3 | 29.95 | 05/01/2022 |
| I7201 | 7 | C2 | 5 | 18.99 | 05/01/2022 |
| I7202 | 9 | C3 | 1 | 59.99 | 05/02/2022 |
| I7203 | 1 |  | 1 | 90 | 05/02/2022 |
| I7204 | 2 | C4 | 100 | 65.49 | 05/03/2022 |
| I7204 | 3 | C4 | 150 | 24.95 | 05/03/2022 |
| I7204 | 4 | C4 | 50 | 19.99 | 05/03/2022 |
| I7205 | 7 | C1 | 1 | 33.97 | 05/04/2022 |
| I7206 | 7 | C2 | 100 | 17.99 | 05/04/2022 |
---
## Books
| id | title | type | author id | editor id | translator id |
|---|---|---|---|---|---|
| 1 | Time to Grow Up! | original | 11 | 21 |  |
| 2 | Your Trip | translated | 15 | 22 | 32 |
| 3 | Lovely Love | original | 14 | 24 |  |
| 4 | Dream Your Life | original | 11 | 24 |  |
| 5 | Oranges | translated | 12 | 25 | 31 |
| 6 | Your Happy Life | translated | 15 | 22 | 33 |
| 7 | Applied AI | translated | 13 | 23 | 34 |
| 9 | Book with Mysterious Author | translated | 1 | 23 | 34 |
| 8 | My Last Book | original | 11 | 28 |  |
---
## Customer
| ID | Name | Address | City | Phone | eMail |
|---|---|---|---|---|---|
| C1 | Numereo Uno | 101 One Way | One Point City | 9051112111 | bigOne@gmail.com |
| C2 | Dewy Tuesdays | 202 Second St. | Second City | 4162022222 | twoguys@gmail.com |
| C3 | Tres Buon Goods | 3 Way St | Tres City | 5193133303 | thrice@hotmail.com |
| C4 | ForMe Resellers | 40 Four St | FourtNight City | 2894441234 | fourtimes@hotmail.com |
| C5 | Fe Fi Fo Giant Tiger | 5 ohFive St. | FifthDom | 4165551234 |    fiver@gmail.com |
| C6 | Sx in Cars | 6 Seventh St | Sx City | 6661116666 | gotyourSix@hotmail.com    |
| C7 | 7th Heaven | 7 Eight Crt. | Lucky City | 5551117777 |  timesAcharm@gmail.com  |
---
## Editors
| id | first name | last name |
|---|---|---|
| 13 | Jack | Smart |
| 21 | Daniel | Brown |
| 22 | Mark | Johnson |
| 23 | Maria | Evans |
| 24 | Cathrine | Roberts |
| 25 | Sebastian | Wright |
| 26 | Barbara | Jones |
| 27 | Matthew | Smith |
| 50 | Jack | Dumb |
| 51 | Daniel | Smart |
---
## Translators
| id | first_name | last_name |
|---|---|---|
| 31 | Ira | Davies |
| 32 | Ling | Weng |
| 33 | Kristian | Green |
| 34 | Roman | Edwards |

<br/>

---

# Usage

```=gsSQL( SelectSqlStatement, [TableDefinitions], [ColumnOutputFlag], [BindVariableData])```

1.  **SelectSqlStatement.**  (Required)
    * Only the **SELECT** statement is supported.
    * Most all common usage is supported (see below).  
    * The first row of the table MUST contain unique column titles (for field names).
      * To reference a field where the title contains spaces, just use the underscore in place of the space.
        * e.g.  Title = "Transaction Date", SELECT=```"SELECT transaction_date from master_transactions"```
    * If parameter 2 is to be omitted, the table must be a sheet name.  If the sheet name contains spaces, you must use single quotes around the table name within the select.
      * e.g.  ```select * from 'master transactions' where account = 'bank'```
    * Bind variables use the question mark as a placeholder.  There must be matching question marks to bind variable data - which is specified starting in parameter 4.  
      * e.g.  ```select * from transactions where transaction_date >= ? and transaction_date <= ?``` 
    * The PIVOT command is also supported.  The 'PIVOT field' if used is the last part of the statement.  It must be used in conjunction with 'group by'.
      * e.g.  ```select transaction_date, sum(gross), sum(amount) from mastertransactions where transaction_date >=  '01/01/2022' and transaction_date <= '05/19/2022' and expense_category in (select income from budgetCategories where income <> '') group by transaction_date pivot account```

2. **TableDefinitions**  (Optional) 
   * Defines each table referenced in **SELECT** statement.
   * If a table does not encompass an entire sheet or you need to specify a range for the data, a table definition is required.
   * The table definition is an Array of arrays.  Each inner array defines ONE table.
     * a) Table name - this is the table name referenced in the select. This is a logical table name which will associated with the data range.  It does not have to be the sheet name (string).
     * b) Range of data - the google range that contains the data with the first row containing titles (used as field names).  This is any valid Google Sheet range name (i.e. Sheet Name, A1 notation or named range), but it must be passed in as a **STRING** (string)
     * c) Cache seconds - (integer) number of seconds that data loaded from range is held in cache memory before another select of the same range would load again.
    * Use the CURLY bracket notations to create the double array of table definitions.  If two separate tables are used within your SELECT, the table specifications would be entered as follows.
        * **{{a, b, c}; {a, b, c}}**
        * e.g. ```gsSQL("select transaction_date, sum(gross), sum(amount) from mastertransactions where transaction_date >= '01/01/2022' and transaction_date <= '05/19/2022' and expense_category in (select income from budgetCategories where income <> '') group by transaction_date pivot account", {{"mastertransactions", "Master Transactions!$A$1:$I", 60};{"budgetCategories","budgetIncomeCategories", 3600}})```

    
3.  **ColumnOutputFlag**  (Optional)
    * Include column title in output or not. (true adds column titles, false omits the title row).
      * This example will include the title row on output.

![Title SELECTED](img/example2.png)

4.  **BindVariableData**. (Optional) 
    * There should be one data item listed PER question mark in the SELECT statement.  Data for the variables can be literal data, cell references (A1 notation), and named fields.
    * Using the data from the GIF above, here is an example a date input and appropriate data selected.
    * The dates are stored in named ranges **startDate** and **endDate**.

![Bind Variables](img/example3.png)

---

# Usage Bonus (for all you GAS lovers)

1.  The Google **QUERY** is only available as a sheet function and it is not available for use for your javascript functions.

2.  The Sql.gs (Sql.js) contains the Sql() class.  This is what the gsSQL() custom function uses to implement the data selects.
    * Commands can be chained.

    * Sql() Methods
      * addTableData(table, data, cacheSeconds) 
        *  **table** name referenced in SQL statement.
        *  **data**  either a double array with column title in first row OR a string indicating a sheet range (named range or A1 notation).
        *  **cacheSeconds**  number of seconds that loaded table data will be available from the cache after the initial loading.  default=0.
      * enableColumnTitle(true) 
        *  true or false.  Output a column title (default is none or false)
      * addBindParameter(value)
        *  For every question mark (no quotes) in your SELECT statement, there needs to be a matching bind variable data.  Call this method as for as many question marks in the select are used - in the order that they are found.
        *  Do not use for named range data, in that case use the method **addBindNamedRangeParameter**  
      * addBindNamedRangeParameter(nameRange)
        *   For a bind variable that references a SINGLE cell named range.  Input is a STRING.  
      * execute(stmt)
        * stmt:  SQL SELECT statement to run.  
            Returns a double array of data (first row is column title - if enabled).

3.  Example usage:
   
```
let stmt = "select date, sum(quantity) from bookReturns where date >= ? and date <= ? group by date pivot customer_id";

let data = new Sql()
            .addTableData("bookReturns", this.bookReturnsTable())
            .enableColumnTitle(true)
            .addBindParameter("05/01/2022")
            .addBindParameter("05/04/2022")
            .execute(stmt);
```


---

# Installing


1.  Copy files manually.
    * In the ./dist folder there is **ONE** required file:
      * gssql.js  
      * If you never plan to run the test suite, just use this ONE file in your app script.
      * None of the files in ./src are required if you use **gssql.js**
    * **OR** in the ./src folder there are **FIVE** required files:
      * SimpleParser.js
      * Sql.js
      * Table.js
      * TableData.js
      * Views.js
    * And the optional file
      * SqlTest.js
    * The simple approach is to copy and paste each file.
      * From your sheets Select **Extensions** and then **Apps Script**
      * Ensure that Editor is selected.  It is the **< >**
      * Click the PLUS sign beside **File** and then select **Script**
      * Find each file in turn in the **src** OR **dist** folder in the Github repository.
      * Click on a file, and then click on **Copy Raw Contents** which puts the file into your copy buffer.
      * Back in your Google Project, rename **Untitled** to the file name you just selected in Github.  It is not necessary to enter the .gs extension.
      * Remove the default contents of the file **myFunction()** and paste in the new content you have copied from Github (Ctrl-v).
      * Click the little diskette icon to save.
      * Continue with all five files until done.
      * Change to your spreadsheet screen and try typing in any cell
        * ```=gsSQL()```.  The new function with online help should be available.
  
2.  **clasp push**
    * Install the gsSQL source files locally.
      * Use ```npm install @demmings/gssql``` to install to node_modules folder.
        * I have included a sanity check after you have installed to your node_modules folder.  Look for "@demmings/gssql" folder and run ```npm test```
        * To find where your node_modules folder is just type ```npm root```
        * Please note that **gsSQL** is not really a node package since Google Sheets does not recognize this.  The use of **npm** to install is just a simple way to get the javascript to your local machine.
      * Clone the project from github repository to a local local.
        * In your existing local Google Sheet project, create a folder called **SQL** below your existing javascript source folder.
        * **clasp push** all your source files to Google.


---

# Supported SELECT syntax.
* All supported major keywords.
  * 'SELECT', 
  * 'FROM', 
  * 'JOIN', 
  * 'LEFT JOIN', 
  * 'RIGHT JOIN', 
  * 'INNER JOIN', 
  * 'FULL JOIN', 
  * 'ORDER BY', 
  * 'GROUP BY', 
  * 'HAVING', 
  * 'WHERE', 
  * 'LIMIT', 
  * 'UNION ALL', 
  * 'UNION', 
  * 'INTERSECT', 
  * 'EXCEPT', 
  * 'PIVOT'
* Supported **JOINS**
  * 'FULL JOIN'
  * 'RIGHT JOIN'
  * 'INNER JOIN'
  * 'LEFT JOIN'
* Supported **SET** commands.
  * 'UNION', 
  * 'UNION ALL', 
  * 'INTERSECT', 
  * 'EXCEPT'
* Aggregate Functions (group by)
  * "SUM", 
  * "MIN", 
  * "MAX", 
  * "COUNT", 
  * "AVG", 
  * "DISTINCT"
* SQL Server Functions
  * "ABS",
  * "CASE", 
  * "CEILING", 
  * "CHARINDEX",
  * "COALESCE",
  * "CONCAT_WS", 
  * "FLOOR", 
  * "IF", 
  * "LEFT", 
  * "LEN", 
  * "LENGTH", 
  * "LOG", 
  * "LOG10", 
  * "LOWER",
  * "LTRIM", 
  * "NOW", 
  * "POWER", 
  * "RAND", 
  * "REPLICATE", 
  * "REVERSE", 
  * "RIGHT", 
  * "ROUND", 
  * "RTRIM",
  * "SPACE", 
  * "STUFF", 
  * "SUBSTRING", 
  * "SQRT", 
  * "TRIM", 
  * "UPPER"
* Logical Operators.
  *  '='
  *  '>'
  *  '<'
  *  '>='
  *  '<>'
  *  '!='
  *  'LIKE'
  *  'NOT LIKE'
  *  'IN'
  *  'NOT IN'
  *  'IS NOT'
  *  'IS'
        

# NOTES
1.  First ROW of data MUST be the column name.
2.  If the column includes spaces, the SELECT statement must replace the spaces with an underscore.  e.g.:  "First Name" is the column and the select would be "select first_name from myTable"
3.  Column names do not support the period ".", so you must remove periods before trying the select.
4.  Column names must be unique (obviously).
5.  When specifying the input table definitions, you should only specify tables referenced in the SELECT as all data from every table is loaded into memory for processing.
6.  When ***gsSQL*** is used within your sheet multiple times and the same tables are also referenced multiple times, it makes sense to specify a cache seconds value.  For tables that change often and up to date info is required, keep the cache either very low or zero.  However, for tables that rarely change, it makes sense to cache for a longer period.  
7.  The Google cache does have size and duration limits.  If the table is huge, it is probably best to set the cache size to zero.  Also note that the cache has a duration limit of 21600 seconds.  Beyond that number of saeconds, the script properties are used to store the data - which may not be as quick as the cache and the long term cache has **VERY** limited capacity.
8.  Use BIND variables to simplify the SELECT statement.  In the following statement, you must supply 3 bind variables  e.g.
9.  BIND variables simplify the use of date comparisons.  The QUERY statement requires that you format the date in your SELECT.  Any DATE BIND variables are converted automatically.  Just specify the named range or A1 range in your gsSQL statement (without quotes) for each parameter and in your SELECT, just substitute with a question mark.  

---

# Known Issues:

Most all SELECT functionality is implemented, however if you want to do anything extremely fancy, it may not to work.  Check out the SqlTest.js to get an idea of the kind of commands that will work.  


1)  Field alias syntax is not fully supported.  It is currently only used for column titles that can be returned with the select data.
            
2)  Moderate amount of error checking.  When developing your SQL SELECT statements and something is not correct or not supported, the application may just fail without giving any real indication of the problem.  This needs improvements (although it is much improved since the first version).

3)  Not really an issue, but the use of bind variables does not mean that the SELECT is compiled and reused.  It is only to make your SELECT easier to read.

