/*  *** DEBUG START ***
//  Remove comments for testing in NODE
export { SqlParse };
//  *** DEBUG END ***/

//  Code inspired from:  https://github.com/dsferruzza/simpleSqlParser

/**
 * @classdesc 
 * Parse SQL SELECT statement and convert into Abstract Syntax Tree 
 */
class SqlParse {
    /**
     * @param {String} cond 
     * @returns {String}
     */
    static sqlCondition2JsCondition(cond) {
        const ast = SqlParse.sql2ast(`SELECT A FROM c WHERE ${cond}`);
        let sqlData = "";

        if (typeof ast.WHERE !== 'undefined') {
            const conditions = ast.WHERE;
            if (typeof conditions.logic === 'undefined') {
                sqlData = SqlParse.resolveSqlCondition("OR", [conditions]);
            }
            else {
                sqlData = SqlParse.resolveSqlCondition(conditions.logic, conditions.terms);
            }

        }

        return sqlData;
    }

    /**
     * Parse a query
     * @param {String} query 
     * @returns {Object}
     */
    static sql2ast(query) {
        // Define which words can act as separator
        const myKeyWords = SqlParse.generateUsedKeywordList(query);
        const [parts_name, parts_name_escaped] = SqlParse.generateSqlSeparatorWords(myKeyWords);

        //  Include brackets around separate selects used in things like UNION, INTERSECT...
        let modifiedQuery = SqlParse.sqlStatementSplitter(query);

        // Hide words defined as separator but written inside brackets in the query
        modifiedQuery = SqlParse.hideInnerSql(modifiedQuery, parts_name_escaped, SqlParse.protect);

        // Write the position(s) in query of these separators
        const parts_order = SqlParse.getPositionsOfSqlParts(modifiedQuery, parts_name);

        // Delete duplicates (caused, for example, by JOIN and INNER JOIN)
        SqlParse.removeDuplicateEntries(parts_order);

        // Generate protected word list to reverse the use of protect()
        let words = parts_name_escaped.slice(0);
        words = words.map(item => SqlParse.protect(item));

        // Split parts
        const parts = modifiedQuery.split(new RegExp(parts_name_escaped.join('|'), 'i'));

        // Unhide words precedently hidden with protect()
        for (let i = 0; i < parts.length; i++) {
            parts[i] = SqlParse.hideInnerSql(parts[i], words, SqlParse.unprotect);
        }

        // Analyze parts
        const result = SqlParse.analyzeParts(parts_order, parts);

        if (typeof result.FROM !== 'undefined' && typeof result.FROM.FROM !== 'undefined' && typeof result.FROM.FROM.as !== 'undefined') {
            if (result.FROM.FROM.as === '') {
                throw new Error("Every derived table must have its own alias");
            }

            //   Subquery FROM creates an ALIAS name, which is then used as FROM table name.
            result.FROM.table = result.FROM.FROM.as;
            result.FROM.isDerived = true;
        }

        return result;
    }

    /**
    * 
    * @param {String} logic 
    * @param {Object} terms 
    * @returns {String}
    */
    static resolveSqlCondition(logic, terms) {
        let jsCondition = "";

        for (const cond of terms) {
            if (typeof cond.logic === 'undefined') {
                if (jsCondition !== "" && logic === "AND") {
                    jsCondition += " && ";
                }
                else if (jsCondition !== "" && logic === "OR") {
                    jsCondition += " || ";
                }

                jsCondition += ` ${cond.left}`;
                if (cond.operator === "=") {
                    jsCondition += " == ";
                }
                else {
                    jsCondition += ` ${cond.operator}`;
                }
                jsCondition += ` ${cond.right}`;
            }
            else {
                jsCondition += SqlParse.resolveSqlCondition(cond.logic, cond.terms);
            }
        }

        return jsCondition;
    }

