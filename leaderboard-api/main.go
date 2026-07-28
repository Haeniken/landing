package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode"
	"unicode/utf8"
)

const (
	shiftDuration          = 90
	maxScore               = 6000
	maxRequestBody         = 4096
	minNicknameLength      = 2
	maxNicknameLength      = 15
	legendaryAchievementID = "orbit_legend"
)

var coreAchievementIDs = []string{
	"first_shift", "no_panic", "fast_reaction", "slo_keeper", "error_budget", "scale_up", "devsecops", "full_orbit",
	"clean_watch", "calm_operator", "resource_reserve", "incident_streak", "violet_protocol", "event_horizon", "zero_drift", "orbital_master", "absolute_control",
}

var allowedAchievements = map[string]bool{
	"first_shift": true, "no_panic": true, "fast_reaction": true, "slo_keeper": true,
	"error_budget": true, "scale_up": true, "devsecops": true, "full_orbit": true,
	"clean_watch": true, "calm_operator": true, "resource_reserve": true, "incident_streak": true,
	"violet_protocol": true, "event_horizon": true, "zero_drift": true, "orbital_master": true,
	"absolute_control": true, legendaryAchievementID: true,
}

var russianProfanityRoots = []string{
	"хуй", "хуе", "хуё", "хуя", "хуи", "хуйн", "пизд", "бляд", "блят", "ебан", "ёбан",
	"ебат", "ёбат", "ебал", "ёбал", "ебет", "ебёт", "ебут", "ебуч", "ебл", "заеб", "заёб",
	"наеб", "наёб", "уеб", "уёб", "выеб", "выёб", "проеб", "проёб", "долбоеб", "долбоёб",
	"мудил", "мудозвон", "гандон", "гондон", "залуп", "шлюх", "пидор", "пидар", "сучк",
}

var englishProfanityRoots = []string{
	"fuck", "fck", "fuk", "phuck", "shit", "bitch", "cunt", "dickhead", "cock", "pussy",
	"asshole", "arsehole", "motherf", "whore", "slut", "wanker", "bollock", "twat", "nigg", "fagg",
	"huy", "hui", "khuy", "pizd", "blyad", "blyat", "blya", "ebat", "yebat", "eban", "suka",
	"mudak", "pidor", "pidar", "gandon", "zalup", "shlyuh",
}

type scoreEntry struct {
	Nick             string    `json:"nick"`
	Score            int       `json:"score"`
	Availability     float64   `json:"availability"`
	Budget           int       `json:"budget"`
	Achievements     []string  `json:"achievements"`
	AchievementCount int       `json:"achievementCount"`
	CreatedAt        time.Time `json:"createdAt"`
}

type storedData struct {
	Entries []scoreEntry `json:"entries"`
}

type leaderboardEntry struct {
	Nick             string   `json:"nick"`
	Score            int      `json:"score"`
	Availability     float64  `json:"availability"`
	Budget           int      `json:"budget"`
	Achievements     []string `json:"achievements"`
	AchievementCount int      `json:"achievementCount"`
}

type gameSession struct {
	IP        string    `json:"ip"`
	StartedAt time.Time `json:"startedAt"`
}

type storedSessions struct {
	Active map[string]gameSession `json:"active"`
	Used   map[string]time.Time   `json:"used"`
}

type rateWindow struct {
	Events []time.Time
}

type api struct {
	mu           sync.Mutex
	dataPath     string
	sessionsPath string
	origin       string
	data         storedData
	sessions     map[string]gameSession
	usedSessions map[string]time.Time
	rates        map[string]rateWindow
	startedAt    time.Time
}

