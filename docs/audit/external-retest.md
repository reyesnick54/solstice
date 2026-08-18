# External retest

`FindingRetestRequest` contains the finding ID, original report
reference, affected old commit, remediated commit, patch digest,
regression test, formal/fuzz/range evidence, and
build/reproduction instructions.

`FindingRetestResult` preserves reviewer identity/reference, date,
scope, result, report digest, and human evidence verification.

Software cannot generate an external-pass record itself. AI cannot
assign `EXTERNALLY_RETESTED`.

A retest for commit A cannot automatically clear the same finding
on unrelated future commit B. Compatibility must be explicit.

Tampered retest result digests are rejected.