    /**
     * 
     * @param {String} query
     * @returns {String[]} 
     */
    static generateUsedKeywordList(query) {
        const generatedList = new Set();
        // Define which words can act as separator
        const keywords = ['SELECT', 'FROM', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'ORDER BY', 'GROUP BY', 'HAVING', 'WHERE', 'LIMIT', 'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT', 'PIVOT'];

        const modifiedQuery = query.toUpperCase();

        for (const word of keywords) {
            let pos = 0;
            while (pos !== -1) {
                pos = modifiedQuery.indexOf(word, pos);

                if (pos !== -1) {
                    generatedList.add(query.substring(pos, pos + word.length));
                    pos++;
                }
            }
        }

        // @ts-ignore
        return [...generatedList];
    }

    /**
     * 
     * @param {String[]} keywords 
     * @returns {String[][]}
     */
    static generateSqlSeparatorWords(keywords) {
        let parts_name = keywords.map(item => `${item} `);
        parts_name = parts_name.concat(keywords.map(item => `${item}(`));
        const parts_name_escaped = parts_name.map(item => item.replace('(', '[\\(]'));

        return [parts_name, parts_name_escaped];
    }

    /**
     * 
     * @param {String} src 
     * @returns {String}
     */
    static sqlStatementSplitter(src) {
        let newStr = src;

        // Define which words can act as separator
        const reg = SqlParse.makeSqlPartsSplitterRegEx(["UNION ALL", "UNION", "INTERSECT", "EXCEPT"]);

        const matchedUnions = reg.exec(newStr);
        if (matchedUnions === null || matchedUnions.length === 0) {
            return newStr;
        }

        let prefix = "";
        const parts = [];
        let pos = newStr.search(matchedUnions[0]);
        if (pos > 0) {
            prefix = newStr.substring(0, pos);
            newStr = newStr.substring(pos + matchedUnions[0].length);
        }

        for (let i = 1; i < matchedUnions.length; i++) {
            const match = matchedUnions[i];
            pos = newStr.search(match);

            parts.push(newStr.substring(0, pos));
            newStr = newStr.substring(pos + match.length);
        }
        if (newStr.length > 0)
            parts.push(newStr);

        newStr = prefix;
        for (let i = 0; i < matchedUnions.length; i++) {
            newStr += `${matchedUnions[i]} (${parts[i]}) `;
        }

        return newStr;
    }

    /**
     * 
     * @param {String[]} keywords 
     * @returns {RegExp}
     */
    static makeSqlPartsSplitterRegEx(keywords) {
        // Define which words can act as separator
        let parts_name = keywords.map(item => `${item} `);
        parts_name = parts_name.concat(keywords.map(item => `${item}(`));
        parts_name = parts_name.concat(parts_name.map(item => item.toLowerCase()));
        const parts_name_escaped = parts_name.map(item => item.replace('(', '[\\(]'));

        return new RegExp(parts_name_escaped.join('|'), 'gi');
    }

    /**
     * 
     * @param {String} str 
     * @param {String[]} parts_name_escaped
     * @param {Object} replaceFunction
     */
    static hideInnerSql(str, parts_name_escaped, replaceFunction) {
        if (str.indexOf("(") === -1 && str.indexOf(")") === -1)
            return str;

        let bracketCount = 0;
        let endCount = -1;
        let newStr = str;

        for (let i = newStr.length - 1; i >= 0; i--) {
            const ch = newStr.charAt(i);

            if (ch === ")") {
                bracketCount++;

                if (bracketCount === 1) {
                    endCount = i;
                }
            }
            else if (ch === "(") {
                bracketCount--;
                if (bracketCount === 0) {

                    let query = newStr.substring(i, endCount + 1);

                    // Hide words defined as separator but written inside brackets in the query
                    query = query.replace(new RegExp(parts_name_escaped.join('|'), 'gi'), replaceFunction);

                    newStr = newStr.substring(0, i) + query + newStr.substring(endCount + 1);
                }
            }
        }
        return newStr;
    }

