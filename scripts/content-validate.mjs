/**
 * Validate the whole content corpus. Errors fail the process; warnings print.
 * Used by `npm run content:validate` and by CI.
 */

import { listPosts, listProjects, validateCorpus, formatReport } from '@codeblin/content';

const report = validateCorpus(listPosts({ includeDrafts: true }), listProjects({ includeUnpublished: true }));
console.log(formatReport(report));
if (report.errorCount > 0) process.exit(1);
