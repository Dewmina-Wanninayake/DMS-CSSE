-- UC-DIST-02 extension 10b: a warning that waits too long for a Second Approver is passed to the
-- next approver on the roster. Additive change to the module's own table.
ALTER TABLE warnings ADD COLUMN escalation_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE warnings ADD COLUMN last_escalated_at TEXT;
