//  Remove comments for testing in NODE
//
import { Sql } from './Sql.js';
export { Logger };

class Logger {
    static log(msg) {
        console.log(msg);
    }
}
//

function SQLselfTest() {
    testerSql();
}


class SqlTester {
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

    bookSalesTable() {
        return [
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

    }

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

    translatorsTable() {
        return [
            ["id", "first_name", "last_name"],
            ["31", "Ira", "Davies"],
            ["32", "Ling", "Weng"],
            ["33", "Kristian", "Green"],
            ["34", "Roman", "Edwards"]
        ];

    }

    selectAll1() {
        let stmt = "select * from authors";

        let testSQL = new Sql([
            ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["ID", "FIRST_NAME", "LAST_NAME"],
        ["11", "Ellen", "Writer"],
        ["12", "Olga", "Savelieva"],
        ["13", "Jack", "Smart"],
        ["14", "Donald", "Brain"],
        ["15", "Yao", "Dou"]];

        return this.isEqual("selectAll1", data, expected);
    }


    innerJoin1() {
        let stmt = "SELECT books.id, books.title, authors.first_name, authors.last_name " +
            "FROM books " +
            "INNER JOIN authors " +
            "ON books.author_id = authors.id" +
            "ORDER BY books.id";

        let testSQL = new Sql([["books", "",
            this.bookTable()], ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["books.id", "books.title", "authors.first_name", "authors.last_name"],
        ["1", "Time to Grow Up!", "Ellen", "Writer"],
        ["2", "Your Trip", "Yao", "Dou"],
        ["3", "Lovely Love", "Donald", "Brain"],
        ["4", "Dream Your Life", "Ellen", "Writer"],
        ["5", "Oranges", "Olga", "Savelieva"],
        ["6", "Your Happy Life", "Yao", "Dou"],
        ["7", "Applied AI", "Jack", "Smart"],
        ["8", "My Last Book", "Ellen", "Writer"]];

        return this.isEqual("innerJoin1", data, expected);
    }

    join2() {
        let stmt = "SELECT books.id, books.title, books.type, translators.last_name  " +
            "FROM books " +
            "JOIN translators " +
            "ON books.translator_id = translators.id " +
            "ORDER BY books.id";

        let testSQL = new Sql([["books", "",
            this.bookTable()], ["translators", "", this.translatorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["books.id", "books.title", "books.type", "translators.last_name"],
        ["2", "Your Trip", "translated", "Weng"],
        ["5", "Oranges", "translated", "Davies"],
        ["6", "Your Happy Life", "translated", "Green"],
        ["7", "Applied AI", "translated", "Edwards"],
        ["9", "Book with Mysterious Author", "translated", "Edwards"]];

        return this.isEqual("join2", data, expected);
    }

    join3() {
        let stmt = "SELECT books.id, books.title, editors.last_name " +
            "FROM books " +
            "LEFT JOIN editors " +
            "ON books.editor_id = editors.id " +
            "ORDER BY books.id";

        let testSQL = new Sql([["books", "", this.bookTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["books.id", "books.title", "editors.last_name"],
        ["1", "Time to Grow Up!", "Brown"],
        ["2", "Your Trip", "Johnson"],
        ["3", "Lovely Love", "Roberts"],
        ["4", "Dream Your Life", "Roberts"],
        ["5", "Oranges", "Wright"],
        ["6", "Your Happy Life", "Johnson"],
        ["7", "Applied AI", "Evans"],
        ["8", "My Last Book", ""],
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

        let testSQL = new Sql([["books", "", this.bookTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["books.id", "books.title", "editors.last_name"]
            , ["1", "Time to Grow Up!", "Brown"],
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

        let testSQL = new Sql([["books", "", this.bookTable()],
        ["translators", "", this.translatorsTable()],
        ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["books.id", "books.title", "books.type", "authors.last_name", "translators.last_name"],
        ["1", "Time to Grow Up!", "original", "Writer", ""],
        ["2", "Your Trip", "translated", "Dou", "Weng"],
        ["3", "Lovely Love", "original", "Brain", ""],
        ["4", "Dream Your Life", "original", "Writer", ""],
        ["5", "Oranges", "translated", "Savelieva", "Davies"],
        ["6", "Your Happy Life", "translated", "Dou", "Green"],
        ["7", "Applied AI", "translated", "Smart", "Edwards"],
        ["8", "My Last Book", "original", "Writer", ""],
        ["9", "Book with Mysterious Author", "translated", "", "Edwards"]];

        return this.isEqual("leftJoin1", data, expected);
    }

    rightJoin1() {
        let stmt = "SELECT books.id, books.title, editors.last_name, editors.id  " +
            "FROM books " +
            "RIGHT JOIN editors " +
            "ON books.editor_id = editors.id" +
            "ORDER BY books.id";

        let testSQL = new Sql([["books", "", this.bookTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["books.id", "books.title", "editors.last_name", "editors.id"],
        ["", "", "Smart", "13"],
        ["", "", "Jones", "26"],
        ["", "", "Smith", "27"],
        ["", "", "Dumb", "50"],
        ["", "", "Smart", "51"],
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

    fullJoin1() {
        let stmt = "SELECT authors.id, authors.last_name, editors.id, editors.last_name " +
            "FROM authors " +
            "FULL JOIN editors " +
            "ON authors.id = editors.id ";

        let testSQL = new Sql([["authors", "", this.authorsTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["authors.id", "authors.last_name", "editors.id", "editors.last_name"],
        ["11", "Writer", "", ""],
        ["12", "Savelieva", "", ""],
        ["13", "Smart", "13", "Smart"],
        ["14", "Brain", "", ""],
        ["15", "Dou", "", ""],
        ["", "", "21", "Brown"],
        ["", "", "22", "Johnson"],
        ["", "", "23", "Evans"],
        ["", "", "24", "Roberts"],
        ["", "", "25", "Wright"],
        ["", "", "26", "Jones"],
        ["", "", "27", "Smith"],
        ["", "", "50", "Dumb"],
        ["", "", "51", "Smart"]];

        return this.isEqual("fullJoin1", data, expected);
    }

    fullJoin2() {
        let stmt = "SELECT *, customers.address, customers.id, customers.name " +
            "FROM booksales " +
            "FULL JOIN customers " +
            "ON booksales.customer_id = customers.id ";

        let testSQL = new Sql([["booksales", "", this.bookSalesTable()],
        ["customers", "", this.customerTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["INVOICE", "BOOK_ID", "CUSTOMER_ID", "QUANTITY", "PRICE", "DATE", "customers.address", "customers.id", "customers.name"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022", "101 One Way", "C1", "Numereo Uno"],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022", "202 Second St.", "C2", "Dewy Tuesdays"],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022", "202 Second St.", "C2", "Dewy Tuesdays"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022", "3 Way St", "C3", "Tres Buon Goods"],
        ["I7203", "1", "", 1, 90, "05/02/2022", "", "", ""],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022", "40 Four St", "C4", "ForMe Resellers"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022", "40 Four St", "C4", "ForMe Resellers"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022", "40 Four St", "C4", "ForMe Resellers"],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022", "101 One Way", "C1", "Numereo Uno"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", "202 Second St.", "C2", "Dewy Tuesdays"],
        ["", "", "", "", "", "", "5 ohFive St.", "C5", "Fe Fi Fo Giant Tiger"],
        ["", "", "", "", "", "", "6 Seventh St", "C6", "Sx in Cars"],
        ["", "", "", "", "", "", "7 Eight Crt.", "C7", "7th Heaven"]];

        return this.isEqual("fullJoin2", data, expected);
    }

    whereIn1() {
        let stmt = "SELECT books.id, books.title, books.author_id " +
            "FROM books " +
            "WHERE books.author_id IN (SELECT id from authors)" +
            "ORDER BY books.title";

        let testSQL = new Sql([["books", "",
            this.bookTable()], ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

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

        let testSQL = new Sql([["books", "",
            this.bookTable()], ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["books.id", "books.title", "books.author_id"],
        ["4", "Dream Your Life", "11"],
        ["8", "My Last Book", "11"],
        ["5", "Oranges", "12"],
        ["1", "Time to Grow Up!", "11"]];

        return this.isEqual("whereIn2", data, expected);
    }

    whereNotIn1() {
        let stmt = "SELECT books.id, books.title, books.author_id " +
            "FROM books " +
            "WHERE books.author_id NOT IN (SELECT id from authors)" +
            "ORDER BY books.title";

        let testSQL = new Sql([["books", "",
            this.bookTable()], ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["books.id", "books.title", "books.author_id"],
        ["9", "Book with Mysterious Author", "1"]];

        return this.isEqual("whereNotIn1", data, expected);
    }

    whereAndOr1() {
        let stmt = "select * from bookSales where date > '05/01/2022' AND date < '05/04/2022' OR book_id = '9'";

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["INVOICE", "BOOK_ID", "CUSTOMER_ID", "QUANTITY", "PRICE", "DATE"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022"],
        ["I7203", "1", "", 1, 90, "05/02/2022"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022"]];

        return this.isEqual("whereAndOr1", data, expected);
    }

    groupBy1() {
        let stmt = "select bookSales.book_id, SUM(bookSales.Quantity) from bookSales group by book_id";

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()]], stmt, true);

        let data = testSQL.execute();

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

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["bookSales.customer_id", "SUM(bookSales.quantity)"],
        ["C2", 108],
        ["C4", 300]];

        return this.isEqual("groupBy2", data, expected);
    }

    groupBy3() {
        let stmt =
            "select bookSales.customer_id, date, SUM(bookSales.quantity) FROM booksales " +
            "GROUP BY customer_id, date";

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()]], stmt, true);

        let data = testSQL.execute();

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

    avgSelect1() {
        let stmt = "select AVG(quantity) from booksales";

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()], ["customer", "", this.customerTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["AVG(quantity)"], [42.1]];

        return this.isEqual("avgSelect1", data, expected);
    }

    funcsSelect2() {
        let stmt = "select AVG(quantity), MIN(quantity), MAX(quantity), SUM(quantity), COUNT(quantity) from booksales";

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()], ["customer", "", this.customerTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["AVG(quantity)", "MIN(quantity)", "MAX(quantity)", "SUM(quantity)", "COUNT(quantity)"],
        [42.1, 1, 150, 421, 10]];

        return this.isEqual("funcsSelect2", data, expected);
    }

    innerSelect1() {
        let stmt = "SELECT *, customer.name FROM bookSales " +
            "LEFT JOIN customer ON bookSales.customer_ID = customer.ID " +
            "WHERE bookSales.quantity > (select AVG(quantity) from booksales)";

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()], ["customer", "", this.customerTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["INVOICE", "BOOK_ID", "CUSTOMER_ID", "QUANTITY", "PRICE", "DATE", "customer.name"],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022", "ForMe Resellers"],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022", "ForMe Resellers"],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022", "ForMe Resellers"],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", "Dewy Tuesdays"]];

        return this.isEqual("innerSelect1", data, expected);
    }

    whereLike1() {
        let stmt = "select *, books.title, authors.first_name, editors.first_name, customer.name, customer.email, booksales.quantity from bookSales " +
            "LEFT JOIN books ON booksales.book_id = books.id " +
            "LEFT JOIN authors on books.author_id = authors.id " +
            "LEFT JOIN editors on books.editor_id = editors.id " +
            "LEFT JOIN customer on bookSales.customer_id = customer.id " +
            "WHERE customer.email LIKE '%gmail.com'";

        let testSQL = new Sql([
            ["bookSales", "", this.bookSalesTable()],
            ["customer", "", this.customerTable()],
            ["books", "", this.bookTable()],
            ["editors", "", this.editorsTable()],
            ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["INVOICE", "BOOK_ID", "CUSTOMER_ID", "QUANTITY", "PRICE", "DATE", "books.title", "authors.first_name", "editors.first_name", "customer.name", "customer.email", "booksales.quantity"],
        ["I7200", "9", "C1", 10, 34.95, "05/01/2022", "Book with Mysterious Author", "", "Maria", "Numereo Uno", "bigOne@gmail.com", 10],
        ["I7201", "8", "C2", 3, 29.95, "05/01/2022", "My Last Book", "Ellen", "", "Dewy Tuesdays", "twoguys@gmail.com", 3],
        ["I7201", "7", "C2", 5, 18.99, "05/01/2022", "Applied AI", "Jack", "Maria", "Dewy Tuesdays", "twoguys@gmail.com", 5],
        ["I7205", "7", "C1", 1, 33.97, "05/04/2022", "Applied AI", "Jack", "Maria", "Numereo Uno", "bigOne@gmail.com", 1],
        ["I7206", "7", "C2", 100, 17.99, "05/04/2022", "Applied AI", "Jack", "Maria", "Dewy Tuesdays", "twoguys@gmail.com", 100]];

        return this.isEqual("whereLike1", data, expected);
    }

    whereNotLike1() {
        let stmt = "select *, books.title, authors.first_name, editors.first_name, customer.name, customer.email, booksales.quantity from bookSales " +
            "LEFT JOIN books ON booksales.book_id = books.id " +
            "LEFT JOIN authors on books.author_id = authors.id " +
            "LEFT JOIN editors on books.editor_id = editors.id " +
            "LEFT JOIN customer on bookSales.customer_id = customer.id " +
            "WHERE customer.email NOT LIKE '%gmail.com'";

        let testSQL = new Sql([
            ["bookSales", "", this.bookSalesTable()],
            ["customer", "", this.customerTable()],
            ["books", "", this.bookTable()],
            ["editors", "", this.editorsTable()],
            ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["INVOICE", "BOOK_ID", "CUSTOMER_ID", "QUANTITY", "PRICE", "DATE", "books.title", "authors.first_name", "editors.first_name", "customer.name", "customer.email", "booksales.quantity"],
        ["I7202", "9", "C3", 1, 59.99, "05/02/2022", "Book with Mysterious Author", "", "Maria", "Tres Buon Goods", "thrice@hotmail.com", 1],
        ["I7203", "1", "", 1, 90, "05/02/2022", "Time to Grow Up!", "Ellen", "Daniel", "", "", 1],
        ["I7204", "2", "C4", 100, 65.49, "05/03/2022", "Your Trip", "Yao", "Mark", "ForMe Resellers", "fourtimes@hotmail.com", 100],
        ["I7204", "3", "C4", 150, 24.95, "05/03/2022", "Lovely Love", "Donald", "Cathrine", "ForMe Resellers", "fourtimes@hotmail.com", 150],
        ["I7204", "4", "C4", 50, 19.99, "05/03/2022", "Dream Your Life", "Ellen", "Cathrine", "ForMe Resellers", "fourtimes@hotmail.com", 50]];

        return this.isEqual("whereNotLike1", data, expected);
    }

    union1() {
        let stmt = "select * from authors UNION select * from editors";

        let testSQL = new Sql([
            ["editors", "", this.editorsTable()],
            ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["ID", "FIRST_NAME", "LAST_NAME"],
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

    unionAll1() {
        let stmt = "select * from authors UNION ALL select * from editors";

        let testSQL = new Sql([
            ["editors", "", this.editorsTable()],
            ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["ID", "FIRST_NAME", "LAST_NAME"],
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

    except1() {
        let stmt = "select * from authors EXCEPT select * from authors where last_name like 'S%'";

        let testSQL = new Sql([
            ["editors", "", this.editorsTable()],
            ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["ID", "FIRST_NAME", "LAST_NAME"],
        ["11", "Ellen", "Writer"],
        ["14", "Donald", "Brain"],
        ["15", "Yao", "Dou"]];

        return this.isEqual("except1", data, expected);
    }

    intersect1() {
        let stmt = "select * from editors INTERSECT select * from authors";

        let testSQL = new Sql([
            ["editors", "", this.editorsTable()],
            ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["ID", "FIRST_NAME", "LAST_NAME"],
        ["13", "Jack", "Smart"]];

        return this.isEqual("intersect1", data, expected);
    }

    orderByDesc1() {
        let stmt = "select * from bookSales order by DATE DESC";

        let testSQL = new Sql([
            ["bookSales", "", this.bookSalesTable()],
            ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["INVOICE", "BOOK_ID", "CUSTOMER_ID", "QUANTITY", "PRICE", "DATE"],
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

        let testSQL = new Sql([
            ["bookSales", "", this.bookSalesTable()],
            ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["INVOICE", "BOOK_ID", "CUSTOMER_ID", "QUANTITY", "PRICE", "DATE"],
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

    distinct1() {
        let stmt = "select distinct last_name from editors";

        let testSQL = new Sql([
            ["editors", "", this.editorsTable()],
            ["authors", "", this.authorsTable()]], stmt, true);

        let data = testSQL.execute();

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

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()]], stmt, true);

        let data = testSQL.execute();

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

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()]], stmt, true);

        let data = testSQL.execute();

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

    selectFuncs2() {
        let stmt = "select name, address, LEN(name), LENGTH(address), lower(name), upper(address), trim(email), ltrim(email), rtrim(email) from customer";

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()], ["customer", "", this.customerTable()]], stmt, true);

        let data = testSQL.execute();

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
        let stmt = "select name + ' = ' + upper(email), reverse(name), replicate(name,2) from customer";

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()], ["customer", "", this.customerTable()]], stmt, true);

        let data = testSQL.execute();

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
        let stmt = "select space(5), email, stuff(email, 2, 3, 'CJD'), substring(email, 5, 5) from customer";

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()], ["customer", "", this.customerTable()]], stmt, true);

        let data = testSQL.execute();

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

    selectFuncInFunc1() {
        let stmt = "select upper(substring(email, 5, 5)), trim(upper(email)) from customer";

        let testSQL = new Sql([["bookSales", "",
            this.bookSalesTable()], ["customer", "", this.customerTable()]], stmt, true);

        let data = testSQL.execute();

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

    selectIF1() {
        let stmt = "SELECT IF(authors.id = '', 'MISSING AUTHOR', authors.id), authors.last_name, IF(editors.id = '', 'MISSING EDITOR', editors.id), editors.last_name " +
            "FROM authors " +
            "FULL JOIN editors " +
            "ON authors.id = editors.id ";

        let testSQL = new Sql([["authors", "", this.authorsTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["IF(authors.id = '', 'MISSING AUTHOR', authors.id)", "authors.last_name", "IF(editors.id = '', 'MISSING EDITOR', editors.id)", "editors.last_name"],
        ["11", "Writer", "MISSING EDITOR", ""],
        ["12", "Savelieva", "MISSING EDITOR", ""],
        ["13", "Smart", "13", "Smart"],
        ["14", "Brain", "MISSING EDITOR", ""],
        ["15", "Dou", "MISSING EDITOR", ""],
        ["MISSING AUTHOR", "", "21", "Brown"],
        ["MISSING AUTHOR", "", "22", "Johnson"],
        ["MISSING AUTHOR", "", "23", "Evans"],
        ["MISSING AUTHOR", "", "24", "Roberts"],
        ["MISSING AUTHOR", "", "25", "Wright"],
        ["MISSING AUTHOR", "", "26", "Jones"],
        ["MISSING AUTHOR", "", "27", "Smith"],
        ["MISSING AUTHOR", "", "50", "Dumb"],
        ["MISSING AUTHOR", "", "51", "Smart"]];

        return this.isEqual("selectIF1", data, expected);
    }

    selectIF2() {
        let stmt = "SELECT quantity, price, if(price > 25, 'OVER $25', 'UNDER $25') " +
            "FROM booksales ";

        let testSQL = new Sql([["booksales", "", this.bookSalesTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

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

        let testSQL = new Sql([["booksales", "", this.bookSalesTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

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

        let testSQL = new Sql([["booksales", "", this.bookSalesTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

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

        let testSQL = new Sql([["booksales", "", this.bookSalesTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["quantity", "price", "price + quantity"],
        [100, 65.49, 165.49],
        [150, 24.95, 174.95],
        [100, 17.99, 117.99]];

        return this.isEqual("selectWhereCalc1", data, expected);
    }

    selectWhereCalc2() {
        let stmt = "SELECT quantity, price, quantity * price from booksales where price * quantity > 100";

        let testSQL = new Sql([["booksales", "", this.bookSalesTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

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

        let testSQL = new Sql([["booksales", "", this.bookSalesTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["quantity", "price", "CASE WHEN quantity = 1 THEN 'One Sold' WHEN quantity = 2 THEN 'Two Sold' WHEN quantity = 3 THEN 'Three Sold' WHEN quantity < 100 THEN 'Up to 100 Sold' ELSE quantity + ' items sold' END"],
        [10, 34.95, "UP TO 100 SOLD"],
        [3, 29.95, "THREE SOLD"],
        [5, 18.99, "UP TO 100 SOLD"],
        [1, 59.99, "ONE SOLD"],
        [1, 90, "ONE SOLD"],
        [100, 65.49, "100 ITEMS SOLD"],
        [150, 24.95, "150 ITEMS SOLD"],
        [50, 19.99, "UP TO 100 SOLD"],
        [1, 33.97, "ONE SOLD"],
        [100, 17.99, "100 ITEMS SOLD"]];

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

        let testSQL = new Sql([["booksales", "", this.bookSalesTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["quantity", "price", "summary"],
        [10, 34.95, "INVOICE=7200 10 ITEMS SOLD. ID=c1"],
        [3, 29.95, "INVOICE=7201 LOW VOLUME 89.85"],
        [5, 18.99, "INVOICE=7201 LOW VOLUME 94.94999999999999"],
        [1, 59.99, "INVOICE=7202 1 ITEMS SOLD. ID=c3"],
        [1, 90, "INVOICE=7203 $90, KA CHING."],
        [100, 65.49, "INVOICE=7204 100 OR 150"],
        [150, 24.95, "INVOICE=7204 100 OR 150"],
        [50, 19.99, "INVOICE=7204 50 ITEMS SOLD. ID=c4"],
        [1, 33.97, "INVOICE=7205 1 ITEMS SOLD. ID=c1"],
        [100, 17.99, "INVOICE=7206 100 OR 150"]];

        return this.isEqual("selectCase2", data, expected);
    }

    selectAlias1() {
        let stmt = "SELECT quantity as QTY, price as Pricing,  round(quantity * price) as Money from booksales where price * quantity > 100";

        let testSQL = new Sql([["booksales", "", this.bookSalesTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let data = testSQL.execute();

        let expected = [["QTY","Pricing","Money"],
        [10,34.95,350],
        [100,65.49,6549],
        [150,24.95,3743],
        [50,19.99,999],
        [100,17.99,1799]];

        return this.isEqual("selectAlias1", data, expected);
    }


    selectBadTable1() {
        let stmt = "SELECT quantity, price, quantity * price from booksail where price * quantity > 100";

        let testSQL = new Sql([["booksales", "", this.bookSalesTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let ex = "";
        try {
            let data = testSQL.execute();
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadTable1", ex);
    }

    selectBadMath1() {
        let stmt = "SELECT quantity, price, quantity # price from booksales where price * quantity > 100";

        let testSQL = new Sql([["booksales", "", this.bookSalesTable()],
        ["editors", "", this.editorsTable()]], stmt, true);

        let ex = "";
        try {
            let data = testSQL.execute();
        }
        catch (exceptionErr) {
            ex = exceptionErr;
        }

        return this.isFail("selectBadMath1", ex);
    }

    isFail(functionName, exceptionErr) {
        if (exceptionErr != "") {
            Logger.log(functionName + "() ***   S U C C E S S   ***");
        }
        else {
            Logger.log(functionName + "() ***   F A I L E D   ***");
            Logger.log("Exception was expected !!");
        }
    }

    isEqual(functionName, sqlDataArray, expectedArry) {
        let isEqualTest = false;
        let jsonData = JSON.stringify(sqlDataArray);
        let expectedJSON = JSON.stringify(expectedArry);

        if (jsonData != expectedJSON) {
            Logger.log(functionName + "() ***   F A I L E D   ***");
            Logger.log(jsonData);
        }
        else {
            Logger.log(functionName + "() ***   S U C C E S S   ***");
            isEqualTest = true;
        }

        return isEqualTest;
    }
}

//  Remove comments for testing in NODE
testerSql();

function testerSql() {
    var tester = new SqlTester();

    tester.selectAll1();
    tester.innerJoin1();
    tester.join2();
    tester.join3();
    tester.joinLimit1();
    tester.leftJoin1();
    tester.rightJoin1();
    tester.fullJoin1();
    tester.fullJoin2();
    tester.whereIn1();
    tester.whereIn2();
    tester.whereNotIn1();
    tester.whereAndOr1();
    tester.groupBy1();
    tester.groupBy2();
    tester.groupBy3();
    tester.avgSelect1();
    tester.funcsSelect2();
    tester.innerSelect1();
    tester.whereLike1();
    tester.whereNotLike1();
    tester.union1();
    tester.unionAll1();
    tester.except1();
    tester.intersect1();
    tester.orderByDesc1();
    tester.orderByDesc2();
    tester.distinct1();
    tester.selectMath1();
    tester.selectMathFunc1();
    tester.selectFuncs2();
    tester.selectFuncs3();
    tester.selectFuncs4();
    //    tester.selectFuncInFunc1();
    tester.selectIF1();
    tester.selectIF2();
    tester.selectIF3();
    tester.selectIF4();
    tester.selectWhereCalc1();
    tester.selectWhereCalc2();
    tester.selectCase1();
    tester.selectCase2();
    tester.selectAlias1();
    tester.selectBadTable1();
    tester.selectBadMath1();

    Logger.log("===  E N D   O F   T E S T S  ===");
}
