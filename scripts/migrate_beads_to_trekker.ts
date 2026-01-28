import { execSync } from 'child_process';

function run(cmd: string) {
  try {
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch (e: any) {
    console.error(`Error running command: ${cmd}`);
    console.error(e.stderr || e.message);
    return null;
  }
}

console.log("Fetching all issue IDs from beads...");
const issuesListJson = run('bd list --all --json --limit 0');
if (!issuesListJson) process.exit(1);
const issuesList = JSON.parse(issuesListJson);

console.log(`Found ${issuesList.length} issues. Starting detailed fetch and migration...`);

// Initialize trekker
run('trekker init');

const idMapping: Record<string, string> = {};
const detailsCache: any[] = [];

// 1. Detailed Fetch
for (let i = 0; i < issuesList.length; i++) {
  const issueRef = issuesList[i];
  if (i % 50 === 0) console.log(`Fetching details: ${i}/${issuesList.length}...`);
  
  const detailJson = run(`bd show ${issueRef.id} --json`);
  if (detailJson) {
    const detail = JSON.parse(detailJson)[0];
    detailsCache.push(detail);
  }
}

// 2. Create Epics
console.log("Creating Epics in trekker...");
for (const issue of detailsCache) {
  if (issue.issue_type === 'epic') {
    const status = issue.status === 'closed' ? 'completed' : 'todo';
    const cmd = `trekker epic create -t ${JSON.stringify(issue.title)} -d ${JSON.stringify(issue.description || '')} -p ${issue.priority} -s ${status}`;
    const output = run(cmd);
    if (output) {
      const match = output.match(/EPIC-\d+/);
      if (match) {
        idMapping[issue.id] = match[0];
      }
    }
  }
}

// 3. Create Tasks
console.log("Creating Tasks in trekker...");
for (const issue of detailsCache) {
  if (issue.issue_type !== 'epic') {
    const status = issue.status === 'closed' ? 'completed' : issue.status === 'in_progress' ? 'in_progress' : 'todo';
    const cmd = `trekker task create -t ${JSON.stringify(issue.title)} -d ${JSON.stringify(issue.description || '')} -p ${issue.priority} -s ${status}`;
    const output = run(cmd);
    if (output) {
      const match = output.match(/TREK-\d+/);
      if (match) {
        idMapping[issue.id] = match[0];
      }
    }
  }
}

// 4. Update Parent-Child, Dependencies, and Comments
console.log("Finalizing relationships and comments...");
for (const issue of detailsCache) {
  const newId = idMapping[issue.id];
  if (!newId) continue;

  // Epic association
  if (issue.parent_id && idMapping[issue.parent_id]) {
    const parentNewId = idMapping[issue.parent_id];
    if (parentNewId.startsWith('EPIC-')) {
      run(`trekker task update ${newId} -e ${parentNewId}`);
    }
  }

  // Dependencies
  if (issue.dependencies) {
    for (const dep of issue.dependencies) {
      const blockerId = idMapping[dep.depends_on_id];
      if (blockerId) {
        run(`trekker dep add ${newId} ${blockerId}`);
      }
    }
  }

  // Comments
  if (issue.comments) {
    for (const comment of issue.comments) {
      run(`trekker comment add ${newId} -a ${JSON.stringify(comment.author || 'migrator')} -c ${JSON.stringify(comment.text)}`);
    }
  }
}

console.log("Migration complete!");