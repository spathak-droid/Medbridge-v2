"""Tests for conversation context management — token-counted sliding window with pinning.

Covers:
- Short conversations pass through unchanged
- Long conversations are truncated to fit budget
- First message is always preserved
- Messages with tool calls are always preserved
- Last 4 messages are always preserved
- System note is prepended when truncation occurs
- Empty message list returns empty
"""

from app.services.coach_service import (
    _truncate_conversation_messages,
    _estimate_tokens,
)


def _make_messages(count: int, content_len: int = 200) -> list[dict]:
    """Create test messages with predictable token counts."""
    return [
        {"role": "patient" if i % 2 == 0 else "coach", "content": "x" * content_len, "has_tool_calls": False}
        for i in range(count)
    ]


class TestEstimateTokens:
    def test_empty_string(self):
        assert _estimate_tokens("") == 0

    def test_four_chars_one_token(self):
        assert _estimate_tokens("abcd") == 1

    def test_hundred_chars(self):
        assert _estimate_tokens("a" * 100) == 25


class TestTruncateConversationMessages:
    def test_empty_list(self):
        assert _truncate_conversation_messages([]) == []

    def test_short_conversation_unchanged(self):
        """Conversations within budget pass through unchanged."""
        msgs = _make_messages(5, content_len=40)  # 5 * 10 tokens = 50 < 3000
        result = _truncate_conversation_messages(msgs)
        assert len(result) == 5

    def test_long_conversation_truncated(self):
        """Conversations exceeding budget are truncated."""
        msgs = _make_messages(100, content_len=200)  # 100 * 50 tokens = 5000 > 3000
        result = _truncate_conversation_messages(msgs, token_budget=3000)
        total_tokens = sum(_estimate_tokens(m["content"]) for m in result)
        # Should be within budget (allowing for system note)
        assert total_tokens <= 3200  # budget + system note overhead

    def test_first_message_preserved(self):
        """First message is always kept."""
        msgs = _make_messages(100, content_len=200)
        msgs[0]["content"] = "FIRST_MESSAGE_MARKER"
        result = _truncate_conversation_messages(msgs, token_budget=500)
        contents = [m["content"] for m in result]
        assert "FIRST_MESSAGE_MARKER" in contents

    def test_tool_call_messages_preserved(self):
        """Messages with tool calls are always pinned."""
        msgs = _make_messages(100, content_len=200)
        msgs[10]["has_tool_calls"] = True
        msgs[10]["content"] = "TOOL_CALL_MARKER"
        result = _truncate_conversation_messages(msgs, token_budget=500)
        contents = [m["content"] for m in result]
        assert "TOOL_CALL_MARKER" in contents

    def test_last_four_messages_preserved(self):
        """Last 4 messages are always kept."""
        msgs = _make_messages(100, content_len=200)
        for i in range(96, 100):
            msgs[i]["content"] = f"RECENT_{i}"
        result = _truncate_conversation_messages(msgs, token_budget=1000)
        contents = [m["content"] for m in result]
        for i in range(96, 100):
            assert f"RECENT_{i}" in contents

    def test_system_note_prepended_on_truncation(self):
        """A system note is added when messages are dropped."""
        msgs = _make_messages(100, content_len=200)
        result = _truncate_conversation_messages(msgs, token_budget=500)
        assert result[0]["role"] == "system"
        assert "trimmed" in result[0]["content"].lower()

    def test_no_system_note_when_no_truncation(self):
        """No system note when all messages fit."""
        msgs = _make_messages(3, content_len=40)
        result = _truncate_conversation_messages(msgs)
        assert all(m["role"] != "system" for m in result)
