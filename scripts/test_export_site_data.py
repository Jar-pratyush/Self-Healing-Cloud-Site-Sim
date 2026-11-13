# Tests for the pure parts of export_site_data.py. No capstone checkout needed.
# Run with: python3 -m unittest discover -s scripts

import unittest

import export_site_data as exporter


def make_episode(policy, fault, recovered, mttr, actions=1):
    return {
        "policy": policy,
        "fault": fault,
        "recovered": recovered,
        "mttr_censored_s": mttr,
        "actions": actions,
        "sla_penalty": 1.0,
        "target": None,
        "severity": None,
        "index": 0,
    }


class ParseCellTests(unittest.TestCase):
    def test_types(self):
        self.assertIsNone(exporter.parse_cell(""))
        self.assertIs(exporter.parse_cell("True"), True)
        self.assertIs(exporter.parse_cell("False"), False)
        self.assertEqual(exporter.parse_cell("12"), 12)
        self.assertEqual(exporter.parse_cell("6.386e-05"), 6.386e-05)
        self.assertEqual(exporter.parse_cell("F1-F4"), "F1-F4")


class ActionCatalogTests(unittest.TestCase):
    source_text = """
CATALOG: tuple[Action, ...] = (
    Action(0, NOOP, None),
    Action(1, RESTART, "frontend"),
    Action(2, RESTART, "cartservice"),
    Action(3, RESTART, "currencyservice"),
    Action(4, RESTART, "productcatalogservice"),
    Action(5, SCALE, "frontend", +1),
    Action(6, SCALE, "frontend", -1),
    Action(7, SCALE, "cartservice", +1),
    Action(8, SCALE, "currencyservice", +1),
    Action(9, RESTORE, "productcatalogservice"),
    Action(10, RESTORE, "cartservice"),
    Action(11, RESTORE, "currencyservice"),
)
"""

    def test_names_follow_the_code(self):
        catalog = exporter.parse_action_catalog(self.source_text)
        self.assertEqual(len(catalog), 12)
        self.assertEqual(catalog[0]["name"], "NOOP")
        self.assertEqual(catalog[5]["name"], "SCALE_UP frontend")
        self.assertEqual(catalog[6]["name"], "SCALE_DOWN frontend")
        self.assertEqual(catalog[9]["name"], "RESTORE productcatalogservice")

    def test_incomplete_catalog_is_rejected(self):
        with self.assertRaises(exporter.ExportError):
            exporter.parse_action_catalog("Action(0, NOOP, None),")


class SummaryCheckTests(unittest.TestCase):
    raw_episodes = [
        make_episode("agent", "F1", True, 40.0),
        make_episode("agent", "F1", True, 80.0),
        make_episode("agent", "F2", False, 360.0),
        make_episode("agent", "NULL", False, 360.0, actions=0),
    ]

    def summary_row(self, fault, n, recovered, median, null_with_action=None):
        return {
            "policy": "agent",
            "fault": fault,
            "n": n,
            "recovered": recovered,
            "mttr_median_censored_s": median,
            "null_with_action": null_with_action,
        }

    def test_matching_summary_passes(self):
        rows = [
            self.summary_row("F1", 2, 2, 60.0),
            self.summary_row("F2", 1, 0, 360.0),
            self.summary_row("F1-F4", 3, 2, 80.0),
            self.summary_row("NULL", 1, None, None, null_with_action=0),
        ]
        exporter.verify_against_summary("main", self.raw_episodes, rows)

    def test_wrong_recovery_count_fails(self):
        with self.assertRaises(exporter.ExportError):
            exporter.verify_against_summary("main", self.raw_episodes, [self.summary_row("F1", 2, 1, 60.0)])

    def test_wrong_median_fails(self):
        with self.assertRaises(exporter.ExportError):
            exporter.verify_against_summary("main", self.raw_episodes, [self.summary_row("F1", 2, 2, 61.0)])

    def test_csv_precision_is_tolerated(self):
        raw = [make_episode("agent", "F2", True, 239.837)]
        exporter.verify_against_summary("main", raw, [self.summary_row("F2", 1, 1, 239.8)])

    def test_false_alarm_mismatch_fails(self):
        raw = [make_episode("agent", "NULL", False, 360.0, actions=2)]
        with self.assertRaises(exporter.ExportError):
            exporter.verify_against_summary("main", raw, [self.summary_row("NULL", 1, None, None, null_with_action=0)])


class PooledTests(unittest.TestCase):
    def test_pooled_counts_and_medians(self):
        rows = [
            make_episode("agent", "F1", True, 40.0),
            make_episode("agent", "F2", False, 360.0),
            make_episode("agent", "F3", True, 60.0),
            make_episode("agent", "NULL", False, 360.0, actions=0),
        ]
        pooled = exporter.pooled_by_policy(rows)["agent"]
        self.assertEqual(pooled["fault_episodes"], 3)
        self.assertEqual(pooled["recovered"], 2)
        self.assertEqual(pooled["mttr_median_censored_s"], 60)
        self.assertEqual(pooled["mttr_median_recovered_s"], 50)
        self.assertEqual(pooled["null_with_action"], 0)


if __name__ == "__main__":
    unittest.main()
