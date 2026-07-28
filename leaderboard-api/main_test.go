package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

func TestNormalizeNick(t *testing.T) {
	valid := map[string]string{
		" haEniken ":       "haEniken",
		"Сергей  SRE":      "Сергей SRE",
		"ops_team-1":       "ops_team-1",
		"FifteenChars123":  "FifteenChars123",
		"\t Night\n  Ops ": "Night Ops",
	}
	for input, expected := range valid {
		actual, ok := normalizeNick(input)
		if !ok || actual != expected {
			t.Fatalf("normalizeNick(%q) = %q, %v; want %q, true", input, actual, ok, expected)
		}
	}
	invalid := []string{"x", "<script>", "@operator", "SixteenChars1234", "this-nickname-is-far-too-long"}
	for _, input := range invalid {
		if _, ok := normalizeNick(input); ok {
			t.Fatalf("normalizeNick(%q) unexpectedly accepted", input)
		}
	}
}

func TestNormalizeNickRejectsRussianAndEnglishProfanity(t *testing.T) {
	blocked := []string{"f.u.c.k", "fуck", "fuuuck", "sh1t", "х_у_й", "п1зда", "p1здa", "x-y-й", "blya", "s.u.k.a"}
	for _, input := range blocked {
		if _, ok := normalizeNick(input); ok {
			t.Errorf("normalizeNick(%q) unexpectedly accepted profanity", input)
		}
	}
}

func TestNormalizeNickAllowsOrdinaryNames(t *testing.T) {
	allowed := []string{"haEniken", "NightOps", "Сергей_SRE", "Cluster-01", "Космонавт"}
	for _, input := range allowed {
		if _, ok := normalizeNick(input); !ok {
			t.Errorf("normalizeNick(%q) unexpectedly rejected an ordinary nickname", input)
		}
	}
}

func TestLeaderboardKeepsBestScorePerNick(t *testing.T) {
	service := &api{data: storedData{Entries: []scoreEntry{}}}
	now := time.Now().UTC()
	service.upsertBestLocked(scoreEntry{Nick: "Pilot", Score: 500, Availability: 99.95, Budget: 80, Achievements: []string{"first_shift"}, CreatedAt: now})
	newAchievements := service.upsertBestLocked(scoreEntry{Nick: "pilot", Score: 400, Availability: 100, Budget: 100, Achievements: []string{"slo_keeper"}, CreatedAt: now.Add(time.Second)})
	service.upsertBestLocked(scoreEntry{Nick: "PILOT", Score: 700, Availability: 99.96, Budget: 82, Achievements: []string{"fast_reaction"}, CreatedAt: now.Add(2 * time.Second)})
	entries := service.topTenLocked()
	if len(entries) != 1 || entries[0].Score != 700 || entries[0].AchievementCount != 3 {
		t.Fatalf("unexpected entries: %#v", entries)
	}
	if len(newAchievements) != 1 || newAchievements[0] != "slo_keeper" {
		t.Fatalf("unexpected newly unlocked achievements: %#v", newAchievements)
	}
}

func TestLeaderboardReturnsOnlyTopTen(t *testing.T) {
	service := &api{data: storedData{Entries: []scoreEntry{}}}
	for index := 0; index < 12; index++ {
		service.data.Entries = append(service.data.Entries, scoreEntry{Nick: string(rune('A' + index)), Score: index * 100})
	}
	entries := service.topTenLocked()
	if len(entries) != 10 || entries[0].Score != 1100 || entries[9].Score != 200 {
		t.Fatalf("unexpected top ten: %#v", entries)
	}
}

func TestStoredLeaderboardIsBounded(t *testing.T) {
	service := &api{data: storedData{Entries: []scoreEntry{}}}
	for index := 0; index < 120; index++ {
		service.upsertBestLocked(scoreEntry{Nick: "Pilot" + strconv.Itoa(index), Score: index})
	}
	if len(service.data.Entries) != 100 {
		t.Fatalf("stored entries = %d; want 100", len(service.data.Entries))
	}
}

func TestAchievementsAreFilteredAndUnique(t *testing.T) {
	actual := uniqueAchievements([]string{"first_shift", "unknown", "first_shift", "slo_keeper", "violet_protocol"})
	if len(actual) != 3 || actual[0] != "first_shift" || actual[1] != "slo_keeper" || actual[2] != "violet_protocol" {
		t.Fatalf("unexpected achievements: %#v", actual)
	}
}

func TestLegendaryAchievementRequiresAllCoreAchievements(t *testing.T) {
	service := &api{data: storedData{Entries: []scoreEntry{}}}
	firstBatch := append([]string{}, coreAchievementIDs[:len(coreAchievementIDs)-1]...)
	service.upsertBestLocked(scoreEntry{Nick: "OrbitPilot", Score: 1200, Achievements: firstBatch})
	newAchievements := service.upsertBestLocked(scoreEntry{Nick: "orbitpilot", Score: 1250, Achievements: []string{coreAchievementIDs[len(coreAchievementIDs)-1]}})
	entries := service.topTenLocked()
	if len(entries) != 1 || entries[0].AchievementCount != 18 || entries[0].Achievements[len(entries[0].Achievements)-1] != legendaryAchievementID {
		t.Fatalf("legendary achievement was not granted: %#v", entries)
	}
	wantNew := map[string]bool{coreAchievementIDs[len(coreAchievementIDs)-1]: true, legendaryAchievementID: true}
	if len(newAchievements) != 2 || !wantNew[newAchievements[0]] || !wantNew[newAchievements[1]] {
		t.Fatalf("unexpected newly unlocked achievements: %#v", newAchievements)
	}
}

