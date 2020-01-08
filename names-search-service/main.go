package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/go-redis/redis"
)

var versionPrefix = "/v1/"
var maxAgeSeconds = 5 * 60

func main() {
	log.Println("Starting names-search-service")
	http.HandleFunc(versionPrefix, handler)

	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}

func handler(res http.ResponseWriter, req *http.Request) {
	query := req.URL.Path[len(versionPrefix):]

	redisClient := redis.NewClient(&redis.Options{
		Addr:     "redis:6379",
		Password: "",
		DB:       0,
	})

	suggestions, err := redisClient.ZRange(query, 0, 10).Result()
	if err != nil {
		log.Printf("There was an error requesting the suggesions for the query: %s %v", query, err)
		res.WriteHeader(http.StatusInternalServerError)
		return
	}
	serializedSuggestions, err := json.Marshal(suggestions)
	if err != nil {
		log.Printf("There was an error marshalling the suggesions slice: %s %v", suggestions, err)
		res.WriteHeader(http.StatusInternalServerError)
		return
	}

	res.Header().Set("Content-Type", "application/json")
	res.Header().Set("Cache-Control", fmt.Sprintf("max-age=%d", maxAgeSeconds))
	res.WriteHeader(http.StatusOK)
	res.Write(serializedSuggestions)
}
