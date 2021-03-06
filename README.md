# gsSQL
Use SQL SELECT syntax from within apps script code or as a Google Sheet function - to replace the QUERY function.

1.  Copy the .js files into your google app script folder and CLASP PUSH if necessary.
2.  The SqlTest.js file is not required. It is just used for a basic sanity check for various SQL SELECT statements.


Using from App Script.
example:

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
 
Sql() Methods:

    addTableData(table, data) 
        1)  table: name referenced in SQL statement.
        2)  data:  either a double array with column title in first row OR a string indicating a sheet range (named range or A1 notation).

    enableColumnTitle(true) 
        1)  true or false.  Output a column title (default is none or false)

    execute(stmt)
        1)  stmt:  SQL SELECT statement to run.  
            Returns a double array of data (first row is column title - if enabled).

Using from SHEETS as a custom function.
example:

        =gsSQL("[['masterTransactions', 'Master Transactions!$A$1:$I'], ['accounts', 'accountNamesData']]", "SELECT * FROM accounts WHERE registration = 'RRSP' UNION SELECT * from accounts WHERE registration = 'TFSA' ", true)
        
1.  First parameter is a double array of:  a) table name, b) Range of data.
2.  Select statement.
3.  Include column title or not.

NOTE:
1.  First ROW of data MUST be the column name.
2.  If the column includes spaces, the SELECT statement must replace the spaces with an underscore.  e.g.:  "First Name" is the column and the select would be "select first_name from myTable"
3.  Column names do not support the period ".", so you must remove periods before trying the select.
4.  Column names must be unique (obviously).
5.  When specifying the table name/data as a parameter, you should only specify tables referenced in the SELECT as all data from every table is loaded into memory for processing (I didn't say this was a memory optimized script).

WARNING:
I have used eval() and Function() to make my life easier.  If you believe that you will do some kind of injection attack on yourself at some later date, I urge you to modify the scripts to remove these from the program (or not use at all).

Most of the BASIC SELECT functionality is implemented, however if you want to do anything fancy, it is most likely not going to work.  Check out the SqlTest.js to get an idea of the kind of commands that will work.  

Known Issues:

1)  Field and table alias syntax is not supported.  So in a JOIN situation, you will need to use the full DOT notation to reference any field from the joined table.  The column ALIAS can be used for a column title in the return data.  e.g.:

        select bookSales.date as 'Transaction Date', 
                SUM(bookSales.Quantity) as [ as Much Quantity], 
                Max(price) as Maximum 
           from bookSales 
           where customer_id in (select id from customers)  
           group by date pivot customer_id
            
2)  Very little error checking.  When developing your SQL SELECT statements and something is not correct or not supported, the application may just fail without giving any real indication of the problem.  This needs improvements.
