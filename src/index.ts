import { GameServer } from './server/GameServer';
import { ApiServer } from './api/ApiServer';

const args = process.argv.slice(2);

if (args.includes('--demo')) {
  const server = new GameServer();
  console.log('[FishingSystem] Running demo mode...\n');
  server.demo();
} else {
  const gameServer = new GameServer();
  const apiServer = new ApiServer(gameServer);
  console.log('[FishingSystem] Starting API server mode...\n');
  apiServer.start(3000);
}

