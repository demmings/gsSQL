![Your Repository’s Stats](https://github-readme-stats.vercel.app/api?username=demmings&show_icons=true)


# gsSQL
The Google Sheets ***QUERY*** function is very flexible and powerful.  However it is:

- Only available as a function in sheets.  It cannot be used to query data within your apps script (GAS).
- Beyond basic lookups, the syntax of your select statement can quickly get very complicated and verbose.
- Complicated QUERY statements written long ago become uninteligible, especially when your simulated JOINs to other 'tables' clutter up your long statements.
- References to fields using the column letters is both hard to figure out what is going on and also very brittle.  What happens when a column is inserted before those referenced in the SELECT.  Well it fails of course.
    
The gsSQL project is meant to help simplify your QUERY statements.  It is also available to be used from within your scripts.
All regular SQL SELECT syntax is supported, along with:

-The PIVOT option - which is also available from the QUERY command.  (A new column is created for each distinct data in the PIVOT field for EVERY aggregate field).
```
select date, sum(quantity) from bookReturns group by date pivot customer_id
```

-BIND variables are available.  These are used to help simplify your select statement. e.g.

```
    groupPivot3() {
        let stmt = "select date, sum(quantity) from bookReturns where date >= ? and date <= ? group by date pivot customer_id";

        let data = new Sql()
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
```

# USING gsSQL

1.  Copy the .js files into your google app script folder and CLASP PUSH if necessary.
2.  The SqlTest.js file is not required. It is just used for a basic sanity check for various SQL SELECT statements.
3.  The Sql.js file contains the custom function ***gsSQL***
4.  Sql.js file also contains the ***Sql()*** class which is used for app script SQL SELECT statement use. 


# Using from App Script.
example:
```
    whereNotIn1() {
        let stmt = "SELECT books.id, books.title, books.author_id " +
            "FROM books " +
            "WHERE books.author_id NOT IN (SELECT id from authors)" +
            "ORDER BY books.title";

        let data = new Sql()
            .addTableData("books", this.bookTable())
            .addTableData("authors", this.authorsTable())
            .enableColumnTitle(true)
            .execute(stmt);

        let expected = [["books.id", "books.title", "books.author_id"],
        ["9", "Book with Mysterious Author", "1"]];

        return this.isEqual("whereNotIn1", data, expected);
    }
    
    bookTable() {
        return [
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
    }
    
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
 ```
 
Sql() Methods:

    addTableData(table, data, cacheSeconds) 
        1)  table: name referenced in SQL statement.
        2)  data:  either a double array with column title in first row OR a string indicating a sheet range (named range or A1 notation).
        3)  cacheSeconds:  number of seconds that loaded table data will be available from the cache after the initial loading.  default=0.

    enableColumnTitle(true) 
        1)  true or false.  Output a column title (default is none or false)
        
    addBindParameter(value)
        1)  For every question mark (no quotes) in your SELECT statement, there needs to be a matching bind variable data.  Call this method as for as many question marks in the select are used - in the order that they are found.
        
    addBindNamedRangeParameter(nameRange)
        1)  For a bind variable that references a SINGLE cell named range.  Input is a STRING.  

    execute(stmt)
        1)  stmt:  SQL SELECT statement to run.  
            Returns a double array of data (first row is column title - if enabled).

Using from SHEETS as a custom function.
example:

        =gsSQL("[['masterTransactions', 'Master Transactions!$A$1:$I', 60], ['accounts', 'accountNamesData', 3600]]", "SELECT * FROM accounts WHERE registration = 'RRSP' UNION SELECT * from accounts WHERE registration = 'TFSA' ", true, [bindVar1, bindVar2, ...])
        
1.  First parameter is a double array of:  a) table name, b) Range of data, c) cache seconds
2.  Select statement.
3.  Include column title or not.

NOTE:
1.  First ROW of data MUST be the column name.
2.  If the column includes spaces, the SELECT statement must replace the spaces with an underscore.  e.g.:  "First Name" is the column and the select would be "select first_name from myTable"
3.  Column names do not support the period ".", so you must remove periods before trying the select.
4.  Column names must be unique (obviously).
5.  When specifying the input table definitions, you should only specify tables referenced in the SELECT as all data from every table is loaded into memory for processing.
6.  When ***gsSQL*** is used within your sheet multiple times and the same tables are also referenced multiple times, it makes sense to specify a cache seconds value.  For tables that change often and up to date info is required, keep the cache either very low or zero.  However, for tables that rarely change, it makes sense to cache for a longer period.  
7.  The Google cache does have size and duration limits.  If the table is huge, it is probably best to set the cache size to zero.  Also note that the cache has a duration limit of 21600 seconds.  Beyond that number of seconds, the script properties are used to store the data - which may not be as quick as the cache.
8.  Use BIND variables to simplify the SELECT statement.  In the following statement, you must supply 3 bind variables  e.g.

```
SELECT * FROM books WHERE author_id IN (select id from authors where first_name = ?) or editor_id in (select id from editors where last_name = ?) or title = ? ORDER BY title
```

9.  BIND variables simplify the use of date comparisons.  The QUERY statement requires that you format the date in your SELECT.  Any DATE BIND variables are converted automatically.  Just specify the named range or A1 range in your gsSQL statement (without quotes) for each parameter and in your SELECT, just substitute with a question mark.  Here is an example from my sheet:

```
=-gsSQL("[['mastertransactions', 'Master Transactions!$A$1:$I',60]]","select sum(amount) from mastertransactions where account = ? and expense_category = ? and transaction_date >= ? and transaction_date <= ?", false, myName, "Savings - TFSA", startIncomeDate, endIncomeDate)
```

# WARNING:

The BASIC SELECT functionality is implemented, however if you want to do anything extremely fancy, it is most likely not going to work.  Check out the SqlTest.js to get an idea of the kind of commands that will work.  

Known Issues:

1)  Field alias syntax is not fully supported.  It is currently only used for column titles that can be returned with the select data.
            
2)  Very little error checking.  When developing your SQL SELECT statements and something is not correct or not supported, the application may just fail without giving any real indication of the problem.  This needs improvements.

3)  Not really an issue, but the use of bind variables does not mean that the SELECT is compiled and reused.  It is only to make your SELECT easier to read.