func main() {
	if len(os.Args) == 3 && os.Args[1] == "-healthcheck" {
		client := http.Client{Timeout: 2 * time.Second}
		response, err := client.Get(os.Args[2])
		if err != nil || response.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		_ = response.Body.Close()
		return
	}

	listenAddress := envOrDefault("LISTEN_ADDR", ":8080")
	dataPath := envOrDefault("DATA_PATH", "/data/scores.json")
	origin := envOrDefault("SITE_ORIGIN", "https://haeniken.com")
	service := &api{
		dataPath: dataPath, sessionsPath: filepath.Join(filepath.Dir(dataPath), "sessions.json"), origin: origin,
		sessions: make(map[string]gameSession), usedSessions: make(map[string]time.Time), rates: make(map[string]rateWindow), startedAt: time.Now().UTC(),
	}
	if err := service.load(); err != nil {
		log.Fatalf("load leaderboard: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", service.handleHealth)
	mux.HandleFunc("/v1/session", service.handleSession)
	mux.HandleFunc("/v1/leaderboard", service.handleLeaderboard)
	server := &http.Server{
		Addr: listenAddress, Handler: securityHeaders(mux), ReadHeaderTimeout: 3 * time.Second,
		ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second,
		MaxHeaderBytes: 16 << 10,
	}

	go func() {
		log.Printf("leaderboard API listening on %s", listenAddress)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serve: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}

func envOrDefault(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Cache-Control", "no-store")
		writer.Header().Set("Content-Type", "application/json; charset=utf-8")
		writer.Header().Set("X-Content-Type-Options", "nosniff")
		writer.Header().Set("X-Robots-Tag", "noindex, nofollow")
		next.ServeHTTP(writer, request)
	})
}

func (service *api) handleHealth(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
}

func (service *api) handleSession(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if !service.validOrigin(request) {
		writeError(writer, http.StatusForbidden, "invalid origin")
		return
	}
	ip := clientIP(request)
	service.mu.Lock()
	defer service.mu.Unlock()
	if !service.allowLocked("session:"+ip, 60, time.Hour) {
		writeError(writer, http.StatusTooManyRequests, "rate limit exceeded")
		return
	}
	now := time.Now().UTC()
	for token, session := range service.sessions {
		if now.Sub(session.StartedAt) > 6*time.Minute {
			delete(service.sessions, token)
		}
	}
	for token, usedAt := range service.usedSessions {
		if now.Sub(usedAt) > 24*time.Hour {
			delete(service.usedSessions, token)
		}
	}
	token, err := randomToken()
	if err != nil {
		writeError(writer, http.StatusInternalServerError, "could not create session")
		return
	}
	service.sessions[token] = gameSession{IP: ip, StartedAt: now}
	if err := service.persistSessionsLocked(); err != nil {
		delete(service.sessions, token)
		log.Printf("persist game session: %v", err)
		writeError(writer, http.StatusInternalServerError, "could not create session")
		return
	}
	writeJSON(writer, http.StatusCreated, map[string]any{"sessionId": token, "duration": shiftDuration})
}

func (service *api) handleLeaderboard(writer http.ResponseWriter, request *http.Request) {
	switch request.Method {
	case http.MethodGet:
		service.mu.Lock()
		entries := service.topTenLocked()
		service.mu.Unlock()
		writeJSON(writer, http.StatusOK, map[string]any{"entries": publicLeaderboard(entries)})
	case http.MethodPost:
		service.saveLeaderboardScore(writer, request)
	default:
		writeError(writer, http.StatusMethodNotAllowed, "method not allowed")
	}
}

type scoreRequest struct {
	SessionID    string   `json:"sessionId"`
	Nick         string   `json:"nick"`
	Website      string   `json:"website"`
	Score        int      `json:"score"`
	Availability float64  `json:"availability"`
	Budget       int      `json:"budget"`
	Duration     int      `json:"duration"`
	Achievements []string `json:"achievements"`
}

