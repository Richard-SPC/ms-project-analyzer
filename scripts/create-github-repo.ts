import { getUncachableGitHubClient } from '../server/github.js';

async function createGitHubRepo() {
  try {
    const client = await getUncachableGitHubClient();
    
    // Get authenticated user
    const { data: user } = await client.rest.users.getAuthenticated();
    console.log(`Authenticated as: ${user.login}`);
    
    // Create repository
    const repoName = 'ms-project-analyzer';
    const { data: repo } = await client.rest.repos.createForAuthenticatedUser({
      name: repoName,
      description: 'Microsoft Project Programme Analyzer - DCMA 14-point and NEC compliance assessment tool',
      private: false,
      auto_init: false,
    });
    
    console.log('\n✓ Repository created successfully!');
    console.log(`Repository URL: ${repo.html_url}`);
    console.log(`Clone URL: ${repo.clone_url}`);
    console.log(`SSH URL: ${repo.ssh_url}`);
    
    console.log('\n📝 Next Steps:');
    console.log('1. Open the Git pane in Replit (left sidebar)');
    console.log('2. Stage all files you want to commit');
    console.log('3. Enter a commit message (e.g., "Initial commit - MS Project Analyzer")');
    console.log('4. Click "Commit" then "Push"');
    console.log(`5. When prompted for remote URL, use: ${repo.clone_url}`);
    
  } catch (error: any) {
    if (error.status === 422) {
      console.error('\n❌ Error: Repository "ms-project-analyzer" already exists');
      console.log('\nYou can either:');
      console.log('1. Delete the existing repository on GitHub and try again');
      console.log('2. Use the Replit Git pane to push to the existing repository');
    } else {
      console.error('Error creating repository:', error.message);
    }
    process.exit(1);
  }
}

createGitHubRepo();