    /**
     * 
     * @param {String} modifiedQuery 
     * @param {String[]} parts_name 
     * @returns {String[]}
     */
    static getPositionsOfSqlParts(modifiedQuery, parts_name) {
        // Write the position(s) in query of these separators
        const parts_order = [];

        /**
         * 
         * @param {String} _match 
         * @param {String} name 
         * @returns {String}
         */
        function realNameCallback(_match, name) {
            return name;
        }

        parts_name.forEach(item => {
            let pos = 0;
            let part = 0;

            do {
                part = modifiedQuery.indexOf(item, pos);
                if (part !== -1) {
                    const realName = item.replace(/^((\w|\s)+?)\s?\(?$/i, realNameCallback);

                    if (typeof parts_order[part] === 'undefined' || parts_order[part].length < realName.length) {
                        parts_order[part] = realName;	// Position won't be exact because the use of protect()  (above) and unprotect() alter the query string ; but we just need the order :)
                    }

                    pos = part + realName.length;
                }
            }
            while (part !== -1);
        });

        return parts_order;
    }

    /**
     * Delete duplicates (caused, for example, by JOIN and INNER JOIN)
     * @param {String[]} parts_order
     */
    static removeDuplicateEntries(parts_order) {
        let busy_until = 0;
        parts_order.forEach((item, key) => {
            if (busy_until > key) {
                delete parts_order[key];
            }
            else {
                busy_until = key + item.length;

                // Replace JOIN by INNER JOIN
                if (item.toUpperCase() === 'JOIN')
                    parts_order[key] = 'INNER JOIN';
            }
        });
    }

    /**
     * Add some # inside a string to avoid it to match a regex/split
     * @param {String} str 
     * @returns {String}
     */
    static protect(str) {
        let result = '#';
        const length = str.length;
        for (let i = 0; i < length; i++) {
            result += `${str[i]}#`;
        }
        return result;
    }

    /**
     * Restore a string output by protect() to its original state
     * @param {String} str 
     * @returns {String}
     */
    static unprotect(str) {
        let result = '';
        const length = str.length;
        for (let i = 1; i < length; i = i + 2) result += str[i];
        return result;
    }

    /**
     * 
     * @param {String[]} parts_order 
     * @param {String[]} parts 
     * @returns {Object}
     */
    static analyzeParts(parts_order, parts) {
        const result = {};
        let j = 0;
        parts_order.forEach(item => {
            const itemName = item.toUpperCase();
            j++;
            const selectComponentAst = SelectKeywordAnalysis.analyze(item, parts[j]);

            if (typeof result[itemName] !== 'undefined') {
                if (typeof result[itemName] === 'string' || typeof result[itemName][0] === 'undefined') {
                    const tmp = result[itemName];
                    result[itemName] = [];
                    result[itemName].push(tmp);
                }

                result[itemName].push(selectComponentAst);
            }
            else {
                result[itemName] = selectComponentAst;
            }

        });

        // Reorganize joins
        SqlParse.reorganizeJoins(result);

        if (typeof result.JOIN !== 'undefined') {
            result.JOIN.forEach((item, key) => { result.JOIN[key].cond = CondParser.parse(item.cond) });
        }

        SqlParse.reorganizeUnions(result);

        return result;
    }

    /**
     * 
     * @param {Object} result 
     */
    static reorganizeJoins(result) {
        const joinArr = [
            ['FULL JOIN', 'full'],
            ['RIGHT JOIN', 'right'],
            ['INNER JOIN', 'inner'],
            ['LEFT JOIN', 'left']
        ];

        for (const join of joinArr) {
            const [joinName, joinType] = join;
            SqlParse.reorganizeSpecificJoin(result, joinName, joinType);
        }
    }

    /**
     * 
     * @param {Object} result 
     * @param {String} joinName 
     * @param {String} joinType 
     */
    static reorganizeSpecificJoin(result, joinName, joinType) {
        if (typeof result[joinName] !== 'undefined') {
            if (typeof result.JOIN === 'undefined') result.JOIN = [];
            if (typeof result[joinName][0] !== 'undefined') {
                result[joinName].forEach(item => {
                    item.type = joinType;
                    result.JOIN.push(item);
                });
            }
            else {
                result[joinName].type = joinType;
                result.JOIN.push(result[joinName]);
            }
            delete result[joinName];
        }
    }

    /**
     * 
     * @param {Object} result 
     */
    static reorganizeUnions(result) {
        const astRecursiveTableBlocks = ['UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT'];

        for (const union of astRecursiveTableBlocks) {
            if (typeof result[union] === 'string') {
                result[union] = [SqlParse.sql2ast(SqlParse.parseUnion(result[union]))];
            }
            else if (typeof result[union] !== 'undefined') {
                for (let i = 0; i < result[union].length; i++) {
                    result[union][i] = SqlParse.sql2ast(SqlParse.parseUnion(result[union][i]));
                }
            }
        }
    }

    /**
     * 
     * @param {String} inStr 
     * @returns {String}
     */
    static parseUnion(inStr) {
        let unionString = inStr;
        if (unionString.startsWith("(") && unionString.endsWith(")")) {
            unionString = unionString.substring(1, unionString.length - 1);
        }

        return unionString;
    }
}

/*
 * LEXER & PARSER FOR SQL CONDITIONS
 * Inspired by https://github.com/DmitrySoshnikov/Essentials-of-interpretation
 */

/** Lexical analyzer for SELECT statement. */
class CondLexer {
    constructor(source) {
        this.source = source;
        this.cursor = 0;
        this.currentChar = "";
        this.startQuote = "";
        this.bracketCount = 0;

        this.readNextChar();
    }

