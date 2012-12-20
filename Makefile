BROWSER = open
PHANTOMJS = phantomjs

test: test-phantomjs

test-browser:
	$(BROWSER) tests/runner.html

test-phantomjs:
	$(PHANTOMJS) tests/vendor/phantomjs-mocha/scripts/mocha.js tests/runner/phantomjs.html

.PHONY: test-browser test-phantomjs
