//  Remove comments for testing in NODE
/*  *** DEBUG START ***
export { sql2ast, sqlCondition2JsCondition };
//  *** DEBUG END  ***/

//  Code inspired from:  https://github.com/dsferruzza/simpleSqlParser

function trim(str) {
    if (typeof str === 'string')
        return str.trim();
    else
        return str;
}

// Split a string using a separator, only if this separator isn't beetween brackets
function protect_split(separator, str) {
    const sep = '######';

    let string = false;
    let nb_brackets = 0;
    let new_str = "";
    for (let c of str) {
        if (!string && /['"`]/.test(c)) string = c;
        else if (string && c === string) string = false;
        else if (!string && c === '(') nb_brackets++;
        else if (!string && c === ')') nb_brackets--;

        if (c === separator && (nb_brackets > 0 || string)) new_str += sep;
        else new_str += c;
    }
    str = new_str;

    str = str.split(separator);
    str = str.map(function (item) {
        return trim(item.replace(new RegExp(sep, 'g'), separator));
    });

    return str;
}

// Add some # inside a string to avoid it to match a regex/split
function protect(str) {
    let result = '#';
    let length = str.length;
    for (let i = 0; i < length; i++) {
        result += str[i] + "#";
    }
    return result;
}

// Restore a string output by protect() to its original state
function unprotect(str) {
    let result = '';
    let length = str.length;
    for (let i = 1; i < length; i = i + 2) result += str[i];
    return result;
}

/**
 * 
 * @param {String} str 
 * @param {String[]} parts_name_escaped
 * @param {Object} replaceFunction
 */
function hideInnerSql(str, parts_name_escaped, replaceFunction) {
    if (str.indexOf("(") === -1 && str.indexOf(")") === -1)
        return str;

    let bracketCount = 0;
    let endCount = -1;

    for (let i = str.length - 1; i >= 0; i--) {
        let c = str.charAt(i);

        if (c === ")") {
            bracketCount++;

            if (bracketCount === 1) {
                endCount = i;
            }
        }
        else if (c === "(") {
            bracketCount--;
            if (bracketCount === 0) {

                let query = str.substring(i, endCount + 1);

                // Hide words defined as separator but written inside brackets in the query
                query = query.replace(new RegExp(parts_name_escaped.join('|'), 'gi'), replaceFunction);

                str = str.substring(0, i) + query + str.substring(endCount + 1);
            }
        }
    }
    return str;
}

/**
 * 
 * @param {String} src 
 * @returns {String}
 */
function sqlStatementSplitter(src) {
    let newStr = "";

    // Define which words can act as separator
    let reg = makeSqlPartsSplitterRegEx(["UNION ALL", "UNION", "INTERSECT", "EXCEPT"]);

    let matchedUnions = src.match(reg);
    if (matchedUnions === null || matchedUnions.length === 0)
        return src;

    let prefix = "";
    let parts = [];
    let pos = src.search(matchedUnions[0]);
    if (pos > 0) {
        prefix = src.substring(0, pos);
        src = src.substring(pos + matchedUnions[0].length);
    }

    for (let i = 1; i < matchedUnions.length; i++) {
        let match = matchedUnions[i];
        pos = src.search(match);

        parts.push(src.substring(0, pos));
        src = src.substring(pos + match.length);
    }
    if (src.length > 0)
        parts.push(src);

    newStr = prefix;
    for (let i = 0; i < matchedUnions.length; i++) {
        newStr += matchedUnions[i] + " (" + parts[i] + ") ";
    }

    return newStr;
}

/**
 * 
 * @param {String[]} keywords 
 * @returns {RegExp}
 */
function makeSqlPartsSplitterRegEx(keywords) {
    // Define which words can act as separator
    let parts_name = keywords.map(function (item) {
        return item + ' ';
    });
    parts_name = parts_name.concat(keywords.map(function (item) {
        return item + '(';
    }));
    parts_name = parts_name.concat(parts_name.map(function (item) {
        return item.toLowerCase();
    }));
    let parts_name_escaped = parts_name.map(function (item) {
        return item.replace('(', '[\\(]');
    });

    return new RegExp(parts_name_escaped.join('|'), 'gi');
}


// Parse a query
function sql2ast(query) {
    // Define which words can act as separator
    let keywords = ['SELECT', 'FROM', 'DELETE FROM', 'INSERT INTO', 'UPDATE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'ORDER BY', 'GROUP BY', 'HAVING', 'WHERE', 'LIMIT', 'VALUES', 'SET', 'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT', 'PIVOT'];
    let parts_name = keywords.map(function (item) {
        return item + ' ';
    });
    parts_name = parts_name.concat(keywords.map(function (item) {
        return item + '(';
    }));
    parts_name = parts_name.concat(parts_name.map(function (item) {
        return item.toLowerCase();
    }));
    let parts_name_escaped = parts_name.map(function (item) {
        return item.replace('(', '[\\(]');
    });

    query = sqlStatementSplitter(query);

    // Hide words defined as separator but written inside brackets in the query
    query = hideInnerSql(query, parts_name_escaped, protect);

    // Write the position(s) in query of these separators
    let parts_order = [];
    function realNameCallback(_match, name) {
        return name;
    }
    parts_name.forEach(function (item) {
        let pos = 0;
        let part;

        do {
            part = query.indexOf(item, pos);
            if (part !== -1) {
                let realName = item.replace(/^((\w|\s)+?)\s?\(?$/i, realNameCallback);

                if (typeof parts_order[part] === 'undefined' || parts_order[part].length < realName.length) {
                    parts_order[part] = realName;	// Position won't be exact because the use of protect()  (above) and unprotect() alter the query string ; but we just need the order :)
                }

                pos = part + realName.length;
            }
        }
        while (part !== -1);
    });

    // Delete duplicates (caused, for example, by JOIN and INNER JOIN)
    let busy_until = 0;
    parts_order.forEach(function (item, key) {
        if (busy_until > key) delete parts_order[key];
        else {
            busy_until = parseInt(key, 10) + item.length;

            // Replace JOIN by INNER JOIN
            if (item === 'JOIN') parts_order[key] = 'INNER JOIN';
        }
    });

    // Generate protected word list to reverse the use of protect()
    let words = parts_name_escaped.slice(0);
    words = words.map(function (item) {
        return protect(item);
    });

    // Split parts
    let parts = query.split(new RegExp(parts_name_escaped.join('|'), 'i'));

    // Unhide words precedently hidden with protect()
    query = hideInnerSql(query, words, unprotect);

    for (let i = 0; i < parts.length; i++) {
        parts[i] = hideInnerSql(parts[i], words, unprotect);
    }

    // Define analysis functions
    let analysis = {};

    analysis['SELECT'] = function (str) {
        let selectResult = protect_split(',', str);
        selectResult = selectResult.filter(function (item) {
            return item !== '';
        }).map(function (item) {
            //  Is there a column alias?
            let alias = "";
            [item, alias] = getNameAndAlias(item);

            let splitPattern = /[\s()*/%+-]+/g;
            let terms = item.split(splitPattern);

            if (terms !== null) {
                let aggFunc = ["SUM", "MIN", "MAX", "COUNT", "AVG", "DISTINCT"];
                terms = (aggFunc.indexOf(terms[0].toUpperCase()) === -1) ? terms : null;
            }
            if (item !== "*" && terms !== null && terms.length > 1) {
                return {
                    name: item,
                    terms: terms,
                    as: alias
                };
            }
            else {
                return { name: item, as: alias };
            }
        });
        return selectResult;
    };

    analysis['FROM'] = analysis['DELETE FROM'] = analysis['UPDATE'] = function (str) {
        let fromResult = str.split(',');
        fromResult = fromResult.map(function (item) {
            return trim(item);
        });
        fromResult.forEach(function (item, key) {
            if (item === '') fromResult.splice(key);
        });
        fromResult = fromResult.map(function (item) {
            let [table, alias] = getNameAndAlias(item);
            return { table: table, as: alias };
        });
        return fromResult;
    };

    analysis['LEFT JOIN'] = analysis['JOIN'] = analysis['INNER JOIN'] = analysis['RIGHT JOIN'] = analysis['FULL JOIN'] = function (str) {
        str = str.toUpperCase().split(' ON ');
        let table = str[0].split(' AS ');
        let joinResult = {};
        joinResult['table'] = trim(table[0]);
        joinResult['as'] = trim(table[1]) || '';
        joinResult['cond'] = trim(str[1]);

        return joinResult;
    };

    analysis['WHERE'] = function (str) {
        return trim(str);
    };

    analysis['ORDER BY'] = function (str) {
        str = str.split(',');
        let orderByResult = [];
        str.forEach(function (item, _key) {
            let order_by = /([\w\.]+)\s*(ASC|DESC)?/gi;
            order_by = order_by.exec(item);
            if (order_by !== null) {
                let tmp = {};
                tmp['column'] = trim(order_by[1]);
                tmp['order'] = trim(order_by[2]);
                if (order_by[2] === undefined) {
                    let orderParts = item.trim().split(" ");
                    if (orderParts.length > 1)
                        throw new Error("Invalid ORDER BY: " + item);
                    tmp['order'] = "ASC";
                }
                orderByResult.push(tmp);
            }
        });
        return orderByResult;
    };

    analysis['GROUP BY'] = function (str) {
        str = str.split(',');
        let groupByResult = [];
        str.forEach(function (item, _key) {
            let group_by = /([\w\.]+)/gi;
            group_by = group_by.exec(item);
            if (group_by !== null) {
                let tmp = {};
                tmp['column'] = trim(group_by[1]);
                groupByResult.push(tmp);
            }
        });
        return groupByResult;
    };

    analysis['PIVOT'] = function (str) {
        str = str.split(',');
        let pivotResult = [];
        str.forEach(function (item, _key) {
            let pivotOn = /([\w\.]+)/gi;
            pivotOn = pivotOn.exec(item);
            if (pivotOn !== null) {
                let tmp = {};
                tmp['name'] = trim(pivotOn[1]);
                tmp['as'] = "";
                pivotResult.push(tmp);
            }
        });
        return pivotResult;
    };

    analysis['LIMIT'] = function (str) {
        let limitResult = {};
        limitResult['nb'] = parseInt(str);
        limitResult['from'] = 0;
        return limitResult;
    };

    analysis['HAVING'] = function (str) {
        return trim(str);
    };

    analysis['UNION'] = function (str) {
        return trim(str);
    };

    analysis['UNION ALL'] = function (str) {
        return trim(str);
    };

    analysis['INTERSECT'] = function (str) {
        return trim(str);
    };

    analysis['EXCEPT'] = function (str) {
        return trim(str);
    };

    // Analyze parts
    let result = {};
    let j = 0;
    parts_order.forEach(function (item, _key) {
        item = item.toUpperCase();
        j++;
        if (typeof analysis[item] !== 'undefined') {
            let part_result = analysis[item](parts[j]);

            if (typeof result[item] !== 'undefined') {
                if (typeof result[item] === 'string' || typeof result[item][0] === 'undefined') {
                    let tmp = result[item];
                    result[item] = [];
                    result[item].push(tmp);
                }

                result[item].push(part_result);
            }
            else result[item] = part_result;
        }
        else {
            console.log('Can\'t analyze statement "' + item + '"');
            throw new Error("Can't analyze statement " + item);
        }
    });

    // Reorganize joins
    if (typeof result['LEFT JOIN'] !== 'undefined') {
        if (typeof result['JOIN'] === 'undefined') result['JOIN'] = [];
        if (typeof result['LEFT JOIN'][0] !== 'undefined') {
            result['LEFT JOIN'].forEach(function (item) {
                item.type = 'left';
                result['JOIN'].push(item);
            });
        }
        else {
            result['LEFT JOIN'].type = 'left';
            result['JOIN'].push(result['LEFT JOIN']);
        }
        delete result['LEFT JOIN'];
    }
    if (typeof result['INNER JOIN'] !== 'undefined') {
        if (typeof result['JOIN'] === 'undefined') result['JOIN'] = [];
        if (typeof result['INNER JOIN'][0] !== 'undefined') {
            result['INNER JOIN'].forEach(function (item) {
                item.type = 'inner';
                result['JOIN'].push(item);
            });
        }
        else {
            result['INNER JOIN'].type = 'inner';
            result['JOIN'].push(result['INNER JOIN']);
        }
        delete result['INNER JOIN'];
    }
    if (typeof result['RIGHT JOIN'] !== 'undefined') {
        if (typeof result['JOIN'] === 'undefined') result['JOIN'] = [];
        if (typeof result['RIGHT JOIN'][0] !== 'undefined') {
            result['RIGHT JOIN'].forEach(function (item) {
                item.type = 'right';
                result['JOIN'].push(item);
            });
        }
        else {
            result['RIGHT JOIN'].type = 'right';
            result['JOIN'].push(result['RIGHT JOIN']);
        }
        delete result['RIGHT JOIN'];
    }
    if (typeof result['FULL JOIN'] !== 'undefined') {
        if (typeof result['JOIN'] === 'undefined') result['JOIN'] = [];
        if (typeof result['FULL JOIN'][0] !== 'undefined') {
            result['FULL JOIN'].forEach(function (item) {
                item.type = 'full';
                result['JOIN'].push(item);
            });
        }
        else {
            result['FULL JOIN'].type = 'full';
            result['JOIN'].push(result['FULL JOIN']);
        }
        delete result['FULL JOIN'];
    }


    // Parse conditions
    if (typeof result['WHERE'] === 'string') {
        result['WHERE'] = CondParser.parse(result['WHERE']);
    }
    if (typeof result['HAVING'] === 'string') {
        result['HAVING'] = CondParser.parse(result['HAVING']);
    }
    if (typeof result['JOIN'] !== 'undefined') {
        result['JOIN'].forEach(function (item, key) {
            result['JOIN'][key]['cond'] = CondParser.parse(item['cond']);
        });
    }

    if (typeof result['UNION'] === 'string') {
        result['UNION'] = [sql2ast(parseUnion(result['UNION']))];
    }
    else if (typeof result['UNION'] !== 'undefined') {
        for (let i = 0; i < result['UNION'].length; i++) {
            result['UNION'][i] = sql2ast(parseUnion(result['UNION'][i]));
        }
    }

    if (typeof result['UNION ALL'] === 'string') {
        result['UNION ALL'] = [sql2ast(parseUnion(result['UNION ALL']))];
    }
    else if (typeof result['UNION ALL'] !== 'undefined') {
        for (let i = 0; i < result['UNION ALL'].length; i++) {
            result['UNION ALL'][i] = sql2ast(parseUnion(result['UNION ALL'][i]));
        }
    }

    if (typeof result['INTERSECT'] === 'string') {
        result['INTERSECT'] = [sql2ast(parseUnion(result['INTERSECT']))];
    }
    else if (typeof result['INTERSECT'] !== 'undefined') {
        for (let i = 0; i < result['INTERSECT'].length; i++) {
            result['INTERSECT'][i] = sql2ast(parseUnion(result['INTERSECT'][i]));
        }
    }

    if (typeof result['EXCEPT'] === 'string') {
        result['EXCEPT'] = [sql2ast(parseUnion(result['EXCEPT']))];
    }
    else if (typeof result['EXCEPT'] !== 'undefined') {
        for (let i = 0; i < result['EXCEPT'].length; i++) {
            result['EXCEPT'][i] = sql2ast(parseUnion(result['EXCEPT'][i]));
        }
    }


    return result;
}

function parseUnion(inStr) {
    let unionString = inStr;
    if (unionString.startsWith("(") && unionString.endsWith(")")) {
        unionString = unionString.substring(1, unionString.length - 1);
    }

    return unionString;
}

/**
 * If an ALIAS is specified after 'AS', return the field/table name and the alias.
 * @param {String} item 
 * @returns {[String, String]}
 */
function getNameAndAlias(item) {
    let alias = "";
    let lastAs = lastIndexOfOutsideLiteral(item.toUpperCase(), " AS ");
    if (lastAs !== -1) {
        let s = item.substring(lastAs + 4).trim();
        if (s.length > 0) {
            alias = s;
            //  Remove quotes, if any.
            if ((s.startsWith("'") && s.endsWith("'")) ||
                (s.startsWith('"') && s.endsWith('"')) ||
                (s.startsWith('[') && s.endsWith(']')))
                alias = s.substring(1, s.length - 1);

            //  Remove everything after 'AS'.
            item = item.substring(0, lastAs);
        }
    }

    return [item, alias];
}

function lastIndexOfOutsideLiteral(srcString, searchString) {
    let index = -1;
    let inQuote = "";

    for (let i = 0; i < srcString.length; i++) {
        let c = srcString.charAt(i);

        if (inQuote !== "") {
            //  The ending quote.
            if ((inQuote === "'" && c === "'") || (inQuote === '"' && c === '"') || (inQuote === "[" && c === "]"))
                inQuote = "";
        }
        else if ("\"'[".indexOf(c) !== -1) {
            //  The starting quote.
            inQuote = c;
        }
        else if (srcString.substring(i).startsWith(searchString)) {
            //  Matched search.
            index = i;
        }
    }

    return index;
}

/*
 * LEXER & PARSER FOR SQL CONDITIONS
 * Inspired by https://github.com/DmitrySoshnikov/Essentials-of-interpretation
 */

// Constructor
function CondLexer(source) {
    this.source = source;
    this.cursor = 0;
    this.currentChar = "";

    this.readNextChar();
}

CondLexer.prototype = {
    constructor: CondLexer,

    // Read the next character (or return an empty string if cursor is at the end of the source)
    readNextChar: function () {
        if (typeof this.source !== 'string') this.currentChar = "";
        else this.currentChar = this.source[this.cursor++] || "";
    },

    // Determine the next token
    readNextToken: function () {
        if (/\w/.test(this.currentChar))
            return this.readWord();
        if (/["'`]/.test(this.currentChar))
            return this.readString();
        if (/[()]/.test(this.currentChar))
            return this.readGroupSymbol();
        if (/[!=<>]/.test(this.currentChar))
            return this.readOperator();
        if (/[\+\-*\/%]/.test(this.currentChar))
            return this.readMathOperator();
        if (this.currentChar === '?')
            return this.readBindVariable();

        if (this.currentChar === "") return { type: 'eot', value: '' };
        else {
            this.readNextChar();
            return { type: 'empty', value: '' };
        }
    },

    readWord: function () {
        let tokenValue = "";
        let nb_brackets = 0;
        let isString = false;
        let startQuote = "";
        while (/./.test(this.currentChar)) {
            // Check if we are in a string
            if (!isString && /['"`]/.test(this.currentChar)) {
                isString = true;
                startQuote = this.currentChar;
            }
            else if (isString && this.currentChar === startQuote) {
                isString = false;
            }
            else {
                // Allow spaces inside functions (only if we are not in a string)
                if (!isString) {
                    // Token is finished if there is a closing bracket outside a string and with no opening
                    if (this.currentChar === ')' && nb_brackets <= 0)
                        break;

                    if (this.currentChar === '(')
                        nb_brackets++;
                    else if (this.currentChar === ')')
                        nb_brackets--;

                    // Token is finished if there is a operator symbol outside a string
                    if (/[!=<>]/.test(this.currentChar))
                        break;
                }

                // Token is finished on the first space which is outside a string or a function
                if (this.currentChar === ' ' && nb_brackets <= 0)
                    break;
            }

            tokenValue += this.currentChar;
            this.readNextChar();
        }

        if (/^(AND|OR)$/i.test(tokenValue))
            return { type: 'logic', value: tokenValue.toUpperCase() };
        if (/^(IN|IS|NOT|LIKE)$/i.test(tokenValue))
            return { type: 'operator', value: tokenValue.toUpperCase() };
        else
            return { type: 'word', value: tokenValue };
    },

    readString: function () {
        let tokenValue = "";
        let quote = this.currentChar;

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
    },

    readGroupSymbol: function () {
        let tokenValue = this.currentChar;
        this.readNextChar();

        return { type: 'group', value: tokenValue };
    },

    readOperator: function () {
        let tokenValue = this.currentChar;
        this.readNextChar();

        if (/[=<>]/.test(this.currentChar)) {
            tokenValue += this.currentChar;
            this.readNextChar();
        }

        return { type: 'operator', value: tokenValue };
    },

    readMathOperator: function () {
        let tokenValue = this.currentChar;
        this.readNextChar();

        return { type: 'mathoperator', value: tokenValue };
    },

    readBindVariable: function () {
        let tokenValue = this.currentChar;
        this.readNextChar();

        return { type: 'bindVariable', value: tokenValue };
    },
};

// Constructor
function CondParser(source) {
    this.lexer = new CondLexer(source);
    this.currentToken = "";

    this.readNextToken();
}

CondParser.prototype = {
    constructor: CondParser,

    // Read the next token (skip empty tokens)
    readNextToken: function () {
        this.currentToken = this.lexer.readNextToken();
        while (this.currentToken.type === 'empty')
            this.currentToken = this.lexer.readNextToken();
        return this.currentToken;
    },

    // Wrapper function ; parse the source
    parseExpressionsRecursively: function () {
        return this.parseLogicalExpression();
    },

    // Parse logical expressions (AND/OR)
    parseLogicalExpression: function () {
        let leftNode = this.parseConditionExpression();

        while (this.currentToken.type === 'logic') {
            let logic = this.currentToken.value;
            this.readNextToken();

            let rightNode = this.parseConditionExpression();

            // If we are chaining the same logical operator, add nodes to existing object instead of creating another one
            if (typeof leftNode.logic !== 'undefined' && leftNode.logic === logic && typeof leftNode.terms !== 'undefined')
                leftNode.terms.push(rightNode);
            else {
                let terms = [leftNode, rightNode];
                leftNode = { 'logic': logic, 'terms': terms.slice(0) };
            }
        }

        return leftNode;
    },

    // Parse conditions ([word/string] [operator] [word/string])
    parseConditionExpression: function () {
        let leftNode = this.parseBaseExpression();

        if (this.currentToken.type === 'operator') {
            let operator = this.currentToken.value;
            this.readNextToken();

            // If there are 2 adjacent operators, join them with a space (exemple: IS NOT)
            if (this.currentToken.type === 'operator') {
                operator += ' ' + this.currentToken.value;
                this.readNextToken();
            }

            let rightNode = this.parseBaseExpression(operator);

            leftNode = { 'operator': operator, 'left': leftNode, 'right': rightNode };
        }

        return leftNode;
    },

    // Parse base items
    parseBaseExpression: function (operator) {
        let astNode = "";
        let inCurrentToken;

        // If this is a word/string, return its value
        if (this.currentToken.type === 'word' || this.currentToken.type === 'string') {
            astNode = this.currentToken.value;
            this.readNextToken();

            if (this.currentToken.type === 'mathoperator') {
                astNode += " " + this.currentToken.value;
                this.readNextToken();
                while ((this.currentToken.type === 'mathoperator' || this.currentToken.type === 'word') && this.currentToken.type !== 'eot') {
                    astNode += " " + this.currentToken.value;
                    this.readNextToken();
                }
            }
        }
        // If this is a group, skip brackets and parse the inside
        else if (this.currentToken.type === 'group') {
            this.readNextToken();
            astNode = this.parseExpressionsRecursively();

            let isSelectStatement = typeof astNode === "string" && astNode.toUpperCase() === 'SELECT';

            if (operator === 'IN' || isSelectStatement) {
                inCurrentToken = this.currentToken;
                while (inCurrentToken.type !== 'group' && inCurrentToken.type !== 'eot') {
                    this.readNextToken();
                    if (inCurrentToken.type !== 'group') {
                        if (isSelectStatement)
                            astNode += " " + inCurrentToken.value;
                        else
                            astNode += ", " + inCurrentToken.value;
                    }

                    inCurrentToken = this.currentToken;
                }

                if (isSelectStatement) {
                    astNode = sql2ast(astNode);
                }
            }
            else {
                //  Are we within brackets of mathematicl expression ?
                inCurrentToken = this.currentToken;

                while (inCurrentToken.type !== 'group' && inCurrentToken.type !== 'eot') {
                    this.readNextToken();
                    if (inCurrentToken.type !== 'group') {
                        astNode += " " + inCurrentToken.value;
                    }

                    inCurrentToken = this.currentToken;
                }

            }

            this.readNextToken();
        }
        else if (this.currentToken.type === 'bindVariable') {
            astNode = this.currentToken.value;
            this.readNextToken();
        }

        return astNode;
    },
};

// Parse a string
CondParser.parse = function (source) {
    return new CondParser(source).parseExpressionsRecursively();
};

/**
* 
* @param {String} logic 
* @param {Object} terms 
* @returns {String}
*/
function resolveSqlCondition(logic, terms) {
    let jsCondition = "";

    for (let cond of terms) {
        if (typeof cond.logic === 'undefined') {
            if (jsCondition !== "" && logic === "AND") {
                jsCondition += " && ";
            }
            else if (jsCondition !== "" && logic === "OR") {
                jsCondition += " || ";
            }

            jsCondition += " " + cond.left;
            if (cond.operator === "=")
                jsCondition += " == ";
            else
                jsCondition += " " + cond.operator;
            jsCondition += " " + cond.right;
        }
        else {
            jsCondition += resolveSqlCondition(cond.logic, cond.terms);
        }
    }

    return jsCondition;
}


function sqlCondition2JsCondition(cond) {
    let ast = sql2ast("SELECT A FROM c WHERE " + cond);
    let sqlData = "";

    if (typeof ast['WHERE'] !== 'undefined') {
        let conditions = ast['WHERE'];
        if (typeof conditions.logic === 'undefined')
            sqlData = resolveSqlCondition("OR", [conditions]);
        else
            sqlData = resolveSqlCondition(conditions.logic, conditions.terms);

    }

    return sqlData;
}
