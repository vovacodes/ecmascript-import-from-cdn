dev:
	docker-compose up --build

start:
	docker-compose up --build -d

PHONY: dev start
