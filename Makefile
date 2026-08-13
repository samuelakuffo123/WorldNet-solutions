.PHONY: setup lint test

setup:
	@cd src && npm install

lint:
	@echo "No ESLint configuration present; lint step is a placeholder."

test:
	@cd src && npm test
