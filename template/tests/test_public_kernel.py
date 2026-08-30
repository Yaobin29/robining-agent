import unittest

from capabilities.robining_agent.contracts import validate_contract
from capabilities.robining_agent.routing import classify_intent, route_artifact


class PublicKernelTests(unittest.TestCase):
    def test_privacy_overrides_role(self):
        decision = route_artifact(role="skill", lifecycle="live", reuse_scope="repo-wide", privacy="sensitive")
        self.assertEqual(decision.bucket, "local-runtime")
        self.assertFalse(decision.public)

    def test_six_bucket_routes(self):
        cases = {
            "authority": "core",
            "reusable-capability": "capabilities",
            "example": "template",
            "project-source": "projects",
            "deliverable": "outputs",
            "runtime": "local-runtime",
        }
        for role, expected in cases.items():
            with self.subTest(role=role):
                self.assertEqual(route_artifact(role=role, lifecycle="live", reuse_scope="repo-wide", privacy="public").bucket, expected)

    def test_intent_classification(self):
        self.assertEqual(classify_intent("Why did the result fail?"), "WHY")
        self.assertEqual(classify_intent("How do I build the route?"), "HOW")
        self.assertEqual(classify_intent("Why did it fail and how can I fix it?"), "MIX")

    def test_contracts(self):
        payload = {"goal": "x", "type": "HOW", "constraints": [], "inputs": [], "requested_outputs": []}
        self.assertEqual(validate_contract("TaskBrief", payload), [])
        self.assertTrue(validate_contract("RunSummary", {"status": "unknown"}))


if __name__ == "__main__":
    unittest.main()
