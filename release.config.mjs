export default {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/github',
      {
        assets: [
          { path: 'dist/sb.umd.js', label: 'Sb UMD bundle' },
          { path: 'dist/sb.d.ts', label: 'TypeScript declaration' },
          { path: 'dist/sb.umd.js.sha256', label: 'SHA-256 checksum' },
        ],
      },
    ],
  ],
}
