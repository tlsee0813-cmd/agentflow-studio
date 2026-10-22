# Cycle20 first CI regression

Exact tested head: afc3fbe0dd444d92560aacdd4292f20627826d79. Run 39801710849. Both Ubuntu 119903881664 and Windows 119903882205 fail SPATIAL102 test_11_a_chain_without_any_export_is_described_as_links_only, before the new received20 browser suite runs.

The new report reader displays an exported-work heading even for a pasted report chain with no export. The missing-snapshot body does not remove the misleading presupposition in the heading. Coordinator classifies this as a product regression pending independent review; do not relax the existing no-export negative guard merely to pass.

These JSON files preserve the Code Review provider responses. Both responses identify logTruncated:true; they are not represented as complete raw job logs. No alternate CI endpoint or CLI was used. Browser independence remains pending; this failure is not attributed to Cloud.