func (service *api) saveLeaderboardScore(writer http.ResponseWriter, request *http.Request) {
	if !service.validOrigin(request) {
		writeError(writer, http.StatusForbidden, "invalid origin")
		return
	}
	request.Body = http.MaxBytesReader(writer, request.Body, maxRequestBody)
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	var payload scoreRequest
	if err := decoder.Decode(&payload); err != nil {
		writeError(writer, http.StatusBadRequest, "invalid request")
		return
	}
	if err := ensureSingleJSONValue(decoder); err != nil {
		writeError(writer, http.StatusBadRequest, "invalid request")
		return
	}
	if strings.TrimSpace(payload.Website) != "" {
		writeError(writer, http.StatusBadRequest, "invalid request")
		return
	}
	nick, ok := normalizeNick(payload.Nick)
	if !ok {
		writeError(writer, http.StatusBadRequest, "invalid nickname")
		return
	}
	if payload.Score < 0 || payload.Score > maxScore || payload.Availability < 99.8 || payload.Availability > 100 || payload.Budget < 0 || payload.Budget > 100 || payload.Duration != shiftDuration {
		writeError(writer, http.StatusBadRequest, "invalid score")
		return
	}
	filteredAchievements := submittedAchievements(payload.Achievements)
	ip := clientIP(request)
	now := time.Now().UTC()

	service.mu.Lock()
	defer service.mu.Unlock()
	if !service.allowLocked("score:"+ip, 20, time.Hour) {
		writeError(writer, http.StatusTooManyRequests, "rate limit exceeded")
		return
	}
	session, exists := service.sessions[payload.SessionID]
	_, alreadyUsed := service.usedSessions[payload.SessionID]
	legacyRecovery := !exists && !alreadyUsed && now.Sub(service.startedAt) < time.Hour && validLegacyToken(payload.SessionID) && service.allowLocked("recovery:"+ip, 1, time.Hour)
	validSession := exists && session.IP == ip && now.Sub(session.StartedAt) >= 75*time.Second && now.Sub(session.StartedAt) <= 6*time.Minute
	if alreadyUsed || (!validSession && !legacyRecovery) {
		writeError(writer, http.StatusForbidden, "invalid or incomplete session")
		return
	}
	if exists {
		delete(service.sessions, payload.SessionID)
	}
	service.usedSessions[payload.SessionID] = now
	if err := service.persistSessionsLocked(); err != nil {
		if exists {
			service.sessions[payload.SessionID] = session
		}
		delete(service.usedSessions, payload.SessionID)
		log.Printf("persist completed session: %v", err)
		writeError(writer, http.StatusInternalServerError, "could not complete session")
		return
	}

	entry := scoreEntry{Nick: nick, Score: payload.Score, Availability: payload.Availability, Budget: payload.Budget, Achievements: filteredAchievements, AchievementCount: len(filteredAchievements), CreatedAt: now}
	newAchievements := service.upsertBestLocked(entry)
	if err := service.persistLocked(); err != nil {
		log.Printf("persist leaderboard: %v", err)
		writeError(writer, http.StatusInternalServerError, "could not save score")
		return
	}
	entries := service.topTenLocked()
	rank := 0
	for index, candidate := range entries {
		if strings.EqualFold(candidate.Nick, nick) {
			rank = index + 1
			break
		}
	}
	writeJSON(writer, http.StatusCreated, map[string]any{"entries": publicLeaderboard(entries), "newAchievements": newAchievements, "rank": rank})
}

func ensureSingleJSONValue(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		return errors.New("additional JSON value")
	}
	return nil
}

func normalizeNick(raw string) (string, bool) {
	nick := strings.Join(strings.Fields(strings.TrimSpace(raw)), " ")
	count := utf8.RuneCountInString(nick)
	if count < minNicknameLength || count > maxNicknameLength {
		return "", false
	}
	for index, character := range nick {
		if index == 0 && !unicode.IsLetter(character) && !unicode.IsNumber(character) {
			return "", false
		}
		if !unicode.IsLetter(character) && !unicode.IsNumber(character) && character != ' ' && character != '_' && character != '-' && character != '.' {
			return "", false
		}
	}
	if containsProfanity(nick) {
		return "", false
	}
	return nick, true
}

func containsProfanity(value string) bool {
	english := make([]rune, 0, len(value))
	russian := make([]rune, 0, len(value))
	for _, character := range strings.ToLower(value) {
		if !unicode.IsLetter(character) && !unicode.IsNumber(character) {
			continue
		}
		english = append(english, normalizeEnglishCharacter(character))
		russian = append(russian, normalizeRussianCharacter(character))
	}
	englishValue := string(collapseRepeatedRunes(english))
	russianValue := string(collapseRepeatedRunes(russian))
	return containsAnyRoot(englishValue, englishProfanityRoots) || containsAnyRoot(russianValue, russianProfanityRoots)
}

