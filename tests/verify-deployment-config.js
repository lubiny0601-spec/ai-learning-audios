const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTest() {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'deploy.yml');
  const readmePath = path.join(__dirname, '..', 'README.md');
  const gitignorePath = path.join(__dirname, '..', '.gitignore');

  assert.ok(fs.existsSync(workflowPath), '.github/workflows/deploy.yml must exist');
  assert.ok(fs.existsSync(readmePath), 'README.md must exist');
  assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');

  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.ok(workflow.includes('actions/deploy-pages'), 'Workflow must use deploy-pages action');
  assert.ok(workflow.includes('actions/upload-pages-artifact'), 'Workflow must upload pages artifact');

  console.log('✅ Deployment configuration verification passed!');
}

runTest();
