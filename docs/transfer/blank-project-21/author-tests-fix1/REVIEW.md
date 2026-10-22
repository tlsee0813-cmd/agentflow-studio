# Exact blank-project checker setup correction

Cloud8ebed74f ran exact41C9 and both PC methods failed at prepare():71 before creating a project; all later steps were NOT_RUN. Product starts in the work-entry view, not projects. Test212163 adds only the normal #nav-projects click before the same visible-home assertion and new-project flow. Removing the line reproduces41C9 bytes. Astra independently confirmed the exact diff/hash; no product or downstream assertion changes.

Cloud f1e4c91df657d6cc8d7e192c4e698fda43b99cb1 reran exactf7b25/212163 and both methods passed, child/collector/launcher0. Prior9f842d41 independent product flow/seven suites are bound by unchanged product bytes and were not rerun as part of this addendum. The new test's raw native preview end and currentT origin/draft/Y/open/focus assertions all ran. Old source, traceback, screenshots and NOT_RUN boundary remain immutable.

Old CI15b60/run39813998848 was last observed in_progress/null on both OS. Two CodeReview log reads returned HTTP502; that is not a CI failure. Root published the fixed head while old CI was unfinished; workflow concurrency may supersede it. No manual cancel/rerun. Do not call it passed or failed. New exacthead f7b25/run39815440492 is the final CI candidate and still pending at this writing.