func normalizeEnglishCharacter(character rune) rune {
	switch character {
	case '0', 'о':
		return 'o'
	case '1', 'і':
		return 'i'
	case '3', 'е':
		return 'e'
	case '4', 'а':
		return 'a'
	case '5':
		return 's'
	case '7', 'т':
		return 't'
	case '8', 'в':
		return 'b'
	case 'к':
		return 'k'
	case 'б':
		return 'b'
	case 'г':
		return 'g'
	case 'д':
		return 'd'
	case 'з':
		return 'z'
	case 'и', 'й':
		return 'i'
	case 'л':
		return 'l'
	case 'м':
		return 'm'
	case 'н':
		return 'n'
	case 'п':
		return 'p'
	case 'р':
		return 'p'
	case 'с':
		return 'c'
	case 'у':
		return 'u'
	case 'х':
		return 'x'
	}
	return character
}

func normalizeRussianCharacter(character rune) rune {
	switch character {
	case '0', 'o':
		return 'о'
	case '1', 'i':
		return 'и'
	case '3':
		return 'з'
	case '4':
		return 'ч'
	case '5':
		return 'с'
	case '6':
		return 'б'
	case 'a':
		return 'а'
	case 'b':
		return 'в'
	case 'c':
		return 'с'
	case 'e':
		return 'е'
	case 'h':
		return 'н'
	case 'k':
		return 'к'
	case 'm':
		return 'м'
	case 'p':
		return 'р'
	case 't':
		return 'т'
	case 'x':
		return 'х'
	case 'y':
		return 'у'
	}
	return character
}

func collapseRepeatedRunes(value []rune) []rune {
	result := make([]rune, 0, len(value))
	for _, character := range value {
		if len(result) == 0 || result[len(result)-1] != character {
			result = append(result, character)
		}
	}
	return result
}

func containsAnyRoot(value string, roots []string) bool {
	for _, root := range roots {
		if strings.Contains(value, root) {
			return true
		}
	}
	return false
}

func uniqueAchievements(values []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0, len(values))
	for _, value := range values {
		if allowedAchievements[value] && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	sort.Strings(result)
	return result
}

func submittedAchievements(values []string) []string {
	filtered := uniqueAchievements(values)
	result := make([]string, 0, len(filtered))
	for _, achievement := range filtered {
		if achievement != legendaryAchievementID {
			result = append(result, achievement)
		}
	}
	return result
}

func withLegendaryAchievement(values []string) []string {
	result := uniqueAchievements(values)
	collected := make(map[string]bool, len(result))
	for _, achievement := range result {
		collected[achievement] = true
	}
	for _, achievement := range coreAchievementIDs {
		if !collected[achievement] {
			return result
		}
	}
	if !collected[legendaryAchievementID] {
		result = append(result, legendaryAchievementID)
	}
	return result
}

func (service *api) upsertBestLocked(entry scoreEntry) []string {
	for index, existing := range service.data.Entries {
		if strings.EqualFold(existing.Nick, entry.Nick) {
			known := make(map[string]bool, len(existing.Achievements))
			for _, achievement := range existing.Achievements {
				known[achievement] = true
			}
			mergedAchievements := withLegendaryAchievement(append(append([]string{}, existing.Achievements...), entry.Achievements...))
			newAchievements := make([]string, 0, len(mergedAchievements))
			for _, achievement := range mergedAchievements {
				if !known[achievement] {
					newAchievements = append(newAchievements, achievement)
				}
			}
			if betterScore(entry, existing) {
				entry.Achievements = mergedAchievements
				entry.AchievementCount = len(mergedAchievements)
				service.data.Entries[index] = entry
				service.pruneLocked()
			} else if len(newAchievements) > 0 {
				existing.Achievements = mergedAchievements
				existing.AchievementCount = len(mergedAchievements)
				service.data.Entries[index] = existing
			}
			return newAchievements
		}
	}
	entry.Achievements = withLegendaryAchievement(entry.Achievements)
	entry.AchievementCount = len(entry.Achievements)
	service.data.Entries = append(service.data.Entries, entry)
	service.pruneLocked()
	return append([]string{}, entry.Achievements...)
}

func (service *api) pruneLocked() {
	if len(service.data.Entries) <= 100 {
		return
	}
	sort.SliceStable(service.data.Entries, func(left, right int) bool {
		return betterScore(service.data.Entries[left], service.data.Entries[right])
	})
	service.data.Entries = service.data.Entries[:100]
}

