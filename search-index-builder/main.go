package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/go-redis/redis"
)

func main() {
	redisClient := redis.NewClient(&redis.Options{
		Addr:     "redis:6379",
		Password: "",
		DB:       0,
	})
	for {
		_, err := redisClient.Ping().Result()
		if err == nil {
			break
		}
		log.Println("Waiting for Redis to load...")
		time.Sleep(1 * time.Second)
	}

	if err := buildSearchIndex(redisClient); err != nil {
		log.Print(err)
	}

	ticker := time.NewTicker(12 * 60 * time.Minute)
	for range ticker.C {
		if err := buildSearchIndex(redisClient); err != nil {
			log.Print(err)
		}
	}
}

var allDocsURL = "https://replicate.npmjs.com/_all_docs"

func buildSearchIndex(redisClient *redis.Client) error {
	log.Println("Started building the search index")
	log.Printf("Fetching all packages data from %s...", allDocsURL)
	response, err := http.Get(allDocsURL)
	if err != nil {
		return fmt.Errorf("There was an error querying https://replicate.npmjs.com/_all_docs: %v", err)
	}
	log.Println("Processing the response...")
	reader := bufio.NewReader(response.Body)
	// skip the first line: `"total_rows":1161662,"offset":228727,"rows":[`
	reader.ReadBytes('\n')

	pipeline := redisClient.Pipeline()
	pipelinedOperationsCount := 0
	for {
		line, err := reader.ReadBytes('\n')
		if err == io.EOF {
			break
		} else if err != nil {
			return fmt.Errorf("There was an error reading _all_docs response: %v", err)
		}

		// Sanitize line before unmarshalling
		line = bytes.TrimSpace(line)
		line = bytes.TrimSuffix(line, []byte(","))

		var doc document
		err = json.Unmarshal(line, &doc)
		if err != nil {
			// Don't log the error if that's the last line in the response, we expect it to throw
			if bytes.HasPrefix(line, []byte("]}")) {
				continue
			}
			log.Printf("There was en error unmarshalling the line: %s \n%v", line, err)
			continue
		}

		runes := []rune(doc.Name)

		// Only populate search table with the package names longer than 3 letters
		if len(runes) <= 3 {
			continue
		}

		// Start addng prefixes with 3-letter-long ones
		prefix := bytes.NewBufferString(string(runes[0:2]))
		for _, char := range runes[2:] {
			prefix.WriteRune(char)
			pipeline.ZAdd(prefix.String(), redis.Z{0, doc.Name})
			pipelinedOperationsCount++
		}

		// Execute the pipeline if we batched enough operations
		if pipelinedOperationsCount >= 1000 {
			_, err := pipeline.Exec()
			if err != nil {
				return fmt.Errorf("There was an error executing the insertion pipeline %v", err)
			}
			pipelinedOperationsCount = 0
		}
	}

	// Flush all the remaining operations if necessary
	if pipelinedOperationsCount > 0 {
		_, err := pipeline.Exec()
		if err != nil {
			return fmt.Errorf("There was an error executing the insertion pipeline %v", err)
		}
	}

	pipeline.Close()
	log.Println("The search index is successfully built")
	return nil
}

type document struct {
	Name string `json:"id"`
}