    // Read the next character (or return an empty string if cursor is at the end of the source)
    readNextChar() {
        if (typeof this.source !== 'string') {
            this.currentChar = "";
        }
        else {
            this.currentChar = this.source[this.cursor++] ?? "";
        }
    }

    /**
     * Determine the next token
     * @returns {Object}
     */
    readNextToken() {
        if (/\w/.test(this.currentChar))
            return this.readWord();
        if (/["'`]/.test(this.currentChar))
            return this.readString();
        if (/[()]/.test(this.currentChar))
            return this.readGroupSymbol();
        if (/[!=<>]/.test(this.currentChar))
            return this.readOperator();
        if (/[+\-*/%]/.test(this.currentChar))
            return this.readMathOperator();
        if (this.currentChar === '?')
            return this.readBindVariable();

        if (this.currentChar === "") {
            return { type: 'eot', value: '' };
        }

        this.readNextChar();
        return { type: 'empty', value: '' };
    }

    /**
     * 
     * @returns {Object}
     */
    readWord() {
        let tokenValue = "";
        this.bracketCount = 0;
        let insideQuotedString = false;
        this.startQuote = "";

        while (/./.test(this.currentChar)) {
            // Check if we are in a string
            insideQuotedString = this.isStartOrEndOfString(insideQuotedString);

            if (this.isFinishedWord(insideQuotedString))
                break;

            tokenValue += this.currentChar;
            this.readNextChar();
        }

        if (/^(AND|OR)$/i.test(tokenValue)) {
            return { type: 'logic', value: tokenValue.toUpperCase() };
        }

        if (/^(IN|IS|NOT|LIKE|NOT EXISTS|EXISTS)$/i.test(tokenValue)) {
            return { type: 'operator', value: tokenValue.toUpperCase() };
        }

        return { type: 'word', value: tokenValue };
    }

    /**
     * 
     * @param {Boolean} insideQuotedString 
     * @returns {Boolean}
     */
    isStartOrEndOfString(insideQuotedString) {
        if (!insideQuotedString && /['"`]/.test(this.currentChar)) {
            this.startQuote = this.currentChar;

            return true;
        }
        else if (insideQuotedString && this.currentChar === this.startQuote) {
            //  End of quoted string.
            return false;
        }

        return insideQuotedString;
    }

    /**
     * 
     * @param {Boolean} insideQuotedString 
     * @returns {Boolean}
     */
    isFinishedWord(insideQuotedString) {
        if (insideQuotedString)
            return false;

        // Token is finished if there is a closing bracket outside a string and with no opening
        if (this.currentChar === ')' && this.bracketCount <= 0) {
            return true;
        }

        if (this.currentChar === '(') {
            this.bracketCount++;
        }
        else if (this.currentChar === ')') {
            this.bracketCount--;
        }

        // Token is finished if there is a operator symbol outside a string
        if (/[!=<>]/.test(this.currentChar)) {
            return true;
        }

        // Token is finished on the first space which is outside a string or a function
        return this.currentChar === ' ' && this.bracketCount <= 0;
    }

    /**
     * 
     * @returns {Object}
     */
    readString() {
        let tokenValue = "";
        const quote = this.currentChar;

        tokenValue += this.currentChar;
        this.readNextChar();

        while (this.currentChar !== quote && this.currentChar !== "") {
            tokenValue += this.currentChar;
            this.readNextChar();
        }

        tokenValue += this.currentChar;
        this.readNextChar();

        // Handle this case : `table`.`column`
        if (this.currentChar === '.') {
            tokenValue += this.currentChar;
            this.readNextChar();
            tokenValue += this.readString().value;

            return { type: 'word', value: tokenValue };
        }

        return { type: 'string', value: tokenValue };
    }

    /**
     * 
     * @returns {Object}
     */
    readGroupSymbol() {
        const tokenValue = this.currentChar;
        this.readNextChar();

        return { type: 'group', value: tokenValue };
    }

    /**
     * 
     * @returns {Object}
     */
    readOperator() {
        let tokenValue = this.currentChar;
        this.readNextChar();

        if (/[=<>]/.test(this.currentChar)) {
            tokenValue += this.currentChar;
            this.readNextChar();
        }

        return { type: 'operator', value: tokenValue };
    }

    /**
     * 
     * @returns {Object}
     */
    readMathOperator() {
        const tokenValue = this.currentChar;
        this.readNextChar();

        return { type: 'mathoperator', value: tokenValue };
    }

    /**
     * 
     * @returns {Object}
     */
    readBindVariable() {
        let tokenValue = this.currentChar;
        this.readNextChar();

        while (/\d/.test(this.currentChar)) {
            tokenValue += this.currentChar;
            this.readNextChar();
        }

        return { type: 'bindVariable', value: tokenValue };
    }
}

/** SQL Condition parser class. */
class CondParser {
    constructor(source) {
        this.lexer = new CondLexer(source);
        this.currentToken = {};

        this.readNextToken();
    }

    /**
     * Parse a string
     * @param {String} source 
     * @returns {Object}
     */
    static parse(source) {
        return new CondParser(source).parseExpressionsRecursively();
    }

    /**
     * Read the next token (skip empty tokens)
     * @returns {Object}
     */
    readNextToken() {
        this.currentToken = this.lexer.readNextToken();
        while (this.currentToken.type === 'empty')
            this.currentToken = this.lexer.readNextToken();
        return this.currentToken;
    }

    /**
     * Wrapper function ; parse the source
     * @returns {Object}
     */
    parseExpressionsRecursively() {
        return this.parseLogicalExpression();
    }

    /**
     * Parse logical expressions (AND/OR)
     * @returns {Object}
     */
    parseLogicalExpression() {
        let leftNode = this.parseConditionExpression();

        while (this.currentToken.type === 'logic') {
            const logic = this.currentToken.value;
            this.readNextToken();

            const rightNode = this.parseConditionExpression();

            // If we are chaining the same logical operator, add nodes to existing object instead of creating another one
            if (typeof leftNode.logic !== 'undefined' && leftNode.logic === logic && typeof leftNode.terms !== 'undefined')
                leftNode.terms.push(rightNode);
            else {
                const terms = [leftNode, rightNode].slice(0);
                leftNode = { logic, terms };
            }
        }

        return leftNode;
    }

    /**
     * Parse conditions ([word/string] [operator] [word/string])
     * @returns {Object}
     */
    parseConditionExpression() {
        let left = this.parseBaseExpression();

        if (this.currentToken.type !== 'operator') {
            return left;
        }

        let operator = this.currentToken.value;
        this.readNextToken();

        // If there are 2 adjacent operators, join them with a space (exemple: IS NOT)
        if (this.currentToken.type === 'operator') {
            operator += ` ${this.currentToken.value}`;
            this.readNextToken();
        }

        let right = null;
        if (this.currentToken.type === 'group' && (operator === 'EXISTS' || operator === 'NOT EXISTS')) {
            [left, right] = this.parseSelectExistsSubQuery();
        } else {
            right = this.parseBaseExpression(operator);
        }

        return { operator, left, right };
    }

    /**
     * 
     * @returns {Object[]}
     */
    parseSelectExistsSubQuery() {
        let rightNode = null;
        const leftNode = '""';

        this.readNextToken();
        if (this.currentToken.type === 'word' && this.currentToken.value === 'SELECT') {
            rightNode = this.parseSelectIn("", true);
            if (this.currentToken.type === 'group') {
                this.readNextToken();
            }
        }

        return [leftNode, rightNode];
    }

    // Parse base items
    /**
     * 
     * @param {String} operator 
     * @returns {Object}
     */
    parseBaseExpression(operator = "") {
        let astNode = {};

        // If this is a word/string, return its value
        if (this.currentToken.type === 'word' || this.currentToken.type === 'string') {
            astNode = this.parseWordExpression();
        }
        // If this is a group, skip brackets and parse the inside
        else if (this.currentToken.type === 'group') {
            astNode = this.parseGroupExpression(operator);
        }
        else if (this.currentToken.type === 'bindVariable') {
            astNode = this.currentToken.value;
            this.readNextToken();
        }

        return astNode;
    }

    /**
     * 
     * @returns {Object}
     */
    parseWordExpression() {
        let astNode = this.currentToken.value;
        this.readNextToken();

        if (this.currentToken.type === 'mathoperator') {
            astNode += ` ${this.currentToken.value}`;
            this.readNextToken();
            while ((this.currentToken.type === 'mathoperator' || this.currentToken.type === 'word') && this.currentToken.type !== 'eot') {
                astNode += ` ${this.currentToken.value}`;
                this.readNextToken();
            }
        }

        return astNode;
    }

    /**
     * 
     * @param {String} operator 
     * @returns {Object}
     */
    parseGroupExpression(operator) {
        this.readNextToken();
        let astNode = this.parseExpressionsRecursively();

        const isSelectStatement = typeof astNode === "string" && astNode.toUpperCase() === 'SELECT';

        if (operator === 'IN' || isSelectStatement) {
            astNode = this.parseSelectIn(astNode, isSelectStatement);
        }
        
        this.readNextToken();

        return astNode;
    }

    /**
     * 
     * @param {any} startAstNode 
     * @param {Boolean} isSelectStatement 
     * @returns {Object}
     */
    parseSelectIn(startAstNode, isSelectStatement) {
        let astNode = startAstNode;
        let inCurrentToken = this.currentToken;
        let bracketCount = 1;
        while (bracketCount !== 0 && inCurrentToken.type !== 'eot') {
            this.readNextToken();
            if (isSelectStatement) {
                astNode += ` ${inCurrentToken.value}`;
            }
            else {
                astNode += `, ${inCurrentToken.value}`;
            }

            inCurrentToken = this.currentToken;
            bracketCount += CondParser.groupBracketIncrementer(inCurrentToken);
        }

        if (isSelectStatement) {
            astNode = SqlParse.sql2ast(astNode);
        }

        return astNode;
    }

    /**
     * 
     * @param {Object} inCurrentToken 
     * @returns {Number}
     */
    static groupBracketIncrementer(inCurrentToken) {
        let diff = 0;
        if (inCurrentToken.type === 'group') {
            if (inCurrentToken.value === '(') {
                diff = 1;
            }
            else if (inCurrentToken.value === ')') {
                diff = -1;
            }
        }

        return diff
    }
}

/** Analyze each distinct component of SELECT statement. */
class SelectKeywordAnalysis {
    /**
     * 
     * @param {String} itemName 
     * @param {Object} part 
     * @returns {any}
     */
    static analyze(itemName, part) {
        const keyWord = itemName.toUpperCase().replace(/ /g, '_');

        if (typeof SelectKeywordAnalysis[keyWord] === 'undefined') {
            throw new Error(`Can't analyze statement ${itemName}`);
        }

        return SelectKeywordAnalysis[keyWord](part);
    }

    /**
     * 
     * @param {String} str 
     * @param {Boolean} isOrderBy 
     * @returns {Object[]}
     */
    static SELECT(str, isOrderBy = false) {
        const selectParts = SelectKeywordAnalysis.protect_split(',', str);
        const selectResult = selectParts.filter(item => item !== '')
            .map(item => SelectKeywordAnalysis.extractSelectField(item, isOrderBy));

        if (selectResult.length === 0) {
            throw new Error("No fields SELECTED.");
        }

        return selectResult;
    }

    /**
     * 
     * @param {String} item 
     * @param {Boolean} isOrderBy 
     * @returns {Object}
     */
    static extractSelectField(item, isOrderBy) {
        let order = "";
        if (isOrderBy) {
            const order_by = /^(.+?)(\s+ASC|DESC)?$/gi;
            const orderData = order_by.exec(item);
            if (orderData !== null) {
                order = typeof orderData[2] === 'undefined' ? "ASC" : SelectKeywordAnalysis.trim(orderData[2]);
                item = orderData[1].trim();
            }
        }

        //  Is there a column alias?
        const [name, as] = SelectKeywordAnalysis.getNameAndAlias(item);

        const splitPattern = /[\s()*/%+-]+/g;
        let terms = name.split(splitPattern);

        if (terms !== null) {
            const aggFunc = ["SUM", "MIN", "MAX", "COUNT", "AVG", "DISTINCT", "GROUP_CONCAT"];
            terms = (aggFunc.indexOf(terms[0].toUpperCase()) === -1) ? terms : null;
        }
        if (name !== "*" && terms !== null && terms.length > 1) {
            const subQuery = SelectKeywordAnalysis.parseForCorrelatedSubQuery(item);
            return { name, terms, as, subQuery, order };
        }

        return { name, as, order };
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object}
     */
    static FROM(str) {
        const subqueryAst = this.parseForCorrelatedSubQuery(str);
        if (subqueryAst !== null) {
            //  If there is a subquery creating a DERIVED table, it must have a derived table name.
            //  Extract this subquery AS tableName.
            const [, alias] = SelectKeywordAnalysis.getNameAndAlias(str);
            if (alias !== "" && typeof subqueryAst.FROM !== 'undefined') {
                subqueryAst.FROM.as = alias.toUpperCase();
            }

            return subqueryAst;
        }

        let fromParts = str.split(',');
        fromParts = fromParts.map(item => SelectKeywordAnalysis.trim(item));

        const fromResult = fromParts.map(item => {
            const [table, as] = SelectKeywordAnalysis.getNameAndAlias(item);
            return { table, as };
        });

        return fromResult[0];
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object}
     */
    static LEFT_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object}
     */
    static INNER_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object}
     */
    static RIGHT_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object}
     */
    static FULL_JOIN(str) {
        return SelectKeywordAnalysis.allJoins(str);
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object}
     */
    static allJoins(str) {
        const subqueryAst = this.parseForCorrelatedSubQuery(str);

        const strParts = str.toUpperCase().split(' ON ');
        const table = strParts[0].split(' AS ');
        const joinResult = {};
        joinResult.table = subqueryAst !== null ? subqueryAst : SelectKeywordAnalysis.trim(table[0]);
        joinResult.as = SelectKeywordAnalysis.trim(table[1]) ?? '';
        joinResult.cond = SelectKeywordAnalysis.trim(strParts[1]);

        return joinResult;
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object}
     */
    static WHERE(str) {
        return CondParser.parse(str);
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object[]}
     */
    static ORDER_BY(str) {
        return SelectKeywordAnalysis.SELECT(str, true);
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object[]}
     */
    static GROUP_BY(str) {
        return SelectKeywordAnalysis.SELECT(str);
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object[]}
     */
    static PIVOT(str) {
        const strParts = str.split(',');
        const pivotResult = [];

        strParts.forEach((item) => {
            const pivotOn = /([\w.]+)/gi;
            const pivotData = pivotOn.exec(item);
            if (pivotData !== null) {
                const tmp = {};
                tmp.name = SelectKeywordAnalysis.trim(pivotData[1]);
                tmp.as = "";
                pivotResult.push(tmp);
            }
        });

        return pivotResult;
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object}
     */
    static LIMIT(str) {
        const limitResult = {};
        limitResult.nb = Number(str);
        limitResult.from = 0;
        return limitResult;
    }

