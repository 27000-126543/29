import { GameServer } from './server/GameServer';

const server = new GameServer();

const args = process.argv.slice(2);

if (args.includes('--demo')) {
  console.log('[FishingSystem] Running demo mode...\n');
  server.demo();
} else {
  server.start(3000);
  console.log('[FishingSystem] Game server starting on port 3000...');
}

