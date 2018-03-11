# lij
lambda is javascript - A Calculus to JavaScript compiler

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
