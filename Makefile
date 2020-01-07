dev:
	docker-compose up --build

start:
	docker-compose up --build --detach

PHONY: dev start
