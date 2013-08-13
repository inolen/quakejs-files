.PHONY: lint test

all: lint test

lint:
	find lib -name "*.js" -print0 | xargs -0 jshint