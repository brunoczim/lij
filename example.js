const lij = require("./lij")

var code = {
    isZero: `
    (
	\\true.
	    \\false.
	    \\n.
	    n (\\b.false) true
    )
    (\\t.\\f.t)
    (\\t.\\f.f)
    `,
    zero: `\\f.\\x.x`,
    one:  `\\f.\\x.f x`,
    two: `\\f.\\x.f (f x)`,
}

lij.compileAll(code, function (f, err) {
    var ok = true
    for (var prop in err) {
	if (err[prop].length) {
	    err[prop].forEach(console.log)
	    ok = false
	}
    }
    if (ok) {
	console.log(f.isZero(f.zero)("Yes")("No"))
	console.log(f.isZero(f.one)("Yes")("No"))
	console.log(f.isZero(f.two)("Yes")("No"))
    }
})
