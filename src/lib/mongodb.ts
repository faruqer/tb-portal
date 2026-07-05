import mongoose, { type Connection } from 'mongoose';
import { getGameKey } from '@/lib/game-context';
import { getMongoUri, type GameKey } from '@/lib/games';
import { getAgentModel } from '@/models/Agent';
import { getGameModel } from '@/models/Game';
import { getSimCardModel } from '@/models/SimCard';
import { getVerificationRequestModel } from '@/models/VerificationRequest';

const connectionMap = new Map<GameKey, Connection>();

export async function connectDB(forGame?: GameKey): Promise<Connection> {
  const gameKey = forGame ?? (await getGameKey());

  const existing = connectionMap.get(gameKey);
  if (existing?.readyState === 1) return existing;

  const conn = mongoose.createConnection(getMongoUri(gameKey), { bufferCommands: false });
  await conn.asPromise();

  getAgentModel(conn);
  getGameModel(conn);
  getSimCardModel(conn);
  getVerificationRequestModel(conn);

  connectionMap.set(gameKey, conn);
  return conn;
}

export async function getModels(forGame?: GameKey) {
  const conn = await connectDB(forGame);
  return {
    Agent: getAgentModel(conn),
    Game: getGameModel(conn),
    SimCard: getSimCardModel(conn),
    VerificationRequest: getVerificationRequestModel(conn),
  };
}
