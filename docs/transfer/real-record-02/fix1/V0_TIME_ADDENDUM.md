# V0 timestamp evidence addendum

No v0 execution or file modification was performed for this investigation. The fixed transfer commit examined is `7e79392080157be693429da40d54c2a206b8aa7b`.

Its actual result.json has `started_at=2026-10-15T16:09:04.344441+00:00` and `finished_at=2026-10-15T16:09:07.831683+00:00`, not +09:00. Its reproduce.py uses `datetime.now(timezone.utc).isoformat()` for both. The retained local files and these committed blobs are byte-identical (hashes below). This evidence is consistent with the supplied UTC code.

The reported +09:00 JSON variant was not found in these original artifacts. Whether a different displayed/exported copy was timezone-converted after execution, or a different execution/transfer code existed, is **unconfirmed**. No conversion, code difference or time estimate is inferred. Neither historical timestamps nor v0 originals were rewritten.

```json
{
  "reproduce.py": {
    "git_sha256": "16d699d65804a377af292c484e2e3455fe9b603d188853e81fa7beee01fed19f",
    "local_sha256": "16d699d65804a377af292c484e2e3455fe9b603d188853e81fa7beee01fed19f",
    "byte_equal": true
  },
  "result.json": {
    "git_sha256": "3951b1cee0ef36a4934f25ec7abf77c2470d89124db8dcfe85c178a2f5858147",
    "local_sha256": "3951b1cee0ef36a4934f25ec7abf77c2470d89124db8dcfe85c178a2f5858147",
    "byte_equal": true
  },
  "timestamps": {
    "started_at": "2026-10-15T16:09:04.344441+00:00",
    "finished_at": "2026-10-15T16:09:07.831683+00:00"
  }
}
```
