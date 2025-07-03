import { createVibeTunnelClient } from '../utils/factory';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

async function fileOperationsExample() {
  const client = createVibeTunnelClient('localhost');

  try {
    // Initialize and authenticate
    await client.initialize();
    const authenticated = await client.authenticatePassword(
      process.env.USER || 'demo',
      process.env.VIBETUNNEL_PASSWORD || 'demo'
    );

    if (!authenticated) {
      console.error('Authentication failed');
      return;
    }

    console.log('=== File Operations Example ===\n');

    // Browse current directory
    console.log('1. Browsing current directory:');
    const files = await client.files.browseDirectory('.');
    files.slice(0, 5).forEach(file => {
      const type = file.isDirectory ? 'DIR' : 'FILE';
      const size = file.isDirectory ? '' : ` (${file.size} bytes)`;
      console.log(`  ${type}: ${file.name}${size}`);
    });

    // Create a test file locally
    const testContent = `# VibeTunnel Test File
Created at: ${new Date().toISOString()}
This is a test file for demonstrating VibeTunnel file operations.

## Features Tested:
- File upload
- File download
- File preview
- Directory browsing
`;

    const testFileName = 'vibetunnel-test.md';
    const localTestFile = join(process.cwd(), testFileName);
    writeFileSync(localTestFile, testContent);

    console.log('\n2. Uploading test file...');
    const uploadResult = await client.files.uploadFile(localTestFile, {
      fileName: testFileName,
      overwrite: true
    });
    console.log(`  Uploaded: ${uploadResult.filename} (${uploadResult.size} bytes)`);

    // List uploaded files
    console.log('\n3. Listing uploaded files:');
    const uploadedFiles = await client.files.listUploadedFiles();
    uploadedFiles.forEach(file => {
      console.log(`  ${file.filename} - ${file.size} bytes (${file.uploadTime})`);
    });

    // Get file preview
    console.log('\n4. File preview:');
    try {
      const preview = await client.files.getFilePreview(testFileName);
      console.log(`  Content preview (${preview.size} bytes, binary: ${preview.isBinary}):`);
      console.log('  ' + preview.content.split('\n').slice(0, 3).join('\n  '));
    } catch (error) {
      console.log(`  Preview failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Download file back
    console.log('\n5. Downloading file:');
    const downloadedContent = await client.files.getUploadedFile(uploadResult.filename);
    const downloadedText = downloadedContent.toString();
    console.log(`  Downloaded ${downloadedContent.length} bytes`);
    console.log(`  Content matches: ${downloadedText === testContent}`);

    // Create directory
    console.log('\n6. Creating test directory:');
    const dirResult = await client.files.createDirectory('test-dir', false);
    console.log(`  Directory created: ${dirResult.created} at ${dirResult.path}`);

    // Browse test directory
    console.log('\n7. Browsing test directory:');
    const testDirFiles = await client.files.browseDirectory('test-dir');
    console.log(`  Files in test-dir: ${testDirFiles.length}`);

    // Check Git status (if in a git repo)
    console.log('\n8. Checking Git status:');
    try {
      const gitFiles = await client.files.browseDirectory('.');
      const gitStatusFiles = gitFiles.filter(f => f.gitStatus);
      console.log(`  Files with Git status: ${gitStatusFiles.length}`);
      gitStatusFiles.slice(0, 3).forEach(file => {
        const status = file.gitStatus!;
        const statusStr = [
          status.staged && 'staged',
          status.modified && 'modified',
          status.untracked && 'untracked'
        ].filter(Boolean).join(', ');
        console.log(`    ${file.name}: ${statusStr}`);
      });
    } catch (error) {
      console.log(`  Git status check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Cleanup - delete uploaded file
    console.log('\n9. Cleaning up:');
    await client.files.deleteUploadedFile(uploadResult.filename);
    console.log(`  Deleted: ${uploadResult.filename}`);

    // Clean up local test file
    try {
      require('fs').unlinkSync(localTestFile);
      console.log(`  Deleted local file: ${testFileName}`);
    } catch (error) {
      console.log(`  Could not delete local file: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('\n=== File Operations Complete ===');

  } catch (error) {
    console.error('Error in file operations:', error);
  } finally {
    client.disconnect();
  }
}

// Run example
if (require.main === module) {
  fileOperationsExample().catch(console.error);
}

export { fileOperationsExample };