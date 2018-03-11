# lij
lambda is javascript - A Calculus to JavaScript compiler

# Implementation-Specific Syntax Rules
* Identifiers can be formed with any character but
  `.`,
  `\\`,
  `λ`,
  `(` and `)`
* `\\` is a synonym for `λ`

# Import

## In Browser

```html
<script src="path/to/lij.js"></script>
```

## In Node
```javscript
const lij = require("./lij")
```

# Usage
```javascript
lij.compile(yourCode, function (f, errors) {
	if (errors.length) {
		errors.forEach(function (e) {
			console.log(e)
		})
	} else {
		// use your compiled function
	}
})
```
