(function (isBrowser) {
    "use strict";

    var callAsync = !isBrowser ? setImmediate : function (fn) {
	var args = [].slice.call(arguments, 1)
	setTimeout.apply(window, [fn, 0].concat(args))
    }

    function StringStream(string) {
	this.line = 1
	this.col = 1
	this.idx = 0
	this.str = string
    }
    StringStream.prototype.current = function () {
	return this.str[this.idx]
    }
    StringStream.prototype.next = function () {
	var hasNext = this.str.length > this.idx
	if (hasNext) {
	    if (this.current() == "\n") {
		this.col = 1
		this.line++
	    } else {
		this.col++
	    }
	    this.idx++
	}
	return hasNext
    }
    StringStream.prototype.isWhitespace = function () {
	return this.current() && "\n \t\r".indexOf(this.current()) >= 0
    }
    StringStream.prototype.isBodyDelimiter = function () {
	return this.current() && ".".indexOf(this.current()) >= 0
    }
    StringStream.prototype.isLambda = function () {
	return this.current() && "\\λ".indexOf(this.current()) >= 0
    }
    StringStream.prototype.isOpenGroup = function () {
	return this.current() === "("
    }
    StringStream.prototype.isCloseGroup = function () {
	return this.current() === ")"
    }
    StringStream.prototype.isIdentifierChar = function () {
	return this.current()
	    && !this.isWhitespace()
	    && !this.isBodyDelimiter()
	    && !this.isLambda()
	    && !this.isOpenGroup()
	    && !this.isCloseGroup()
    }
    StringStream.prototype.readWhile = function (pred) {
	var tok = ''
	while (pred.call(this, this.current())) {
	    tok += this.current()
	    this.next()
	}
	return tok
    }
    StringStream.prototype.skipWhile = function (pred) {
	while (pred.call(this, this.current())) {
	    this.next()
	}
    }

    function Token(spec) {
	this.line = spec.line
	this.col = spec.col
	this.type = spec.type
	this.data = spec.data
	this.raw = spec.raw
    }
    Token.prototype.eq = function (tok) {
	return this.type === tok.type && this.value === tok.value
    }

    function Error(spec) {
	this.line = spec.line
	this.col = spec.col
	this.message = spec.message
	this.cause = spec.cause
    }

    function TokenStream(sstream) {
	this.sstream = sstream
	this.toks = []
    }
    TokenStream.prototype.current = function () {
	return this.toks[this.toks.length - 1]
    }
    TokenStream.prototype.next = function () {
	this.sstream.skipWhile(this.sstream.isWhitespace)
	var hasNext = true
	if (this.sstream.isBodyDelimiter()) {
	    this.toks.push(new Token({
		type: "body-delimiter",
		line: this.sstream.line,
		col: this.sstream.col,
		raw: this.sstream.current(),
	    }))
	    this.sstream.next()
	} else if (this.sstream.isLambda()) {
	    this.toks.push(new Token({
		type: "lambda",
		line: this.sstream.line,
		col: this.sstream.col,
		raw: this.sstream.current(),
	    }))
	    this.sstream.next()
	} else if (this.sstream.isOpenGroup()) {
	    this.toks.push(new Token({
		type: "open-group",
		line: this.sstream.line,
		col: this.sstream.col,
		raw: this.sstream.current(),
	    }))
	    this.sstream.next()
	} else if (this.sstream.isCloseGroup()) {
	    this.toks.push(new Token({
		type: "close-group",
		line: this.sstream.line,
		col: this.sstream.col,
		raw: this.sstream.current(),
	    }))
	    this.sstream.next()
	} else if (this.sstream.isIdentifierChar()) {
	    var line = this.sstream.line
	    var col = this.sstream.col
	    var ident = this.sstream.readWhile(this.sstream.isIdentifierChar)
	    this.toks.push(new Token({
		type: "var",
		data: {name: ident},
		line: line,
		col: col,
		raw: ident,
	    }))
	} else {
	    hasNext = false
	    if (!this.current() || this.current().type !== "end-of-file") {
		this.toks.push(new Token({
		    type: "end-of-file",
		    line: this.sstream.line,
		    col: this.sstream.col,
		    raw: "end of file",
		}))
	    }
	}
	return hasNext
    }

    function Ast(spec) {
	this.line = spec.line
	this.col = spec.col
	this.type = spec.type
	this.data = spec.data
    }
    Ast.prototype.isNil = function () {
	return this.type === "nil"
    }
    Ast.prototype.apply = function (arg) {
	if (this.isNil()) {
	    return arg
	}
	return new Ast({
	    line: this.line,
	    col: this.col,
	    type: "application",
	    data: {
		to: this,
		argument: arg,
	    },
	})
    }

    function parse(lexer, ondone) {
	lexer.next()
	parseExpression(
	    {type: "end-of-file"},
	    ondone,
	    new Ast({type: "nil"}),
	    []
	)

	function parseLambda(end, ondone, expr, err) {
	    var start = lexer.current()
	    lexer.next()
	    var ident = lexer.current()
	    if (ident.type !== "var") {
		err.push(new Error({
		    line: ident.line,
		    col: ident.col,
		    message: "Expecting identifier, found " + ident.raw,
		    cause: ident,
		}))
	    } else {
		lexer.next()
	    }
	    var delim = lexer.current()
	    if (!delim.eq({type: "body-delimiter"})) {
		err.push(new Error({
		    line: delim.line,
		    col: delim.col,
		    message: "Expecting . (body delimiter), found " + delim.raw,
		    cause: delim,
		}))
	    } else {
		lexer.next()
	    }
	    callAsync(parseExpression, end, function (subExpr, subErr) {
		callAsync(ondone, expr.apply(new Ast({
		    line: start.line,
		    col: start.col,
		    type: "lambda",
		    data: {
			argument: ident,
			body: subExpr
		    },
		})), err.concat(subErr))
	    }, new Ast({type: "nil"}), [])

	}

	function parseExpression(end, ondone, expr, err) {
	    var tok = lexer.current()
	    if (tok.eq(end)) {
		if (expr.isNil()) {
		    err.push(new Error({
			line: tok.line,
			col: tok.col,
			message: "Empty expression (found " + tok.raw + ")",
			cause: tok,
		    }))
		}
		callAsync(ondone, expr, err)
	    } else if (tok.type === "var") {
		callAsync(parseExpression, end, ondone, expr.apply(new Ast({
		    line: tok.line,
		    col: tok.col,
		    type: "var",
		    data: {token: tok},
		})), err)
		lexer.next()
	    } else if (tok.eq({type: "lambda"})) {
		callAsync(parseLambda, end, ondone, expr, err)
	    } else if (tok.eq({type: "open-group"})) {
		lexer.next()
		callAsync(
		    parseExpression,
		    {type: "close-group"},
		    function (subExpr, subErr) {
			var last = subErr[subErr.length - 1]
			if (last &&
			    last.cause &&
			    last.cause.eq &&
			    last.cause.eq({
				type: "end-of-file"
			    }))
			{
			    last.message +=
				" (the cause is likely to be the parenthesis" +
				" at line " + tok.line +
				" column " + tok.col +
				")"
			    last.cause = [tok, last.cause]
			} else {
			    lexer.next()
			}
			callAsync(
			    parseExpression,
			    end,
			    ondone,
			    expr.apply(subExpr),
			    err.concat(subErr)
			)
		    },
		    new Ast({type: "nil"}),
		    []
		)
	    } else {
		err.push(new Error({
		    line: tok.line,
		    col: tok.col,
		    message: "Unexpected token " + tok.raw,
		    cause: tok,
		}))
		if (tok.eq({type: "end-of-file"})) {
		    callAsync(ondone, expr, err)
		} else {
		    lexer.next()
		    callAsync(parseExpression, end, ondone, expr, err)
		}
	    }
	}
    }

    // please, note that each Var is also a scope
    function Var(name, parent) {
	this.parent = parent
	this.name = name || ""
	this.jsName = ""
	this.findJsName()
    }
    Var.prototype.findJsName = function () {
	this.jsName = Var.jsfyName(this.name)
	var parent = this.parent
	while (parent) {
	    while (parent.jsName === this.jsName) {
		this.jsName += "$$"
	    }
	    parent = parent.parent
	}
	return this.jsName
    }
    Var.prototype.find = function (name) {
	var scope = this
	while (scope) {
	    if (scope.name === name) {
		return scope
	    }
	    scope = scope.parent
	}
    }
    Var.jsfyName = function (name) {
	// starting with $ ensures no keyword is used
	// and also we can have digits after it
	var str = "$"
	var i, len = name.length
	for (i = 0; i < len; i++) {
	    var code = name.charCodeAt(i)
	    // tests for alphanumeric and underscore
	    // faster than regex
	    if (code >= 97 && code <= 122 ||
		code >= 65 && code <= 90 ||
		code >= 48 && code <= 57 ||
		code === 95)
	    {
		str += name[i]
	    } else {
		str += "$"
		switch (name[i]) {
		case "+":
		    str += "plus"
		    break
		case "-":
		    str += "minus"
		    break
		case "*":
		    str += "times"
		    break
		case "/":
		    str += "bar"
		    break
		case "%":
		    str += "perc"
		    break
		case "$":
		    str += "dollar"
		    break
		case ">":
		    str += "gt"
		    break
		case "<":
		    str += "lt"
		    break
		case "=":
		    str += "eq"
		    break
		case "&":
		    str += "and"
		    break
		case "|":
		    str += "pipe"
		    break
		case "^":
		    str += "cflex"
		    break
		case "~":
		    str += "tilde"
		    break
		case "!":
		    str += "excl"
		    break
		case "?":
		    str += "quest"
		    break
		case "'":
		    str += "quote"
		    break
		default:
		    str += name.charCodeAt(i).toString(16).padStart(4, "0")
		    break
		}
	    }
	}
	return str
    }

    function translate(ast, ondone) {
	expressionToJs(ast, ondone, new Var(), [])

	function lambdaToJs(func, ondone, scope, err) {
	    var newScope = new Var(func.data.argument.data.name, scope)
	    callAsync(
		expressionToJs,
		func.data.body,
		function (body, subErr) {
		    callAsync(
			ondone,
			"(function (" +
			    newScope.jsName +
			    ") { return " +
			    body +
			    " })",
			err.concat(subErr)
		    )
		},
		newScope,
		[]
	    )
	}
	function expressionToJs(ast, ondone, scope, err) {
	    switch (ast.type) {
	    case "var":
		var name = ast.data.token.data.name
		var variable = scope.find(name)
		if (!variable) {
		    err.push(new LijError({
			line: ast.line,
			col: ast.col,
			message: "Could not find variable " + name,
			cause: ast,
		    }))
		} else {
		    variable = variable.jsName
		}
		callAsync(ondone, variable, err)
		break
	    case "application":
		var done = 0
		var argument, to
		callAsync(expressionToJs, ast.data.argument, function (js, subErr) {
		    err = err.concat(subErr)
		    argument = js
		    applicationToJs()
		}, scope, [])
		callAsync(expressionToJs, ast.data.to, function (js, subErr) {
		    err = err.concat(subErr)
		    to = js
		    applicationToJs()
		}, scope, [])
		function applicationToJs() {
		    done++
		    if (done < 2) {
			return
		    }
		    callAsync(ondone, to + "(" + argument + ")", err)
		}
		break
	    case "lambda":
		callAsync(lambdaToJs, ast, ondone, scope, err)
		break
	    default:
		callAsync(ondone, "undefined", err)
		break
	    }
	}
    }

    var lij = {}
    lij.fn = {}
    lij.compile = function (input, options, ondone) {
	if (ondone == null) {
	    ondone = options
	    options = {}
	}
	parse(new TokenStream(new StringStream(input)), function (ast, err) {
	    translate(ast, function (code, err2) {
		var func = code
		try {
		    func = eval(code)
		} catch (e) {
		    err2.push(e)
		}
		ondone(func, err.concat(err2))
	    })
	})
    }
    lij.compileAll = function (input, options, ondone) {
	if (ondone == null) {
	    ondone = options
	    options = {}
	}
	var compiled = {}, errs = {}
	var prop, count = 0, done = 0
	for (prop in input) {
	    (function (prop) {
		lij.compile(input[prop], options, function (f, err) {
		    errs[prop] = err
		    compiled[prop] = f
		    sync()
		})
	    })(prop)
	    count++
	}
	function sync() {
	    done++
	    if (done >= count) {
		ondone(compiled, errs)
	    }
	}
    }
    lij.Error = Error

    if (isBrowser) {
	window.lij = lij
    } else {
	module.exports = lij
    }

})(this && this === this.window)