func TestLegendaryAchievementCannotBeSubmittedDirectly(t *testing.T) {
	actual := submittedAchievements([]string{"first_shift", legendaryAchievementID})
	if len(actual) != 1 || actual[0] != "first_shift" {
		t.Fatalf("legendary achievement accepted from client: %#v", actual)
	}
}

func TestPublicLeaderboardIncludesAchievementDetails(t *testing.T) {
	entries := publicLeaderboard([]scoreEntry{{
		Nick: "Pilot", Score: 1200, Achievements: []string{"first_shift", "slo_keeper"}, AchievementCount: 2,
	}})
	if len(entries) != 1 || len(entries[0].Achievements) != 2 || entries[0].Achievements[1] != "slo_keeper" {
		t.Fatalf("achievement details missing from public leaderboard: %#v", entries)
	}
}

func TestCompletedSessionCanSaveScore(t *testing.T) {
	temporaryDirectory := t.TempDir()
	dataPath := filepath.Join(temporaryDirectory, "scores.json")
	service := &api{
		dataPath: dataPath, sessionsPath: filepath.Join(temporaryDirectory, "sessions.json"), origin: "https://haeniken.com",
		data: storedData{Entries: []scoreEntry{}}, sessions: map[string]gameSession{"valid-session": {IP: "192.0.2.10", StartedAt: time.Now().UTC().Add(-80 * time.Second)}},
		usedSessions: make(map[string]time.Time), rates: make(map[string]rateWindow), startedAt: time.Now().UTC(),
	}
	payload := scoreRequest{SessionID: "valid-session", Nick: "OrbitPilot", Score: 1234, Availability: 99.98, Budget: 81, Duration: shiftDuration, Achievements: []string{"first_shift", "slo_keeper"}}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/v1/leaderboard", bytes.NewReader(body))
	request.Header.Set("Origin", "https://haeniken.com")
	request.Header.Set("X-Real-IP", "192.0.2.10")
	recorder := httptest.NewRecorder()
	service.handleLeaderboard(recorder, request)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	if len(service.data.Entries) != 1 || service.data.Entries[0].Nick != "OrbitPilot" {
		t.Fatalf("score not saved: %#v", service.data.Entries)
	}
	if _, err := os.Stat(dataPath); err != nil {
		t.Fatal(err)
	}
	if _, ok := service.usedSessions["valid-session"]; !ok {
		t.Fatal("completed session was not marked as used")
	}
}

func TestSessionsSurviveReload(t *testing.T) {
	temporaryDirectory := t.TempDir()
	dataPath := filepath.Join(temporaryDirectory, "scores.json")
	sessionsPath := filepath.Join(temporaryDirectory, "sessions.json")
	first := &api{dataPath: dataPath, sessionsPath: sessionsPath, data: storedData{Entries: []scoreEntry{}}, sessions: map[string]gameSession{"token": {IP: "192.0.2.20", StartedAt: time.Now().UTC()}}, usedSessions: make(map[string]time.Time)}
	if err := first.persistSessionsLocked(); err != nil {
		t.Fatal(err)
	}
	second := &api{dataPath: dataPath, sessionsPath: sessionsPath, sessions: make(map[string]gameSession), usedSessions: make(map[string]time.Time)}
	if err := second.load(); err != nil {
		t.Fatal(err)
	}
	if _, ok := second.sessions["token"]; !ok {
		t.Fatal("active session was not restored")
	}
}

func TestLegacySessionCanBeRecoveredOnce(t *testing.T) {
	temporaryDirectory := t.TempDir()
	token, err := randomToken()
	if err != nil {
		t.Fatal(err)
	}
	service := &api{
		dataPath: filepath.Join(temporaryDirectory, "scores.json"), sessionsPath: filepath.Join(temporaryDirectory, "sessions.json"), origin: "https://haeniken.com",
		data: storedData{Entries: []scoreEntry{}}, sessions: make(map[string]gameSession), usedSessions: make(map[string]time.Time), rates: make(map[string]rateWindow), startedAt: time.Now().UTC(),
	}
	payload := scoreRequest{SessionID: token, Nick: "RecoveredPilot", Score: 900, Availability: 99.97, Budget: 70, Duration: shiftDuration, Achievements: []string{"first_shift"}}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/v1/leaderboard", bytes.NewReader(body))
	request.Header.Set("Origin", "https://haeniken.com")
	request.Header.Set("X-Real-IP", "192.0.2.30")
	recorder := httptest.NewRecorder()
	service.handleLeaderboard(recorder, request)
	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	secondRequest := httptest.NewRequest(http.MethodPost, "/v1/leaderboard", bytes.NewReader(body))
	secondRequest.Header.Set("Origin", "https://haeniken.com")
	secondRequest.Header.Set("X-Real-IP", "192.0.2.30")
	secondRecorder := httptest.NewRecorder()
	service.handleLeaderboard(secondRecorder, secondRequest)
	if secondRecorder.Code != http.StatusForbidden {
		t.Fatalf("reused token status = %d; want 403", secondRecorder.Code)
	}
}