func betterScore(left, right scoreEntry) bool {
	if left.Score != right.Score {
		return left.Score > right.Score
	}
	if left.Availability != right.Availability {
		return left.Availability > right.Availability
	}
	if left.Budget != right.Budget {
		return left.Budget > right.Budget
	}
	return left.CreatedAt.Before(right.CreatedAt)
}

func (service *api) topTenLocked() []scoreEntry {
	entries := append([]scoreEntry(nil), service.data.Entries...)
	sort.SliceStable(entries, func(left, right int) bool { return betterScore(entries[left], entries[right]) })
	if len(entries) > 10 {
		entries = entries[:10]
	}
	return entries
}

func publicLeaderboard(entries []scoreEntry) []leaderboardEntry {
	result := make([]leaderboardEntry, 0, len(entries))
	for _, entry := range entries {
		result = append(result, leaderboardEntry{
			Nick:             entry.Nick,
			Score:            entry.Score,
			Availability:     entry.Availability,
			Budget:           entry.Budget,
			Achievements:     append([]string{}, entry.Achievements...),
			AchievementCount: entry.AchievementCount,
		})
	}
	return result
}

func (service *api) allowLocked(key string, limit int, window time.Duration) bool {
	now := time.Now().UTC()
	cutoff := now.Add(-window)
	current := service.rates[key]
	kept := current.Events[:0]
	for _, event := range current.Events {
		if event.After(cutoff) {
			kept = append(kept, event)
		}
	}
	if len(kept) >= limit {
		service.rates[key] = rateWindow{Events: kept}
		return false
	}
	kept = append(kept, now)
	service.rates[key] = rateWindow{Events: kept}
	return true
}

func (service *api) validOrigin(request *http.Request) bool {
	return request.Header.Get("Origin") == service.origin
}

func clientIP(request *http.Request) string {
	if forwarded := strings.TrimSpace(request.Header.Get("X-Real-IP")); net.ParseIP(forwarded) != nil {
		return forwarded
	}
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err == nil {
		return host
	}
	return request.RemoteAddr
}

func randomToken() (string, error) {
	buffer := make([]byte, 24)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func validLegacyToken(token string) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	return err == nil && len(decoded) == 24
}

func (service *api) load() error {
	if err := os.MkdirAll(filepath.Dir(service.dataPath), 0750); err != nil {
		return err
	}
	content, err := os.ReadFile(service.dataPath)
	if errors.Is(err, os.ErrNotExist) {
		service.data = storedData{Entries: []scoreEntry{}}
	} else if err != nil {
		return err
	} else if err := json.Unmarshal(content, &service.data); err != nil {
		return err
	}
	for index := range service.data.Entries {
		service.data.Entries[index].Achievements = withLegendaryAchievement(service.data.Entries[index].Achievements)
		service.data.Entries[index].AchievementCount = len(service.data.Entries[index].Achievements)
	}
	return service.loadSessions()
}

func (service *api) loadSessions() error {
	content, err := os.ReadFile(service.sessionsPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var stored storedSessions
	if err := json.Unmarshal(content, &stored); err != nil {
		return err
	}
	if stored.Active != nil {
		service.sessions = stored.Active
	}
	if stored.Used != nil {
		service.usedSessions = stored.Used
	}
	return nil
}

func (service *api) persistLocked() error {
	content, err := json.MarshalIndent(service.data, "", "  ")
	if err != nil {
		return err
	}
	temporary := service.dataPath + ".tmp"
	if err := os.WriteFile(temporary, content, 0640); err != nil {
		return err
	}
	return os.Rename(temporary, service.dataPath)
}

func (service *api) persistSessionsLocked() error {
	content, err := json.MarshalIndent(storedSessions{Active: service.sessions, Used: service.usedSessions}, "", "  ")
	if err != nil {
		return err
	}
	temporary := service.sessionsPath + ".tmp"
	if err := os.WriteFile(temporary, content, 0640); err != nil {
		return err
	}
	return os.Rename(temporary, service.sessionsPath)
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.WriteHeader(status)
	if err := json.NewEncoder(writer).Encode(value); err != nil {
		log.Printf("encode response: %v", err)
	}
}

func writeError(writer http.ResponseWriter, status int, message string) {
	writeJSON(writer, status, map[string]string{"error": message})
}