    /**
     * 
     * @param {String} str 
     * @returns {Object}
     */
    static HAVING(str) {
        return CondParser.parse(str);
    }

    /**
     * 
     * @param {String} str 
     * @returns {String}
     */
    static UNION(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    /**
     * 
     * @param {String} str 
     * @returns {String}
     */
    static UNION_ALL(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    /**
     * 
     * @param {String} str 
     * @returns {String}
     */
    static INTERSECT(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    /**
     * 
     * @param {String} str 
     * @returns {String}
     */
    static EXCEPT(str) {
        return SelectKeywordAnalysis.trim(str);
    }

    /**
     * 
     * @param {String} selectField 
     * @returns {Object}
     */
    static parseForCorrelatedSubQuery(selectField) {
        let subQueryAst = null;

        const regExp = /\(\s*(SELECT[\s\S]+)\)/i;
        const matches = regExp.exec(selectField);

        if (matches !== null && matches.length > 1) {
            subQueryAst = SqlParse.sql2ast(matches[1]);
        }

        return subQueryAst;
    }

    // Split a string using a separator, only if this separator isn't beetween brackets
    /**
     * 
     * @param {String} separator 
     * @param {String} str 
     * @returns {String[]}
     */
    static protect_split(separator, str) {
        const sep = '######';

        let inQuotedString = false;
        let quoteChar = "";
        let bracketCount = 0;
        let newStr = "";
        for (const c of str) {
            if (!inQuotedString && /['"`]/.test(c)) {
                inQuotedString = true;
                quoteChar = c;
            }
            else if (inQuotedString && c === quoteChar) {
                inQuotedString = false;
            }
            else if (!inQuotedString && c === '(') {
                bracketCount++;
            }
            else if (!inQuotedString && c === ')') {
                bracketCount--;
            }

            if (c === separator && (bracketCount > 0 || inQuotedString)) {
                newStr += sep;
            }
            else {
                newStr += c;
            }
        }

        let strParts = newStr.split(separator);
        strParts = strParts.map(item => SelectKeywordAnalysis.trim(item.replace(new RegExp(sep, 'g'), separator)));

        return strParts;
    }

    /**
     * 
     * @param {any} str 
     * @returns {any}
     */
    static trim(str) {
        if (typeof str === 'string')
            return str.trim();
        return str;
    }

    /**
    * If an ALIAS is specified after 'AS', return the field/table name and the alias.
    * @param {String} item 
    * @returns {String[]}
    */
    static getNameAndAlias(item) {
        let realName = item;
        let alias = "";
        const lastAs = SelectKeywordAnalysis.lastIndexOfOutsideLiteral(item.toUpperCase(), " AS ");
        if (lastAs !== -1) {
            const subStr = item.substring(lastAs + 4).trim();
            if (subStr.length > 0) {
                alias = subStr;
                //  Remove quotes, if any.
                if ((subStr.startsWith("'") && subStr.endsWith("'")) ||
                    (subStr.startsWith('"') && subStr.endsWith('"')) ||
                    (subStr.startsWith('[') && subStr.endsWith(']')))
                    alias = subStr.substring(1, subStr.length - 1);

                //  Remove everything after 'AS'.
                realName = item.substring(0, lastAs).trim();
            }
        }

        return [realName, alias];
    }

    /**
     * 
     * @param {String} srcString 
     * @param {String} searchString 
     * @returns {Number}
     */
    static lastIndexOfOutsideLiteral(srcString, searchString) {
        let index = -1;
        let inQuote = "";

        for (let i = 0; i < srcString.length; i++) {
            const ch = srcString.charAt(i);

            if (inQuote !== "") {
                //  The ending quote.
                if ((inQuote === "'" && ch === "'") || (inQuote === '"' && ch === '"') || (inQuote === "[" && ch === "]"))
                    inQuote = "";
            }
            else if ("\"'[".indexOf(ch) !== -1) {
                //  The starting quote.
                inQuote = ch;
            }
            else if (srcString.substring(i).startsWith(searchString)) {
                //  Matched search.
                index = i;
            }
        }

        return index;
    }
}
