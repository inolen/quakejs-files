var Tokenizer = function (src) {
	// strip out comments
	src = src.replace(/\/\/.*$/mg, ''); // strip single line comments
	src = src.replace(/\/\*[\s\S]*?\*\//mg, ''); // strip multi-line comments

	// split everything by whitespace, grouping quoted sections together
	this.tokens = [];

	var tokenizer = /([^\s\n\r\"]+)|"([^\"]+)"/mg;
	var match;
	while ((match = tokenizer.exec(src)) !== null) {
		this.tokens.push(match[1] || match[2]);
	}

	this.offset = 0;
};

Tokenizer.prototype.EOF = function() {
	if (this.tokens === null) {
		return true;
	}

	var token = this.tokens[this.offset];

	while (token === '' && this.offset < this.tokens.length) {
		this.offset++;
		token = this.tokens[this.offset];
	}

	return this.offset >= this.tokens.length;
};

Tokenizer.prototype.next = function() {
	if (this.tokens === null) {
		return;
	}

	var token = '';

	while (token === '' && this.offset < this.tokens.length) {
		token = this.tokens[this.offset++];
	}

	return token;
};

Tokenizer.prototype.prev = function() {
	if (this.tokens === null) {
		return;
	}

	var token = '';

	while (token === '' && this.offset >= 0) {
		token = this.tokens[this.offset--];
	}

	return token;
};

module.exports = Tokenizer;
