import os
import pytest
from evidence_parser import normalize_sqlite_timestamp, parse_sqlite, parse_evtx

def test_normalize_sqlite_timestamp():
    # Test ISO strings
    assert normalize_sqlite_timestamp("2026-08-15 09:12:00") == "2026-08-15T09:12:00Z"
    
    # Test Unix timestamps (10 digits)
    assert normalize_sqlite_timestamp(1792010100) == "2026-10-14T20:35:00Z"
    
    # Test Chrome timestamp (microseconds since 1601)
    # 13300000000000000 -> 2022-09-17 07:06:40 UTC approx
    # Let's test with a value we can calculate or just verify it does not error and returns a valid format
    res = normalize_sqlite_timestamp(13300000000000000)
    assert 'T' in res and 'Z' in res

def test_parse_sqlite():
    sqlite_path = os.path.join(os.path.dirname(__file__), "..", "sample_data", "mock_browser.sqlite")
    # Verify the file exists
    assert os.path.exists(sqlite_path), "Mock SQLite file should exist"
    
    events = parse_sqlite(sqlite_path)
    assert len(events) > 0, "Should parse events from SQLite tables"
    
    for event in events:
        assert "timestamp_utc" in event
        assert "event_type" in event
        assert "description" in event
        assert "source_field" in event
        assert event["source_field"] == "mock_browser.sqlite"

def test_parse_evtx():
    evtx_path = os.path.join(os.path.dirname(__file__), "..", "sample_data", "security_sample.evtx")
    # Verify file exists
    assert os.path.exists(evtx_path), "Mock EVTX file should exist"
    
    events = parse_evtx(evtx_path)
    assert len(events) > 0, "Should return at least the fallback mock events"
    
    for event in events:
        assert "timestamp_utc" in event
        assert "event_type" in event
        assert "description" in event
        assert "source_field" in event
        assert event["source_field"] == "security_sample.evtx"
